import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {createApp,tick} from './server.mjs';
import {Registry,migrateRegistry} from './registry.mjs';
import {createAdmin} from './admin.mjs';
import {ApiError} from './messages.mjs';
import {ClientError,clientCheck,linkMessage,provenInstall} from './client.mjs';
import {ReviewReminder} from './review-reminder.mjs';

// ADMIN-BE-001 self-hosted AMS service on ams.tristanchayne.com (behind the host nginx):
//   /api/notify/*                      course reminder devices (REMIND-001)
//   /api/client/check                  per-open authorization check (protocol 2)
//   /api/admin/{login,profile,...}     activation worker admin routes, unchanged
//   /api/admin/*                       admin console API (admin.mjs)
//   /api/activate, /api/check, /api/public/ios/config, /api/demo/*   activation worker, unchanged protocol
const WORKER_ADMIN=new Set(['login','profile','logout','codes','update','settings','credentials']);
const MAX_BODY=1600*1024;
const NONCE=/^[A-Za-z0-9_-]{32}$/;

// Cloudflare D1-style facade over node:sqlite for the activation worker.
export function d1(db){
 return {prepare(sql){
  const st=db.prepare(sql);
  const bound=args=>({first:async()=>st.get(...args)??null,all:async()=>({results:st.all(...args)}),run:async()=>{const r=st.run(...args);return {meta:{changes:Number(r.changes)}};}});
  return {...bound([]),bind:(...args)=>bound(args)};
 }};
}

function readBody(req){
 return new Promise((resolve,reject)=>{
  let size=0;const chunks=[];
  req.on('data',c=>{size+=c.length;if(size>MAX_BODY){reject(new ApiError(413,'TOO_LARGE','请求过大'));req.destroy();}else chunks.push(c);});
  req.on('end',()=>resolve(Buffer.concat(chunks)));
  req.on('error',reject);
 });
}
function limiter(max,windowMs){
 const hits=new Map();
 return (key,now)=>{const h=hits.get(key);if(!h||now-h.at>windowMs){hits.set(key,{at:now,n:1});if(hits.size>10000)hits.clear();return true;}return ++h.n<=max;};
}
const sameSecret=(a,b)=>!!a&&!!b&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

