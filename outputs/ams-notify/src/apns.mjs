import http2 from 'node:http2';
import {createPrivateKey,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';

const HOSTS={production:'https://api.push.apple.com',sandbox:'https://api.sandbox.push.apple.com'};
const b64url=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');

// Token-based APNs client (ES256 JWT, HTTP/2). Without a key it reports 'no-key' and sends nothing.
export class Apns{
 constructor({keyPath,keyId,teamId,log=console}){
  this.log=log;
  this.keyId=keyId;this.teamId=teamId;
  this.key=keyPath&&keyId&&teamId?createPrivateKey(readFileSync(keyPath)):null;
  this.jwt=null;this.jwtAt=0;this.sessions=new Map();
 }
 get configured(){return !!this.key;}
 token(now=Date.now()){
  if(this.jwt&&now-this.jwtAt<50*60e3)return this.jwt;
  const iat=Math.floor(now/1000);
  const input=`${b64url({alg:'ES256',kid:this.keyId})}.${b64url({iss:this.teamId,iat})}`;
  const sig=sign('sha256',Buffer.from(input),{key:this.key,dsaEncoding:'ieee-p1363'});
  this.jwt=`${input}.${sig.toString('base64url')}`;this.jwtAt=now;
  return this.jwt;
 }
 session(env){
  let s=this.sessions.get(env);
  if(!s||s.closed||s.destroyed){
   s=http2.connect(HOSTS[env]);
   s.on('error',e=>this.log.warn?.('apns session',env,e.code||e.message));
   s.setTimeout(5*60e3,()=>s.close());
   this.sessions.set(env,s);
  }
  return s;
 }
 // Returns {status, reason}. Never throws for APNs-level failures.
 send({env,deviceToken,topic,payload,priority=10,expiration,pushType='liveactivity'}){
  if(!this.configured)return Promise.resolve({status:0,reason:'no-key'});
  return new Promise(resolve=>{
   let req;
   try{
    req=this.session(env==='production'?'production':'sandbox').request({
     ':method':'POST',':path':`/3/device/${deviceToken}`,
     authorization:`bearer ${this.token()}`,
     'apns-push-type':pushType,'apns-topic':topic,'apns-priority':String(priority),
     ...(expiration?{'apns-expiration':String(expiration)}:{})
    });
   }catch(e){resolve({status:0,reason:e.code||e.message});return;}
   let status=0,body='';
   req.setEncoding('utf8');
   req.on('response',h=>{status=h[':status'];});
   req.on('data',d=>{body+=d;});
   req.on('end',()=>{let reason='';try{reason=body?JSON.parse(body).reason:'';}catch{}resolve({status,reason});});
   req.on('error',e=>resolve({status:0,reason:e.code||e.message}));
   req.setTimeout(15e3,()=>{req.close(http2.constants.NGHTTP2_CANCEL);resolve({status:0,reason:'timeout'});});
   req.end(JSON.stringify(payload));
  });
 }
 close(){for(const s of this.sessions.values())s.close();}
}

export const ATTRIBUTES_TYPE='CourseActivityAttributes';

// Builds the aps payload for a planned event.
export function payloadFor(event,{alert,now=Date.now()}){
 const aps={timestamp:Math.floor(now/1000),event:event.kind,'content-state':event.state};
 if(event.kind==='start'){
  aps['attributes-type']=ATTRIBUTES_TYPE;
  aps.attributes={chain:event.chain};
  aps.alert=alert;
  aps.sound='default';
 }
 if(event.stale)aps['stale-date']=event.stale;
 if(event.kind==='end')aps['dismissal-date']=event.dismissal;
 return {aps};
}
