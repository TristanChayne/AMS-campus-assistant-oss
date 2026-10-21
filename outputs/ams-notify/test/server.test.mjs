import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {generateKeyPairSync,verify} from 'node:crypto';
import {writeFileSync,mkdtempSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDb} from '../src/db.mjs';
import {createApp,tick} from '../src/server.mjs';
import {Apns,payloadFor} from '../src/apns.mjs';
import {cstMillis} from '../src/schedule.mjs';

const BUNDLE='cn.xjtlu.ams.ios';
const ID='device-0123456789abcdef',SECRET='s'.repeat(40);
const T=hm=>cstMillis('2026-10-14',hm);

async function setup(clock){
 const store=openDb(':memory:');
 const server=http.createServer(createApp({store,allowedBundles:[BUNDLE],now:()=>clock.now}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/notify`;
 const call=async(method,path,body,auth=true)=>{
  const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(auth?{'x-ams-device':ID,authorization:`Bearer ${SECRET}`}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,body:await r.json()};
 };
 return {store,server,call};
}

class FakeApns{constructor(){this.sent=[];}send(m){this.sent.push(m);return Promise.resolve({status:200});}}

test('register requires consent and valid fields; secret protects device',async()=>{
 const clock={now:T('07:00')},{server,call}=await setup(clock);
 try{
  assert.equal((await call('POST','/register',{deviceId:ID,secret:SECRET,platform:'ios',bundleId:BUNDLE,apnsEnv:'sandbox'},false)).status,400);
  assert.equal((await call('POST','/register',{consent:true,deviceId:ID,secret:SECRET,platform:'ios',bundleId:'evil.app',apnsEnv:'sandbox'},false)).status,400);
  assert.equal((await call('POST','/register',{consent:true,deviceId:ID,secret:SECRET,platform:'ios',bundleId:BUNDLE,apnsEnv:'sandbox'},false)).status,200);
  assert.equal((await call('POST','/register',{consent:true,deviceId:ID,secret:'x'.repeat(40),platform:'ios',bundleId:BUNDLE,apnsEnv:'sandbox'},false)).status,409);
  const r=await fetch(server.address()?`http://127.0.0.1:${server.address().port}/api/notify/prefs`:'',{method:'PUT',headers:{'x-ams-device':ID,authorization:`Bearer ${'x'.repeat(40)}`},body:'{}'});
  assert.equal(r.status,401);
 }finally{server.close();}
});

test('full flow: timetable -> start push -> update token -> updates -> end; delete wipes data',async()=>{
 const clock={now:T('07:00')},{store,server,call}=await setup(clock);
 try{
  await call('POST','/register',{consent:true,deviceId:ID,secret:SECRET,platform:'ios',bundleId:BUNDLE,apnsEnv:'sandbox'},false);
  assert.equal((await call('PUT','/token',{startToken:'ab'.repeat(32)})).status,200);
  const r=await call('PUT','/timetable',{courses:[{key:'k1',date:'2026-10-14',start:'10:00',end:'11:50',title:'高等数学',code:'MTH101',room:'SA169'},{key:'bad',date:'14-10',start:'x',end:'y'}]});
  assert.deepEqual([r.body.accepted,r.body.pending],[1,3]);
  const apns=new FakeApns();
  assert.equal(await tick({store,apns,now:T('09:44')}),0);
  assert.equal(await tick({store,apns,now:T('09:45')}),1);
  const start=apns.sent[0];
  assert.equal(start.deviceToken,'ab'.repeat(32));
  assert.equal(start.topic,`${BUNDLE}.push-type.liveactivity`);
  assert.equal(start.payload.aps.event,'start');
  assert.equal(start.payload.aps['attributes-type'],'CourseActivityAttributes');
  assert.equal(start.payload.aps['content-state'].room,'SA169');
  assert.equal(await tick({store,apns,now:T('09:46')}),0,'no duplicate');
  // Replan after start must not resend start.
  await call('PUT','/prefs',{leadMin:10});
  assert.equal(await tick({store,apns,now:T('09:50')}),0);
  // Update needs the activity token reported by the phone.
  await call('PUT','/activity',{chain:'k1',updateToken:'cd'.repeat(32)});
  await tick({store,apns,now:T('10:00')});
  assert.equal(apns.sent.at(-1).payload.aps['content-state'].phase,'during');
  assert.equal(apns.sent.at(-1).deviceToken,'cd'.repeat(32));
  await tick({store,apns,now:T('11:50')});
  assert.equal(apns.sent.at(-1).payload.aps.event,'end');
  assert.equal(apns.sent.length,3);
  assert.equal((await call('DELETE','/device')).status,200);
  assert.deepEqual(store.counts(),{devices:0,courses:0,pending:0});
 }finally{server.close();}
});

test('user-ended chain stops pushes; missing token is recorded without sending',async()=>{
 const clock={now:T('07:00')},{store,server,call}=await setup(clock);
 try{
  await call('POST','/register',{consent:true,deviceId:ID,secret:SECRET,platform:'ios',bundleId:BUNDLE,apnsEnv:'sandbox'},false);
  await call('PUT','/timetable',{courses:[{key:'k1',date:'2026-10-14',start:'10:00',end:'11:00'},{key:'k2',date:'2026-10-14',start:'14:00',end:'15:00'}]});
  const apns=new FakeApns();
  await tick({store,apns,now:T('09:45')});
  assert.equal(apns.sent.length,0,'no start token yet');
  await call('PUT','/activity',{chain:'k2',ended:true});
  await call('PUT','/token',{startToken:'ab'.repeat(32)});
  await tick({store,apns,now:T('13:45')});
  assert.equal(apns.sent.length,0);
 }finally{server.close();}
});

