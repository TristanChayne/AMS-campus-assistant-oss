import {demoRequest} from './review-demo.mjs';
import {iosPublicConfig} from './ios-public-config.mjs';
const enc = new TextEncoder();
const rsa = {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'};
export const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export const unb64 = text => Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export const hashBytes=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
export const hash = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
export async function passwordHash(password,salt) {
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 return b64(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unb64(salt),iterations:210000},key,256));
}
async function passwordMatches(password,row){if(typeof password!=='string'||password.length>128)return false;const actual=unb64(await passwordHash(password,row.salt)),expected=unb64(row.password_hash);if(actual.length!==expected.length)return false;let difference=0;for(let i=0;i<actual.length;i++)difference|=actual[i]^expected[i];return difference===0;}
async function codeKey(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode('AMS-CODE-STORAGE-1:'+env.CODE_PEPPER)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function sealCode(env,code){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await codeKey(env),enc.encode(code)));}
async function openCode(env,cipher){if(!cipher)return null;const [iv,data]=cipher.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await codeKey(env),unb64(data)));}
const validUses=n=>Number.isInteger(n)&&n>=1&&n<=10000;
const cleanCode = value => typeof value==='string'?value.trim().toUpperCase():'';
export async function deviceProof(publicKey,code,proof) {
 const bytes=unb64(publicKey);
 const key=await crypto.subtle.importKey('spki',bytes,rsa,false,['verify']);
 if(key.algorithm.modulusLength!==2048)return null;
 if(!await crypto.subtle.verify(rsa,key,unb64(proof),enc.encode('AMS-ACTIVATE-1\n'+code)))return null;
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function issueGrant(env,row) {
 const demo=await env.DB.prepare('SELECT code_id FROM demo_codes WHERE code_id=?').bind(row.id).first();
 const key=await crypto.subtle.importKey('pkcs8',unb64(env.SIGNING_KEY),rsa,false,['sign']);
 const payload=b64(enc.encode(JSON.stringify({v:1,app:'cn.local.ams',device:row.device,grant:row.id,issued:row.issued,...(demo?{mode:'demo'}:{})})));
 return payload+'.'+b64(await crypto.subtle.sign(rsa,key,enc.encode(payload)));
}
export async function signedStatus(env,data){const key=await crypto.subtle.importKey('pkcs8',unb64(env.SIGNING_KEY),rsa,false,['sign']);const payload=b64(enc.encode(JSON.stringify(data)));return payload+'.'+b64(await crypto.subtle.sign(rsa,key,enc.encode(payload)));}
export async function checkedGrant(env,grant){if(typeof grant!=='string'||grant.length>4096)return null;const parts=grant.split('.');if(parts.length!==2)return null;const privateKey=await crypto.subtle.importKey('pkcs8',unb64(env.SIGNING_KEY),rsa,true,['sign']);const jwk=await crypto.subtle.exportKey('jwk',privateKey);const key=await crypto.subtle.importKey('jwk',{kty:'RSA',n:jwk.n,e:jwk.e,alg:'RS256',ext:true},rsa,false,['verify']);if(!await crypto.subtle.verify(rsa,key,unb64(parts[1]),enc.encode(parts[0])))return null;const data=JSON.parse(new TextDecoder().decode(unb64(parts[0])));return data.v===1&&data.app==='cn.local.ams'?data:null;}
const hmacKey=env=>crypto.subtle.importKey('raw',enc.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
async function session(env) {
 const payload=b64(enc.encode(JSON.stringify({email:env.ADMIN_EMAIL,revision:env.ADMIN_REVISION,exp:Math.floor(Date.now()/1000)+3600})));
 return payload+'.'+b64(await crypto.subtle.sign('HMAC',await hmacKey(env),enc.encode(payload)));
}
async function authorized(request,env) {
 try {
  const cookie=request.headers.get('cookie')||'',token=cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('ams_admin='));
  if(!token)return false;
  const parts=token.slice(10).split('.');if(parts.length!==2)return false;
  if(!await crypto.subtle.verify('HMAC',await hmacKey(env),unb64(parts[1]),enc.encode(parts[0])))return false;
  const data=JSON.parse(new TextDecoder().decode(unb64(parts[0])));
  return data.email===env.ADMIN_EMAIL&&data.revision===env.ADMIN_REVISION&&data.exp>Math.floor(Date.now()/1000);
 }catch{return false;}
}
// Admin cookie check for routes served next to this worker (self-hosted admin API).
export async function adminAuthorized(request,env){const c=await env.DB.prepare('SELECT username,revision FROM admin_credentials WHERE id=?').bind('owner').first();return !!c&&await authorized(request,{...env,ADMIN_EMAIL:c.username,ADMIN_REVISION:c.revision});}
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});
async function body(request) {
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))throw new Error('invalid');
 const text=await request.text();if(text.length>8192)throw new Error('invalid');return JSON.parse(text);
}
async function limited(request,env,kind,max) {
 const now=Math.floor(Date.now()/1000),minute=Math.floor(now/60);
 // Tencent's HTTP entrypoint has no scheduled hook. Cleanup must run here too.
 await env.DB.prepare('DELETE FROM rate_limits WHERE expires < ?').bind(now).run();
 const ip=await hash(env.CODE_PEPPER+':'+(request.headers.get('CF-Connecting-IP')||'local'));
 const row=await env.DB.prepare('INSERT INTO rate_limits(key,hits,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=rate_limits.hits+1 RETURNING hits').bind(kind+':'+ip+':'+minute,now+120).first();
 return row.hits>max;
}
export default {
 async fetch(request,env) {
  const url=new URL(request.url),path=url.pathname;
  try {
   if(path==='/api/public/ios/config'&&request.method==='GET')return json(iosPublicConfig(env.IOS_PUBLIC_CONFIG));
   if(path.startsWith('/api/demo/'))return await demoRequest(request,env,{checkedGrant,b64,unb64,hash,json});
   if(path==='/api/activate'&&request.method==='POST') {
    if(await limited(request,env,'activate',20))return json({message:'尝试过于频繁，请稍后重试'},429);
    const data=await body(request),code=cleanCode(data.code);
    if(!/^AMS-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/.test(code)||typeof data.publicKey!=='string'||data.publicKey.length>500||typeof data.proof!=='string'||data.proof.length>400)return json({message:'激活信息不正确'},400);
    let device;try{device=await deviceProof(data.publicKey,code,data.proof);}catch{}
    if(!device)return json({message:'设备验证失败'},400);
    // Self-hosted runtime: an installation disabled by the admin cannot activate again (no quota is used).
    if(await env.INSTALLATIONS?.disabled(device))return json({message:'此设备已被停用，请联系管理员',error:{code:'DEVICE_DISABLED',message:'此设备已被停用，请联系管理员'}},403);
    const codeHash=await hash(env.CODE_PEPPER+':'+code),now=Math.floor(Date.now()/1000);
    // Membership and quota are checked and updated under the same database row lock.
    const member='%|'+device+'|%';
    const row=await env.DB.prepare("UPDATE activation_codes SET device=?,issued=COALESCE(issued,?),bound_devices=CASE WHEN bound_devices LIKE ? THEN bound_devices ELSE bound_devices || ? END,used_count=used_count+CASE WHEN bound_devices LIKE ? THEN 0 ELSE 1 END WHERE code_hash=? AND enabled=1 AND (bound_devices LIKE ? OR used_count<max_uses) RETURNING id,device,issued").bind(device,now,member,device+'|',member,codeHash,member).first();
    if(!row)return json({message:'激活码无效、已停用或剩余激活次数不足'},409);
    // Self-hosted runtime: register this installation (idempotent per key fingerprint).
    await env.INSTALLATIONS?.activated({fingerprint:device,codeId:row.id});
    return json({grant:await issueGrant(env,row)});
   }
   if(path==='/api/check'&&request.method==='POST'){
    if(await limited(request,env,'check',120))return json({message:'请稍后重试'},429);
    const data=await body(request);
    if(typeof data.nonce!=='string'||! /^[A-Za-z0-9_-]{32}$/.test(data.nonce)||typeof data.publicKey!=='string'||data.publicKey.length>500||typeof data.proof!=='string'||data.proof.length>400)return json({message:'验证信息不正确'},400);
    let grant,device;try{grant=await checkedGrant(env,data.grant);const bytes=unb64(data.publicKey),key=await crypto.subtle.importKey('spki',bytes,rsa,false,['verify']);if(key.algorithm.modulusLength!==2048||!await crypto.subtle.verify(rsa,key,unb64(data.proof),enc.encode('AMS-CHECK-1\n'+data.grant+'\n'+data.nonce)))return json({message:'验证信息不正确'},400);device=await hashBytes(bytes);}catch{return json({message:'验证信息不正确'},400);}
    if(!grant||grant.device!==device)return json({message:'验证信息不正确'},400);
    const row=await env.DB.prepare('SELECT enabled FROM activation_codes WHERE id=?').bind(grant.grant).first();if(!row)return json({message:'记录暂不可用'},503);
    const settings=await env.DB.prepare('SELECT interval_days,version_code,version_name,download_url,release_notes FROM service_settings WHERE id=?').bind('global').first();if(!settings)return json({message:'设置暂不可用'},503);
    return json({status:await signedStatus(env,{v:1,app:'cn.local.ams',device,grant:grant.grant,nonce:data.nonce,enabled:Number(row.enabled)===1&&(env.INSTALLATIONS?await env.INSTALLATIONS.checked({fingerprint:device,codeId:grant.grant,issued:grant.issued}):true),intervalDays:settings.interval_days,release:{versionCode:settings.version_code,versionName:settings.version_name,url:settings.download_url,notes:settings.release_notes}})});
   }
   if(path.startsWith('/api/admin/')) {
    const credentials=await env.DB.prepare('SELECT username,password_hash,salt,revision FROM admin_credentials WHERE id=?').bind('owner').first();
    if(!credentials)return json({message:'管理账户尚未就绪'},503);
    env={...env,ADMIN_EMAIL:credentials.username,ADMIN_REVISION:credentials.revision};
    if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)return json({message:'来源不正确'},403);
    if(path==='/api/admin/login'&&request.method==='POST') {
     if(await limited(request,env,'login',5))return json({message:'尝试过于频繁，请稍后重试'},429);
     const data=await body(request);
     const equal=await passwordMatches(data.password,credentials);
     if((data.username||data.email)!==env.ADMIN_EMAIL||!equal)return json({message:'账号或密码不正确'},401);
     return json({ok:true},200,{'Set-Cookie':'ams_admin='+await session(env)+'; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=3600'});
    }
    if(!await authorized(request,env))return json({message:'请先登录管理页'},401);
    if(path==='/api/admin/settings'&&request.method==='GET')return json(await env.DB.prepare('SELECT interval_days,version_code,version_name,download_url,release_notes FROM service_settings WHERE id=?').bind('global').first());
    if(path==='/api/admin/settings'&&request.method==='POST'){
     const data=await body(request);let link;try{link=new URL(data.downloadUrl);}catch{}
     if(!Number.isInteger(data.intervalDays)||data.intervalDays<1||data.intervalDays>365||!Number.isInteger(data.versionCode)||data.versionCode<0||data.versionCode>2147483647||typeof data.versionName!=='string'||data.versionName.length>40||typeof data.notes!=='string'||data.notes.length>2000||!link||link.protocol!=='https:'||link.username||link.password||data.downloadUrl.length>500)return json({message:'请检查验证周期、版本和下载地址'},400);
     await env.DB.prepare('UPDATE service_settings SET interval_days=?,version_code=?,version_name=?,download_url=?,release_notes=? WHERE id=?').bind(data.intervalDays,data.versionCode,data.versionName.trim(),data.downloadUrl,data.notes.trim(),'global').run();return json({ok:true});
    }
    if(path==='/api/admin/profile'&&request.method==='GET')return json({username:credentials.username});
    if(path==='/api/admin/credentials'&&request.method==='POST') {
     if(await limited(request,env,'credentials',5))return json({message:'尝试过于频繁，请稍后重试'},429);
     const data=await body(request),username=typeof data.username==='string'?data.username.trim():'',nextPassword=data.newPassword;
     if(username.length<3||username.length>80||/[\x00-\x1f\x7f]/.test(username))return json({message:'账户名需为 3–80 个字符'},400);
     if(!await passwordMatches(data.currentPassword,credentials))return json({message:'当前密码不正确'},400);
     if(nextPassword!==undefined&&nextPassword!==''&&(typeof nextPassword!=='string'||nextPassword.length<10||nextPassword.length>128))return json({message:'新密码需为 10–128 个字符'},400);
     const salt=nextPassword?b64(crypto.getRandomValues(new Uint8Array(16))):credentials.salt;
     const password=nextPassword?await passwordHash(nextPassword,salt):credentials.password_hash;
     const changed=await env.DB.prepare('UPDATE admin_credentials SET username=?,password_hash=?,salt=?,revision=revision+1 WHERE id=? AND revision=? RETURNING revision').bind(username,password,salt,'owner',credentials.revision).first();
     if(!changed)return json({message:'账户刚刚发生变更，请重新登录'},409);
     return json({ok:true},200,{'Set-Cookie':'ams_admin=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0'});
    }
    if(path==='/api/admin/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':'ams_admin=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0'});
    if(path==='/api/admin/codes'&&request.method==='GET') {
     const rows=await env.DB.prepare('SELECT id,note,enabled,created,device,issued,max_uses,used_count,code_cipher FROM activation_codes ORDER BY created DESC LIMIT 200').all();
     const demos=new Set((await env.DB.prepare('SELECT code_id FROM demo_codes').all()).results.map(r=>r.code_id));
     return json({codes:await Promise.all(rows.results.map(async row=>{const {code_cipher,...info}=row;return {...info,mode:demos.has(row.id)?'demo':'normal',code:await openCode(env,code_cipher),remaining:Math.max(0,row.max_uses-row.used_count)};}))});
    }
    if(path==='/api/admin/codes'&&request.method==='POST') {
     const data=await body(request),note=typeof data.note==='string'?data.note.trim().slice(0,100):'';
     if(data.mode!==undefined&&!['normal','demo'].includes(data.mode))return json({message:'激活类型不正确'},400);
     const maxUses=data.maxUses===undefined?1:data.maxUses;if(!validUses(maxUses))return json({message:'激活次数需为 1–10000 的整数'},400);
     const random=Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
     const code='AMS-'+random.match(/.{8}/g).join('-'),id=crypto.randomUUID();
     await env.DB.prepare('INSERT INTO activation_codes(id,code_hash,note,created,max_uses,code_cipher) VALUES (?,?,?,?,?,?)').bind(id,await hash(env.CODE_PEPPER+':'+code),note,Math.floor(Date.now()/1000),maxUses,await sealCode(env,code)).run();
     if(data.mode==='demo')await env.DB.prepare('INSERT INTO demo_codes(code_id) VALUES (?)').bind(id).run();
     return json({id,code});
    }
    if(path==='/api/admin/update'&&request.method==='POST') {
     const data=await body(request);
     if(typeof data.id!=='string'||!['disable','enable','reset','quota','delete','saveCode'].includes(data.action))return json({message:'参数不正确'},400);
     let sql,args;
     if(data.action==='quota'){
      if(!validUses(data.maxUses))return json({message:'激活次数需为 1–10000 的整数'},400);
      sql='UPDATE activation_codes SET max_uses=? WHERE id=? AND used_count<=?';args=[data.maxUses,data.id,data.maxUses];
     }else if(data.action==='delete'){
      sql='DELETE FROM activation_codes WHERE id=? AND enabled=0 AND used_count=0 AND issued IS NULL AND device IS NULL';args=[data.id];
     }else if(data.action==='saveCode'){
      const code=cleanCode(data.code);if(!/^AMS-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/.test(code))return json({message:'激活码格式不正确'},400);
      sql='UPDATE activation_codes SET code_cipher=? WHERE id=? AND code_hash=?';args=[await sealCode(env,code),data.id,await hash(env.CODE_PEPPER+':'+code)];
     }else if(data.action==='reset'){
      sql="UPDATE activation_codes SET device=NULL,bound_devices='|',used_count=0 WHERE id=?";args=[data.id];
     }else{sql='UPDATE activation_codes SET enabled=? WHERE id=?';args=[data.action==='enable'?1:0,data.id];}
     const result=await env.DB.prepare(sql+' RETURNING id').bind(...args).first();
     if(!result)return json({message:'操作未完成：记录不存在或不符合条件'},409);
     return json({ok:true});
    }
    return json({message:'找不到接口'},404);
   }
   if(request.method==='GET'&&(path==='/'||path==='/admin'||path==='/admin.js'||path==='/admin.css')) {
    const asset=new Request(new URL(path==='/'||path==='/admin'?'/index.html':path,url),request);
    const response=await env.ASSETS.fetch(asset);const headers=new Headers(response.headers);
    headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    headers.set('X-Content-Type-Options','nosniff');headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');
    return new Response(response.body,{status:response.status,headers});
   }
   return json({message:'找不到页面'},404);
  }catch(error){console.error('Activation backend error',error.code||error.name,'');return json({message:'服务暂时不可用，请稍后重试'},503);}
 },
 async scheduled(event,env) {await env.DB.prepare('DELETE FROM rate_limits WHERE expires < ?').bind(Math.floor(Date.now()/1000)).run();}
};

