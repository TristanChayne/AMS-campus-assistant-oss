import {createHash,timingSafeEqual} from 'node:crypto';
import {normalizeCourse,normalizePrefs,startAlert} from './schedule.mjs';
import {payloadFor} from './apns.mjs';

const ID=/^[A-Za-z0-9-]{16,64}$/,SECRET=/^[A-Za-z0-9_-]{32,128}$/,TOKEN=/^[0-9a-fA-F]{32,512}$/,BUNDLE=/^[A-Za-z0-9.-]{3,100}$/;
const MAX_BODY=64*1024;
const hash=v=>createHash('sha256').update(v).digest();

class HttpError extends Error{constructor(status,message,code){super(message);this.status=status;this.code=code;}}

function readJson(req){
 return new Promise((resolve,reject)=>{
  let size=0;const chunks=[];
  req.on('data',c=>{size+=c.length;if(size>MAX_BODY){reject(new HttpError(413,'too large'));req.destroy();}else chunks.push(c);});
  req.on('end',()=>{
   if(!chunks.length)return resolve({});
   try{const v=JSON.parse(Buffer.concat(chunks).toString('utf8'));resolve(v&&typeof v==='object'?v:{});}catch{reject(new HttpError(400,'bad json'));}
  });
  req.on('error',reject);
 });
}

// Small fixed-window limiter per client IP.
function limiter(max,windowMs){
 const hits=new Map();
 return (key,now)=>{
  const h=hits.get(key);
  if(!h||now-h.at>windowMs){hits.set(key,{at:now,n:1});if(hits.size>10000)hits.clear();return true;}
  return ++h.n<=max;
 };
}