class ScriptedApns{constructor(statuses){this.statuses=statuses;this.sent=[];}send(m){this.sent.push(m);const s=this.statuses.shift()??200;return Promise.resolve({status:s,reason:s===200?'':s===410?'Unregistered':s===400?'BadDeviceToken':'ServiceUnavailable'});}}
async function started(clock){
 const env=await setup(clock);
 await env.call('POST','/register',{consent:true,deviceId:ID,secret:SECRET,platform:'ios',bundleId:BUNDLE,apnsEnv:'sandbox'},false);
 await env.call('PUT','/token',{startToken:'ab'.repeat(32)});
 await env.call('PUT','/timetable',{courses:[{key:'k1',date:'2026-10-14',start:'10:00',end:'11:50',title:'高等数学',code:'MTH101',room:'SA169'}]});
 return env;
}

test('late update token: the current state is sent as soon as the token arrives',async()=>{
 const clock={now:T('07:00')},{store,server,call}=await started(clock);
 try{
  const apns=new FakeApns();
  await tick({store,apns,now:T('09:45')});
  assert.equal(apns.sent.at(-1).payload.aps.event,'start');
  await tick({store,apns,now:T('10:00')});
  assert.equal(apns.sent.length,1,'no update token yet: waits instead of failing');
  clock.now=T('10:00')+30e3;
  const r=await call('PUT','/activity',{chain:'k1',updateToken:'cd'.repeat(32)});
  assert.equal(r.body.push,false,'reports that APNs is not configured in tests');
  await tick({store,apns,now:T('10:00')+31e3});
  const last=apns.sent.at(-1);
  assert.equal(last.payload.aps.event,'update');assert.equal(last.payload.aps['content-state'].phase,'during');assert.equal(last.deviceToken,'cd'.repeat(32));
  await tick({store,apns,now:T('11:50')});
  assert.equal(apns.sent.at(-1).payload.aps.event,'end');
  assert.equal(apns.sent.length,3,'the stale during retry was replaced, not sent twice');
 }finally{server.close();}
});

test('APNs 503 is retried with backoff; 410 is final and clears the token',async()=>{
 const clock={now:T('07:00')},{store,server}=await started(clock);
 try{
  const apns=new ScriptedApns([503,200]);
  await tick({store,apns,now:T('09:45')});
  await tick({store,apns,now:T('09:45')+10e3});
  assert.equal(apns.sent.length,1,'backoff respected');
  await tick({store,apns,now:T('09:45')+31e3});
  assert.equal(apns.sent.length,2,'retried after backoff');
  await tick({store,apns,now:T('09:46')});
  assert.equal(apns.sent.length,2,'no resend after success');
 }finally{server.close();}
 const c2={now:T('07:00')},e2=await started(c2);
 try{
  const apns=new ScriptedApns([410]);
  await tick({store:e2.store,apns,now:T('09:45')});
  await tick({store:e2.store,apns,now:T('09:47')});
  assert.equal(apns.sent.length,1,'410 not retried');
  assert.equal(e2.store.device(ID).start_token,null);
 }finally{e2.server.close();}
});

test('a missed update is dropped once a later boundary is due; a late start uses the current state',async()=>{
 const clock={now:T('07:00')},{store,server,call}=await started(clock);
 try{
  const apns=new FakeApns();
  // Start was never possible (no token) until class had begun: it goes out with the during state.
  store.updateDevice(ID,{start_token:null});
  await tick({store,apns,now:T('09:45')});
  store.updateDevice(ID,{start_token:'ab'.repeat(32)});
  await tick({store,apns,now:T('10:01')});
  const start=apns.sent.find(s=>s.payload.aps.event==='start');
  assert.equal(start.payload.aps['content-state'].phase,'during');
  assert(!apns.sent.some(s=>s.payload.aps.event==='update'),'the during update is superseded by the start that already carries it');
 }finally{server.close();}
});

test('daily backup is idempotent and keeps the newest copies',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bk-'));
 const store=openDb(join(dir,'db.sqlite'));
 for(let d=0;d<9;d++)assert.equal(store.backup(join(dir,'backup'),T('12:00')+d*86400e3,7),true);
 assert.equal(store.backup(join(dir,'backup'),T('12:00')+8*86400e3,7),false);
 assert.equal(readdirSync(join(dir,'backup')).length,7);
});

test('APNs JWT is a valid ES256 signature and payload shapes',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});
 const dir=mkdtempSync(join(tmpdir(),'apns-'));
 writeFileSync(join(dir,'k.p8'),privateKey.export({type:'pkcs8',format:'pem'}));
 const apns=new Apns({keyPath:join(dir,'k.p8'),keyId:'KEY1234567',teamId:'TEAM123456'});
 const [h,p,s]=apns.token(1e12).split('.');
 assert.deepEqual(JSON.parse(Buffer.from(h,'base64url')),{alg:'ES256',kid:'KEY1234567'});
 assert.deepEqual(JSON.parse(Buffer.from(p,'base64url')),{iss:'TEAM123456',iat:1e9});
 assert.ok(verify('sha256',Buffer.from(`${h}.${p}`),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url')));
 const end=payloadFor({kind:'end',state:{phase:'after'},dismissal:123},{alert:null,now:1e12});
 assert.equal(end.aps['dismissal-date'],123);assert.equal(end.aps.alert,undefined);
 assert.equal(new Apns({}).configured,false);
});