export function createHost({db,store,apns,worker,secrets,origin,allowedBundles,proxyKey,validateIosRelease,now=()=>Date.now()}){
 migrateRegistry(db);
 const registry=new Registry(db);
 const admin=createAdmin({registry,store,apns,validateIosRelease,now});
 const DB=d1(db);
 const reviewReminder=new ReviewReminder({db,registry,apns,allowedBundles,now});
 const env=()=>({...secrets,DB,REVIEW_REMINDER:(auth,data)=>reviewReminder.handle(auth,data),IOS_PUBLIC_CONFIG:JSON.stringify(registry.iosPublicConfig(now())),INSTALLATIONS:registry.hooks(now),ASSETS:{fetch:async()=>new Response('',{status:404})}});
 const linkInstall=async({deviceId,link})=>{
  if(!NONCE.test(link.nonce||''))throw new ClientError(400,'invalid');
  const {grant,fingerprint}=await provenInstall(env(),worker,link,linkMessage({grant:link.grant,nonce:link.nonce,deviceId}));
  const row=registry.claim({fingerprint,codeId:grant.grant,now:now()});
  if(!registry.effective(row).enabled)throw new ClientError(403,'disabled');
  return row.id;
 };
 // Until the activation data and its signing material are migrated, activation and admin routes answer 503.
 const activationReady=Object.values(secrets).every(Boolean);
 const installState=id=>{const row=registry.installation(id);return row?{enabled:registry.effective(row).enabled,accountName:row.account_name??null,accountRevision:row.account_revision}:null;};
 const notify=createApp({store,allowedBundles,now,pushReady:()=>apns.configured,linkInstall:activationReady?linkInstall:null,installState:activationReady?installState:null});
 const allowClient=limiter(60,60e3);

 const send=(res,status,body,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body));};
 const fail=(res,status,code,message,fields)=>send(res,status,{message,error:{code,message,...(fields?{fields}:{})}});
 function clientIp(req){
  if(proxyKey&&sameSecret(String(req.headers['x-ams-proxy-key']||''),proxyKey)&&req.headers['x-ams-client-ip'])return String(req.headers['x-ams-client-ip']).slice(0,64);
  return String(req.headers['x-real-ip']||req.socket.remoteAddress||'');
 }
 function webRequest(req,url,body){
  const headers=new Headers();
  for(const [k,v] of Object.entries(req.headers))if(typeof v==='string'&&!k.startsWith(':'))headers.set(k,v);
  headers.set('CF-Connecting-IP',clientIp(req));
  return new Request(origin+url.pathname+url.search,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body})});
 }
 async function toNode(res,response){
  const headers={};response.headers.forEach((v,k)=>{headers[k]=v;});
  const setCookie=response.headers.getSetCookie?.();if(setCookie?.length)headers['set-cookie']=setCookie;
  res.writeHead(response.status,headers);res.end(Buffer.from(await response.arrayBuffer()));
 }
 function json(buf){
  if(!buf.length)return {};
  try{const v=JSON.parse(buf.toString('utf8'));if(v&&typeof v==='object'&&!Array.isArray(v))return v;}catch{}
  throw new ApiError(400,'BAD_JSON','请求格式不正确');
 }

 const handler=async(req,res)=>{
  const url=new URL(req.url,origin),path=url.pathname;
  try{
   if(path.startsWith('/api/notify/')||path==='/api/notify')return await notify(req,res);
   if(!activationReady&&path.startsWith('/api/'))return fail(res,503,'SERVICE_NOT_CONNECTED','激活与管理服务尚未完成迁移，请稍后重试');
   if(path==='/api/client/check'){
    if(req.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED','不支持的操作');
    if(!allowClient(clientIp(req),now()))return fail(res,429,'RATE_LIMITED','请稍后重试');
    const body=json(await readBody(req));
    return send(res,200,await clientCheck(body,{env:env(),worker,registry,now:now()}));
   }
   const adminPath=path.startsWith('/api/admin/')?path.slice(11):null;
   if(adminPath!==null&&!WORKER_ADMIN.has(adminPath)){
    if(req.method!=='GET'&&req.headers.origin!==origin)return fail(res,403,'BAD_ORIGIN','来源不正确');
    const raw=await readBody(req);
    if(!await worker.adminAuthorized(new Request(origin+path,{headers:{cookie:String(req.headers.cookie||'')}}),env()))return fail(res,401,'UNAUTHORIZED','请先登录管理页');
    if(raw.length&&!String(req.headers['content-type']||'').startsWith('application/json'))throw new ApiError(415,'BAD_CONTENT_TYPE','请求格式不正确');
    const [status,body]=admin.handle(req.method,adminPath,json(raw),url);
    return send(res,status,body);
   }
   if(path.startsWith('/api/')){
    const body=['GET','HEAD'].includes(req.method)?undefined:await readBody(req);
    return await toNode(res,await worker.default.fetch(webRequest(req,url,body),env()));
   }
   return fail(res,404,'NOT_FOUND','找不到接口');
  }catch(e){
   if(e instanceof ApiError)return fail(res,e.status,e.code,e.message,e.fields);
   if(e instanceof ClientError)return send(res,e.status,{message:e.message});
   console.error('host',e);
   return fail(res,500,'SERVER_ERROR','服务暂时不可用，请稍后重试');
  }
 };
 // One scheduler pass: Live Activity events, then ordinary notifications.
 const allowed=row=>!row.installation_id||registry.deviceAllowed(row);
 const accountOf=row=>row.installation_id?registry.installation(row.installation_id)?.account_name??null:null;
 async function runTick(t=now()){registry.announcementsDue(t);await tick({store,apns,now:t,allowed,accountOf});await admin.messages.tick({apns,now:t});await reviewReminder.tick();}
 return {handler,registry,admin,runTick};
}

export function startHost({port,host='0.0.0.0',backupDir,tickMs=15e3,...options}){
 const app=createHost(options),{store}=options;
 const server=http.createServer(app.handler);
 server.headersTimeout=15e3;server.requestTimeout=20e3;
 server.listen(port,host);
 let running=false,lastCleanup=0;
 const timer=setInterval(async()=>{
  if(running)return;running=true;
  try{
   const t=Date.now();
   await app.runTick(t);
   if(t-lastCleanup>3600e3){store.cleanup(t);app.registry.cleanup(t);if(backupDir)store.backup(backupDir,t);lastCleanup=t;}
  }catch(e){console.error('tick',e);}
  finally{running=false;}
 },tickMs);
 return {server,app,stop(){clearInterval(timer);server.close();options.apns.close();}};
}