// Self-hosted with activation (ADMIN-BE-001):
//   linkInstall: async ({deviceId,link}) -> installation id (proof of the activated installation; throws {status:403} when disabled)
//   installState: installationId -> {enabled, accountName, accountRevision} | null
// New registrations carry a link. Registrations without one stay accepted (builds before ADMIN-BE-001) as unlinked
// records; a linked record keeps its link when a later request omits it; a disabled installation cannot register,
// write or be pushed (withdrawal with DELETE /device stays possible).
export function createApp({store,allowedBundles,now=()=>Date.now(),pushReady=()=>false,linkInstall=null,installState=null}){
 const allow=limiter(120,60e3);
 function assertEnabled(installationId){
  if(installationId&&installState&&installState(installationId)?.enabled===false)throw new HttpError(403,'device disabled','DEVICE_DISABLED');
 }
 function auth(req,{write=true}={}){
  const id=req.headers['x-ams-device'],m=/^Bearer (.+)$/.exec(req.headers.authorization||'');
  if(!ID.test(id||'')||!m||!SECRET.test(m[1]))throw new HttpError(401,'unauthorized');
  const d=store.device(id);
  if(!d||!timingSafeEqual(Buffer.from(d.secret_hash,'hex'),hash(m[1])))throw new HttpError(401,'unauthorized');
  if(write)assertEnabled(d.installation_id);
  store.updateDevice(id,{last_seen:now()});
  return d;
 }
 async function verifiedLink(deviceId,link){
  if(!link||typeof link!=='object')throw new HttpError(400,'invalid installation proof');
  try{return await linkInstall({deviceId,link});}
  catch(e){throw e.status===403?new HttpError(403,'device disabled','DEVICE_DISABLED'):new HttpError(400,'invalid installation proof');}
 }
 const routes={
  'GET /health':()=>({ok:true}),
  'POST /register':async(req)=>{
   const b=await readJson(req);
   if(b.consent!==true)throw new HttpError(400,'consent required');
   if(!ID.test(b.deviceId||'')||!SECRET.test(b.secret||'')||b.platform!=='ios'||!BUNDLE.test(b.bundleId||'')||!allowedBundles.includes(b.bundleId)||!['sandbox','production'].includes(b.apnsEnv))throw new HttpError(400,'invalid');
   const t=now(),cur=store.device(b.deviceId);
   if(cur&&!timingSafeEqual(Buffer.from(cur.secret_hash,'hex'),hash(b.secret)))throw new HttpError(409,'device exists');
   const installationId=linkInstall&&b.link!==undefined?await verifiedLink(b.deviceId,b.link):null;
   if(!installationId)assertEnabled(cur?.installation_id);
   store.tx(()=>{
    if(cur)store.updateDevice(b.deviceId,{apns_env:b.apnsEnv,bundle_id:b.bundleId,last_seen:t,consent_at:t});
    else store.createDevice({id:b.deviceId,secretHash:hash(b.secret).toString('hex'),platform:'ios',bundleId:b.bundleId,apnsEnv:b.apnsEnv,now:t});
    if(installationId)store.linkInstallation(b.deviceId,installationId);
   });
   const linked=installationId||cur?.installation_id||null;
   return {ok:true,...(linked?{installationId:linked}:{})};
  },
  'PUT /link':async(req)=>{
   const d=auth(req),b=await readJson(req);
   if(!linkInstall)throw new HttpError(404,'not found');
   const installationId=await verifiedLink(d.id,b.link);
   store.tx(()=>store.linkInstallation(d.id,installationId));
   return {ok:true,installationId};
  },
  'PUT /token':async(req)=>{
   const d=auth(req),b=await readJson(req);
   if(b.startToken!==null&&!TOKEN.test(b.startToken||''))throw new HttpError(400,'invalid');
   store.updateDevice(d.id,{start_token:b.startToken});
   return {ok:true,push:pushReady()};
  },
  'PUT /timetable':async(req)=>{
   const d=auth(req),b=await readJson(req);
   if(!Array.isArray(b.courses)||b.courses.length>60)throw new HttpError(400,'invalid');
   const courses=b.courses.map(normalizeCourse).filter(Boolean);
   // Last date the uploaded snapshot covers (a day without classes is still covered).
   const through=typeof b.coverage?.to==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(b.coverage.to)?b.coverage.to:courses.map(c=>c.date).sort().pop()||null;
   // Linked installations: only the current account revision may upload, so a late upload for a previous account
   // cannot restore cleared data; builds without accountRevision may not overwrite an installation on protocol 2.
   const st=d.installation_id&&installState?installState(d.installation_id):null;
   if(st&&(b.accountRevision!==undefined?b.accountRevision!==st.accountRevision||st.accountName==null:st.accountRevision>0))throw new HttpError(409,'stale account','STALE_ACCOUNT');
   const t=now();
   const pending=store.tx(()=>{store.replaceCourses(d.id,courses);store.updateDevice(d.id,{timetable_at:t,coverage_until:through});return store.replan(d.id,t);});
   return {ok:true,accepted:courses.length,pending,push:pushReady()};
  },
  'PUT /prefs':async(req)=>{
   const d=auth(req),b=await readJson(req),prefs=normalizePrefs(b);
   const pending=store.tx(()=>{store.setPrefs(d.id,prefs);return store.replan(d.id,now());});
   return {ok:true,prefs,pending,push:pushReady()};
  },
  'PUT /activity':async(req)=>{
   const d=auth(req),b=await readJson(req);
   if(typeof b.chain!=='string'||!b.chain||b.chain.length>120)throw new HttpError(400,'invalid');
   const f={};
   if(b.updateToken!==undefined){if(b.updateToken!==null&&!TOKEN.test(b.updateToken))throw new HttpError(400,'invalid');f.update_token=b.updateToken;}
   if(typeof b.local==='boolean')f.local=b.local;
   if(typeof b.ended==='boolean')f.ended=b.ended;
   const t=now();
   const pending=store.tx(()=>{
    store.upsertActivity(d.id,b.chain,f,t);
    const n=store.replan(d.id,t);
    // A token that arrives after a boundary passed must still bring the activity up to date.
    if(f.update_token&&!f.ended&&(store.startSent(d.id,b.chain)||store.activity(d.id,b.chain)?.local))store.queueSync(d.id,b.chain,t);
    return n;
   });
   return {ok:true,pending,push:pushReady()};
  },
  'DELETE /device':(req)=>{const d=auth(req,{write:false});store.deleteDevice(d.id);return {ok:true};}
 };
 return async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
  try{
   const ip=String(req.headers['x-real-ip']||req.socket.remoteAddress||'');
   if(!allow(ip,now()))throw new HttpError(429,'slow down');
   const path=new URL(req.url,'http://x').pathname.replace(/^\/api\/notify/,'')||'/';
   const route=routes[`${req.method} ${path}`];
   if(!route)throw new HttpError(404,'not found');
   send(200,await route(req));
  }catch(e){
   if(!(e instanceof HttpError))console.error('request',e);
   send(e.status||500,{ok:false,error:e instanceof HttpError?e.message:'server error',...(e.code?{code:e.code}:{})});
  }
 };
}

