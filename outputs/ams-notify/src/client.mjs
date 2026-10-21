import {Registry} from './registry.mjs';
import {Messages} from './messages.mjs';

// Per-open client check (protocol 2, ADMIN-BE-001 / D-020). The app calls it on every cold start and
// return to foreground, and after a school login, account switch or logout. One round trip returns the
// signed authorization state plus announcements and release info. The legacy /api/check stays unchanged.
const rsa={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'};
const enc=new TextEncoder();
const NONCE=/^[A-Za-z0-9_-]{32}$/;
const text=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);

// The proof covers the account and the device metadata so neither can be written for another installation.
// Clients that send alertToken (even null) sign it and its APNs environment as two more lines.
export function checkMessage({grant,nonce,platform,account,bundleId='',appVersion='',model='',alertToken,apnsEnv,readMessageIds}){
 const base=`AMS-CHECK-2\n${grant}\n${nonce}\n${platform}\n${account.revision}\n${account.name??''}\n${bundleId}\n${appVersion}\n${model}`;
 const signed=alertToken===undefined?base:`${base}\n${alertToken??''}\n${alertToken?apnsEnv??'':''}`;
 return readMessageIds===undefined?signed:`${signed}\nAMS-INBOX-1\n${JSON.stringify(readMessageIds)}`;
}
export function linkMessage({grant,nonce,deviceId}){return `AMS-LINK-1\n${grant}\n${deviceId}\n${nonce}`;}

export class ClientError extends Error{constructor(status,message){super(message);this.status=status;}}

// Verifies the activation grant and a signature made with the install key it was issued to.
// Returns {grant, fingerprint} or throws 400.
export async function provenInstall(env,worker,{grant,publicKey,proof},message){
 if(typeof publicKey!=='string'||publicKey.length>500||typeof proof!=='string'||proof.length>400)throw new ClientError(400,'验证信息不正确');
 let data,fingerprint;
 try{
  data=await worker.checkedGrant(env,grant);
  const bytes=worker.unb64(publicKey),key=await crypto.subtle.importKey('spki',bytes,rsa,false,['verify']);
  if(key.algorithm.modulusLength!==2048||!await crypto.subtle.verify(rsa,key,worker.unb64(proof),enc.encode(message)))throw 0;
  fingerprint=await worker.hashBytes(bytes);
 }catch{throw new ClientError(400,'验证信息不正确');}
 if(!data||data.device!==fingerprint)throw new ClientError(400,'验证信息不正确');
 return {grant:data,fingerprint};
}

export async function clientCheck(body,{env,worker,registry,now=Date.now()}){
 const b=body||{};
 if(!NONCE.test(b.nonce||'')||!['android','ios'].includes(b.platform))throw new ClientError(400,'验证信息不正确');
 const account=b.account&&typeof b.account==='object'?b.account:null;
 if(!account||!Number.isInteger(account.revision)||account.revision<0||account.revision>2**31||!(account.name===null||(text(account.name,120)&&account.name.trim())))throw new ClientError(400,'账户信息不正确');
 for(const [k,max] of [['appVersion',40],['model',80],['bundleId',100]])if(b[k]!==undefined&&!text(b[k],max))throw new ClientError(400,'设备信息不正确');
 if(b.alertToken!==undefined&&b.alertToken!==null&&!(/^[0-9a-fA-F]{32,512}$/.test(b.alertToken)&&['sandbox','production'].includes(b.apnsEnv)))throw new ClientError(400,'推送信息不正确');
 if(b.readMessageIds!==undefined&&(b.platform!=='android'||!Array.isArray(b.readMessageIds)||b.readMessageIds.length>100||!b.readMessageIds.every(id=>typeof id==='string'&&/^msg-[A-Za-z0-9_-]{1,96}$/.test(id))))throw new ClientError(400,'消息确认信息不正确');
 const {grant,fingerprint}=await provenInstall(env,worker,b,checkMessage({grant:b.grant,nonce:b.nonce,platform:b.platform,account,bundleId:b.bundleId??'',appVersion:b.appVersion??'',model:b.model??'',alertToken:b.alertToken,apnsEnv:b.apnsEnv,readMessageIds:b.readMessageIds}));
 const code=registry.code(grant.grant);
 if(!code)throw new ClientError(503,'记录暂不可用');
 const settings=registry.q('SELECT interval_days,version_code,version_name,download_url,release_notes FROM service_settings WHERE id=?').get('global');
 const row=registry.tx(()=>{
  let r=registry.claim({fingerprint,codeId:grant.grant,now,fields:{platform:b.platform,checked_at:now,protocol:2,inbox_supported:b.platform==='android'&&b.readMessageIds!==undefined?1:0,...(b.appVersion!==undefined?{app_version:b.appVersion}:{}),...(b.model!==undefined?{model:b.model}:{}),...(b.bundleId!==undefined?{bundle_id:b.bundleId}:{}),...(b.alertToken!==undefined?{alert_token:b.alertToken||null,apns_env:b.alertToken?b.apnsEnv:null}:{})}});
  return registry.applyAccount(r,{name:account.name===null?null:account.name.trim(),revision:account.revision},now);
 });
 const eff=registry.effective(row);
 // Everything the app acts on is inside the signed status: authorization, installation, account revision,
 // release info and announcements. Legacy fields keep their meaning; unknown fields are ignored by old clients.
 const state={v:2,app:'cn.local.ams',device:fingerprint,grant:grant.grant,nonce:b.nonce,installationId:row.id,
  enabled:eff.enabled,codeEnabled:eff.codeEnabled!==false,deviceEnabled:eff.deviceEnabled,
  account:{name:row.account_name??null,revision:row.account_revision},checkedAt:Math.floor(now/1000),
  release:{
   android:settings?{versionCode:settings.version_code,versionName:settings.version_name,url:settings.download_url,notes:settings.release_notes}:null,
   ios:registry.kv('ios_release')
  },
  announcements:registry.activeAnnouncements(b.platform,now).slice(0,3).map(Registry.publicAnnouncement),
  ...(b.platform==='android'&&b.readMessageIds!==undefined?{messages:eff.enabled?new Messages(registry).inbox(row.id,b.readMessageIds,now):[]}:{} )};
 return {status:await worker.signedStatus(env,state)};
}