// Retry policy: success and permanent rejections are final; throttling, server errors, network failures and a
// token that has not arrived yet are retried with backoff while the event is still current.
export const MAX_ATTEMPTS=6;
const STATE_GRACE=10*60e3,END_GRACE=60*60e3;
const backoff=attempts=>Math.min(30e3*2**attempts,5*60e3);
function retryable(r){return r.status===0&&r.reason!=='no-key'||r.status===429||r.status>=500;}

// One scheduler pass. Updates older than 10 minutes are dropped; a late start is sent with the current state and an end
// is still worth sending, both for up to an hour.
// allowed(row): false when the device's app installation (or its activation code) is disabled.
// accountOf(row): current account name of the installation, recorded with each attempt.
export async function tick({store,apns,now=Date.now(),log=console,allowed=null,accountOf=null}){
 const due=store.dueEvents(now,END_GRACE);
 for(const row of due){
  let event=JSON.parse(row.json);
  if(accountOf)store.noteAccount(row.device_id,row.key,accountOf(row));
  if(allowed&&!allowed(row)){store.markSent(row.device_id,row.key,'disabled',now);continue;}
  if(event.kind==='update'&&row.due<now-STATE_GRACE){store.markSent(row.device_id,row.key,'expired',now);continue;}
  if(store.superseded(row,now)||(event.kind==='start'&&row.due<now-STATE_GRACE)){
   if(event.kind==='update'){store.markSent(row.device_id,row.key,'superseded',now);continue;}
   // A late start still has to happen, but with the state of now.
   const current=store.currentState(row.device_id,row.chain,now);
   if(!current){store.markSent(row.device_id,row.key,'expired',now);continue;}
   event={...event,state:current.state,stale:current.stale};
  }
  const deviceToken=event.kind==='start'?row.start_token:row.update_token;
  if(!deviceToken){
   if(row.attempts+1>=MAX_ATTEMPTS)store.markSent(row.device_id,row.key,'no-token',now);
   else store.markRetry(row.device_id,row.key,'wait-token',now+backoff(row.attempts));
   continue;
  }
  const payload=payloadFor(event,{alert:startAlert(event.state),now});
  const r=await apns.send({env:row.apns_env,deviceToken,topic:`${row.bundle_id}.push-type.liveactivity`,payload,expiration:Math.floor(now/1000)+600});
  const status=r.status===200?'sent':`fail:${r.status}:${r.reason}`;
  if(r.status!==200&&retryable(r)&&row.attempts+1<MAX_ATTEMPTS)store.markRetry(row.device_id,row.key,`retry:${r.status}:${r.reason}`,now+backoff(row.attempts));
  else store.markSent(row.device_id,row.key,status,now);
  if(r.status===410||r.reason==='BadDeviceToken'||r.reason==='Unregistered'){
   if(event.kind==='start')store.updateDevice(row.device_id,{start_token:null});
   else store.upsertActivity(row.device_id,row.chain,{update_token:null},now);
  }
  if(r.status!==200)log.warn?.('apns',event.kind,status);
 }
 return due.length;
}
