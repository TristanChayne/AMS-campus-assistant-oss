import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {openDb} from '../src/db.mjs';
import {createHost} from '../src/host.mjs';
import {checkMessage,linkMessage} from '../src/client.mjs';
import {migrateRegistry} from '../src/registry.mjs';
import {cstMillis} from '../src/schedule.mjs';
import * as worker from '../../ams-activation-tencent/src/worker.mjs';
import {iosPublicConfig} from '../../ams-activation-tencent/src/ios-public-config.mjs';

const {b64,unb64,passwordHash}=worker;
const ORIGIN='https://ams.example';
const rsa={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256',modulusLength:2048,publicExponent:new Uint8Array([1,0,1])};
const enc=new TextEncoder();
const serverKey=await crypto.subtle.generateKey(rsa,true,['sign','verify']);
const SECRETS={SIGNING_KEY:b64(await crypto.subtle.exportKey('pkcs8',serverKey.privateKey)),CODE_PEPPER:'test-pepper',SESSION_SECRET:'test-session-secret'};
const sign=async(key,text)=>b64(await crypto.subtle.sign(rsa,key.privateKey,enc.encode(text)));
const spki=async key=>b64(await crypto.subtle.exportKey('spki',key.publicKey));

class FakeApns{constructor(configured=true){this.configured=configured;this.keyId='KEY1234567';this.teamId='TEAM987654';this.sent=[];this.result={status:200};}send(m){this.sent.push(m);return Promise.resolve(typeof this.result==='function'?this.result(m):this.result);}close(){}}

async function setup({secrets=SECRETS,apns=new FakeApns()}={}){
 const store=openDb(':memory:');
 store.db.exec(readFileSync(new URL('../../ams-activation-tencent/schema.sql',import.meta.url),'utf8'));
 const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
 store.db.prepare('INSERT INTO admin_credentials VALUES (?,?,?,?,1)').run('owner','admin',await passwordHash('admin-password',salt),salt);
 const clock={now:cstMillis('2026-10-14','08:00')};
 const app=createHost({db:store.db,store,apns,worker,secrets,origin:ORIGIN,allowedBundles:['cn.xjtlu.ams.ios'],proxyKey:'proxy-secret-value',
  validateIosRelease:release=>iosPublicConfig(JSON.stringify({schemaVersion:1,release,announcement:null})).release,now:()=>clock.now});
 const server=http.createServer(app.handler);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 let cookie='';
 const call=async(method,path,body,{origin=ORIGIN,headers={}}={})=>{
  const r=await fetch(base+path,{method,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(method!=='GET'?{origin}:{}),...(cookie?{cookie}:{}),...headers},body:body!==undefined?JSON.stringify(body):undefined});
  const text=await r.text();let json;try{json=JSON.parse(text);}catch{json=text;}
  return {status:r.status,body:json,headers:r.headers};
 };
 const login=async()=>{const r=await call('POST','/api/admin/login',{username:'admin',password:'admin-password'});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];};
 const newCode=async(maxUses=2)=>(await call('POST','/api/admin/codes',{note:'测试码',maxUses})).body;
 const activate=async(key,code)=>{const r=await call('POST','/api/activate',{code,publicKey:await spki(key),proof:await sign(key,'AMS-ACTIVATE-1\n'+code)});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.grant;};
 const legacyCheck=async(key,grant)=>{const nonce='n'.repeat(32);const r=await call('POST','/api/check',{grant,nonce,publicKey:await spki(key),proof:await sign(key,'AMS-CHECK-1\n'+grant+'\n'+nonce)});return r;};
 const check=async(key,grant,{platform='android',account={name:null,revision:0},nonce='c'.repeat(32),extra={}}={})=>call('POST','/api/client/check',{grant,nonce,platform,account,publicKey:await spki(key),proof:await sign(key,checkMessage({grant,nonce,platform,account,appVersion:'0.15.0 (80)',model:'Pixel',bundleId:'cn.local.ams',readMessageIds:extra.readMessageIds})),appVersion:'0.15.0 (80)',model:'Pixel',bundleId:'cn.local.ams',...extra});
 const status=s=>{const [p,sig]=s.split('.');return {data:JSON.parse(new TextDecoder().decode(unb64(p))),p,sig};};
 return {store,app,server,call,login,newCode,activate,legacyCheck,check,status,clock,apns,close:()=>server.close()};
}

const BODY_META={appVersion:'0.15.0 (80)',model:'Pixel',bundleId:'cn.local.ams'};
const newKey=()=>crypto.subtle.generateKey(rsa,true,['sign','verify']);

test('activation claims an installation per install key; device and code disable are independent',async()=>{
 const t=await setup();
 try{
  await t.login();
  const code=await t.newCode(3);
  const a=await newKey(),b=await newKey();
  const ga=await t.activate(a,code.code);
  t.clock.now+=60e3;
  const gb=await t.activate(b,code.code);
  assert.equal(await t.activate(a,code.code),ga,'retry keeps grant and quota');
  let devices=(await t.call('GET','/api/admin/devices')).body;
  assert.equal(devices.total,2);
  assert.ok(devices.items.every(d=>/^AMSD-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(d.id)&&d.activation.codeId===code.id&&d.activation.state==='active'&&d.platform===null&&d.lastSeenAt===null));
  assert.notEqual(devices.items[0].activation.activatedAt,devices.items[1].activation.activatedAt,'activatedAt is per installation, not the shared issued time');
  assert.equal(JSON.stringify(devices).includes('secret'),false);
  assert.equal((await t.call('GET','/api/admin/codes')).body.codes[0].used_count,2);
  const idA=t.store.db.prepare('SELECT id FROM installations WHERE fingerprint=?').get(t.status(ga).data.device).id;
  assert.equal((await t.call('PATCH',`/api/admin/devices/${idA}`,{enabled:false})).status,422,'confirmation required');
  const patched=await t.call('PATCH',`/api/admin/devices/${idA}`,{enabled:false,confirmed:true});
  assert.equal(patched.body.device.activation.state,'disabled');
  assert.equal(t.status((await t.legacyCheck(a,ga)).body.status).data.enabled,false,'legacy check reports device disable');
  assert.equal(t.status((await t.legacyCheck(b,gb)).body.status).data.enabled,true,'same code, other device unaffected');
  // Activating again is refused before any quota is used; resetting / enabling the code does not lift the device disable.
  const again=await t.call('POST','/api/activate',{code:code.code,publicKey:await spki(a),proof:await sign(a,'AMS-ACTIVATE-1\n'+code.code)});
  assert.deepEqual([again.status,again.body.error.code],[403,'DEVICE_DISABLED']);
  await t.call('POST','/api/admin/update',{id:code.id,action:'reset'});
  await t.call('POST','/api/admin/update',{id:code.id,action:'enable'});
  assert.equal(t.status((await t.legacyCheck(a,ga)).body.status).data.enabled,false);
  // Code disable affects all its devices.
  await t.call('PATCH',`/api/admin/devices/${idA}`,{enabled:true,confirmed:true});
  await t.call('POST','/api/admin/update',{id:code.id,action:'disable'});
  assert.equal(t.status((await t.check(b,gb)).body.status).data.enabled,false);
  devices=(await t.call('GET','/api/admin/devices')).body;
  assert.ok(devices.items.every(d=>d.activation.state==='disabled'&&d.activation.codeEnabled===false&&d.activation.deviceEnabled===true));
 }finally{t.close();}
});

test('per-open check: signed state carries account, release and announcements; newer revision wins; proof binds metadata',async()=>{
 const t=await setup();
 try{
  await t.login();
  const code=await t.newCode(1),key=await newKey(),grant=await t.activate(key,code.code);
  const r=await t.check(key,grant,{platform:'ios',account:{name:'Student.One23',revision:3}});
  assert.equal(r.status,200,JSON.stringify(r.body));
  const s=t.status(r.body.status);
  assert.equal(await crypto.subtle.verify(rsa,serverKey.publicKey,unb64(s.sig),enc.encode(s.p)),true);
  assert.deepEqual([s.data.v,s.data.enabled,s.data.nonce,s.data.account.name,s.data.account.revision],[2,true,'c'.repeat(32),'Student.One23',3]);
  const id=s.data.installationId;
  await t.check(key,grant,{platform:'ios',account:{name:'Old.Account',revision:2}});
  let d=(await t.call('GET',`/api/admin/devices/${id}`)).body.device;
  assert.deepEqual([d.accountName,d.accountRevision,d.platform,d.appVersion,d.model,d.bundleId],['Student.One23',3,'ios','0.15.0 (80)','Pixel','cn.local.ams']);
  await t.check(key,grant,{platform:'ios',account:{name:null,revision:4}});
  d=(await t.call('GET',`/api/admin/devices/${id}`)).body.device;
  assert.equal(d.accountName,null);
  // Metadata not covered by the proof is rejected.
  const nonce='d'.repeat(32),account={name:null,revision:4};
  const bad=await t.call('POST','/api/client/check',{grant,nonce,platform:'ios',account,publicKey:await spki(key),proof:await sign(key,checkMessage({grant,nonce,platform:'ios',account,...BODY_META})),...BODY_META,model:'Other'});
  assert.equal(bad.status,400);
  // Android-only announcement is not in the iOS check; release info is per platform and signed.
  const a=(await t.call('POST','/api/admin/announcements',{title:'安卓公告',body:'正文',platform:'android',publishAt:null,expiresAt:null,clientRequestId:'req-android-1'})).body.announcement;
  await t.call('POST',`/api/admin/announcements/${a.id}/publish`,{revision:a.revision,confirmed:true,idempotencyKey:'pub-android-1'});
  await t.call('PUT','/api/admin/ios-config',{release:{version:'0.2.0',build:5,url:'https://testflight.apple.com/join/abc',notes:'说明'}});
  const ios=t.status((await t.check(key,grant,{platform:'ios',account:{name:null,revision:4}})).body.status).data;
  assert.deepEqual([ios.announcements.length,ios.release.ios.build,ios.release.android.versionName],[0,5,'0.12.7']);
  const android=t.status((await t.check(key,grant,{platform:'android',account:{name:null,revision:4}})).body.status).data;
  assert.equal(android.announcements[0].title,'安卓公告');
  assert.equal(/\.\d{3}Z$/.test(android.announcements[0].publishedAt),false,'second precision for Swift decoders');
 }finally{t.close();}
});

test('admin API: auth, origin, 404/405, ios release validation, masked key ids',async()=>{
 const t=await setup();
 try{
  assert.equal((await t.call('GET','/api/admin/overview')).status,401);
  await t.login();
  assert.equal((await t.call('POST','/api/admin/announcements',{title:'a',body:'b',platform:'all'},{origin:'https://evil.example'})).status,403);
  const o=(await t.call('GET','/api/admin/overview')).body;
  assert.deepEqual([o.activationCount,o.deviceCount,o.services.apns.status],[0,0,'ready']);
  assert.equal((await t.call('GET','/api/admin/nope')).status,404);
  assert.equal((await t.call('PUT','/api/admin/devices/x',{})).status,405);
  const bad=await t.call('POST','/api/admin/ios-config',{release:{version:'1',build:1,url:'https://www.pgyer.com/x',notes:''}});
  assert.deepEqual([bad.status,bad.body.error.code],[422,'INVALID']);
  const apns=(await t.call('GET','/api/admin/apns')).body;
  assert.deepEqual([apns.keyId,apns.teamId],['••••4567','••••7654']);
  assert.equal((await t.call('GET','/api/public/ios/config')).body.release,null);
 }finally{t.close();}
});

test('reminder registration: proof links installation, legacy registration kept, link never downgraded, disable enforced',async()=>{
 const t=await setup();
 try{
  await t.login();
  const code=await t.newCode(1),key=await newKey(),grant=await t.activate(key,code.code);
  const deviceId='device-0123456789abcdef',secret='s'.repeat(40);
  const reg={consent:true,deviceId,secret,platform:'ios',bundleId:'cn.xjtlu.ams.ios',apnsEnv:'sandbox'};
  const legacy=await t.call('POST','/api/notify/register',{...reg,deviceId:'device-legacy-0000000001'});
  assert.deepEqual([legacy.status,legacy.body.installationId],[200,undefined],'builds without link still register (unlinked)');
  const nonce='l'.repeat(32),link={grant,nonce,publicKey:await spki(key),proof:await sign(key,linkMessage({grant,nonce,deviceId}))};
  assert.equal((await t.call('POST','/api/notify/register',{...reg,link:{...link,proof:await sign(key,linkMessage({grant,nonce,deviceId:'device-other-00000000'}))}})).status,400,'proof binds device id');
  const ok=await t.call('POST','/api/notify/register',{...reg,link});
  assert.equal(ok.status,200);
  const id=ok.body.installationId;
  assert.equal((await t.call('POST','/api/notify/register',reg)).body.installationId,id,'omitting link keeps the existing link');
  const auth={'x-ams-device':deviceId,authorization:`Bearer ${secret}`};
  // Account revision gate: no account yet -> upload refused; current revision accepted; stale refused.
  await t.check(key,grant,{platform:'ios',account:{name:'Student.A',revision:1}});
  await t.call('PUT','/api/notify/token',{startToken:'ab'.repeat(32)},{headers:auth});
  const course={key:'k1',date:'2026-10-14',start:'10:00',end:'11:50',title:'高等数学',code:'MTH101',room:'SA169'};
  assert.equal((await t.call('PUT','/api/notify/timetable',{courses:[course]},{headers:auth})).status,409,'build without accountRevision cannot overwrite a protocol-2 installation');
  assert.equal((await t.call('PUT','/api/notify/timetable',{courses:[course],accountRevision:1,coverage:{from:'2026-10-14',to:'2026-10-16'}},{headers:auth})).status,200);
  let detail=(await t.call('GET',`/api/admin/devices/${id}`)).body;
  assert.deepEqual([detail.device.accountName,detail.device.courseCount,detail.device.coverageUntil,detail.courses[0].start,detail.courses[0].end,detail.device.tokenState],['Student.A',1,'2026-10-16','10:00','11:50','ready']);
  // Switch to account B: the server drops A's timetable and pending reminders; a late upload for A is refused.
  await t.check(key,grant,{platform:'ios',account:{name:'Student.B',revision:2}});
  detail=(await t.call('GET',`/api/admin/devices/${id}`)).body;
  assert.deepEqual([detail.device.courseCount,detail.device.pendingCount,detail.device.coverageUntil],[0,0,null]);
  const late=await t.call('PUT','/api/notify/timetable',{courses:[course],accountRevision:1},{headers:auth});
  assert.deepEqual([late.status,late.body.code],[409,'STALE_ACCOUNT']);
  assert.equal((await t.call('PUT','/api/notify/timetable',{courses:[course],accountRevision:2},{headers:auth})).status,200);
  assert.equal((await t.call('GET','/api/admin/devices?state=legacy_pending')).body.total,1);
  // Disable: no pushes, no writes, no re-registration; withdrawal still works.
  await t.call('PATCH',`/api/admin/devices/${id}`,{enabled:false,confirmed:true});
  t.clock.now=cstMillis('2026-10-14','09:45');
  await t.app.runTick(t.clock.now);
  assert.equal(t.apns.sent.length,0,'no push for disabled installation');
  const events=(await t.call('GET',`/api/admin/devices/${id}`)).body.events;
  assert.ok(events.some(e=>e.reason==='设备已停用'&&e.accountName==='Student.B'),'record keeps the account at send time');
  const write=await t.call('PUT','/api/notify/prefs',{enabled:true},{headers:auth});
  assert.deepEqual([write.status,write.body.code],[403,'DEVICE_DISABLED']);
  assert.equal((await t.call('POST','/api/notify/register',{...reg,link})).status,403);
  assert.equal((await t.call('POST','/api/notify/register',reg)).status,403,'omitting the link does not bypass a disable');
  // Admin delete removes uploaded data only; the installation (and its disable) stays.
  assert.equal((await t.call('DELETE',`/api/admin/devices/${id}`)).status,200);
  detail=(await t.call('GET',`/api/admin/devices/${id}`)).body;
  assert.deepEqual([detail.device.courseCount,detail.device.reminder,detail.device.activation.state],[0,null,'disabled']);
  assert.equal((await t.call('DELETE',`/api/admin/devices/${id}`)).status,200,'idempotent');
 }finally{t.close();}
});

test('announcements: idempotent draft, publish / schedule, no edit while live, withdraw then edit, new public id, optional push limits',async()=>{
 const t=await setup();
 try{
  await t.login();
  const bad=await t.call('POST','/api/admin/announcements',{title:'',body:'x',platform:'all'});
  assert.deepEqual([bad.status,Object.keys(bad.body.error.fields)],[422,['title']]);
  const later=new Date(t.clock.now+3600e3).toISOString();
  let a=(await t.call('POST','/api/admin/announcements',{title:'维护通知',body:'今晚维护',platform:'all',publishAt:later,expiresAt:null,clientRequestId:'req-0000001'})).body.announcement;
  const dup=(await t.call('POST','/api/admin/announcements',{title:'维护通知',body:'今晚维护',platform:'all',publishAt:later,expiresAt:null,clientRequestId:'req-0000001'})).body.announcement;
  assert.deepEqual([a.status,dup.id],['draft',a.id],'lost create response does not duplicate the draft');
  assert.equal((await t.call('POST',`/api/admin/announcements/${a.id}/publish`,{revision:a.revision})).status,422,'confirmation and key required');
  const pub=(await t.call('POST',`/api/admin/announcements/${a.id}/publish`,{revision:a.revision,confirmed:true,idempotencyKey:'pub-0000001'})).body.announcement;
  assert.equal(pub.status,'scheduled');
  assert.equal((await t.call('POST',`/api/admin/announcements/${a.id}/publish`,{revision:a.revision,confirmed:true,idempotencyKey:'pub-0000001'})).body.announcement.id,a.id,'same key returns first result before revision check');
  assert.equal((await t.call('GET','/api/public/ios/config')).body.announcement,null);
  t.clock.now+=3600e3;
  await t.app.runTick(t.clock.now);
  assert.equal((await t.call('GET','/api/admin/announcements')).body.items[0].status,'published','server publishes when due');
  const first=(await t.call('GET','/api/public/ios/config')).body.announcement;
  assert.deepEqual([first.title,first.message],['维护通知','今晚维护']);
  assert.equal((await t.call('PATCH',`/api/admin/announcements/${a.id}`,{revision:pub.revision,body:'x'})).status,409,'no edit while live');
  assert.equal((await t.call('DELETE',`/api/admin/announcements/${a.id}`)).status,409);
  a=(await t.call('POST',`/api/admin/announcements/${a.id}/withdraw`,{revision:pub.revision,confirmed:true,idempotencyKey:'wd-0000001'})).body.announcement;
  assert.equal(a.status,'withdrawn');
  assert.equal((await t.call('GET','/api/public/ios/config')).body.announcement,null);
  a=(await t.call('PATCH',`/api/admin/announcements/${a.id}`,{revision:a.revision,body:'改期到明晚',publishAt:null})).body.announcement;
  a=(await t.call('POST',`/api/admin/announcements/${a.id}/publish`,{revision:a.revision,confirmed:true,idempotencyKey:'pub-0000002'})).body.announcement;
  const second=(await t.call('GET','/api/public/ios/config')).body.announcement;
  assert.notEqual(second.id,first.id,'republish gets a new public identity');
  assert.equal(second.message,'改期到明晚');
  // Optional push: Android-only and long bodies refused; never sent by default.
  const long=(await t.call('POST','/api/admin/announcements',{title:'长公告',body:'字'.repeat(501),platform:'ios',publishAt:null,expiresAt:null})).body.announcement;
  const r=await t.call('POST',`/api/admin/announcements/${long.id}/publish`,{revision:long.revision,confirmed:true,idempotencyKey:'pub-0000003',push:true,audience:'test'});
  assert.deepEqual([r.status,(await t.call('GET','/api/admin/announcements')).body.items.find(x=>x.id===long.id).status],[422,'draft'],'refused before publishing anything');
  assert.equal(t.apns.sent.length,0);
  const ad=(await t.call('POST','/api/admin/announcements',{title:'a',body:'b',platform:'android',publishAt:null,expiresAt:null})).body.announcement;
  assert.equal((await t.call('POST',`/api/admin/announcements/${ad.id}/publish`,{revision:ad.revision,confirmed:true,idempotencyKey:'pub-0000004',push:true,audience:'all'})).body.error.code,'UNSUPPORTED_PLATFORM');
 }finally{t.close();}
});

test('iOS APNs notifications: idempotent draft and submit, Apple acceptance, retry of failed objects',async()=>{
 const t=await setup();
 try{
  await t.login();
  assert.equal((await t.call('POST','/api/admin/messages',{title:'t',body:'b',channel:'notification',platform:'all',audience:'all',scheduleAt:null})).body.error.code,'UNSUPPORTED_PLATFORM');
  let m=(await t.call('POST','/api/admin/messages',{title:'服务提醒',body:'今晚维护',channel:'notification',platform:'ios',audience:'test',scheduleAt:null,clientRequestId:'msg-req-01'})).body.message;
  assert.equal((await t.call('POST','/api/admin/messages',{title:'服务提醒',body:'今晚维护',channel:'notification',platform:'ios',audience:'test',scheduleAt:null,clientRequestId:'msg-req-01'})).body.message.id,m.id);
  const submit=(key,rev=m.revision)=>t.call('POST',`/api/admin/messages/${m.id}/submit`,{revision:rev,confirmed:true,idempotencyKey:key});
  assert.equal((await submit('key-00000001')).body.error.code,'NO_RECIPIENTS');
  const code=await t.newCode(1),key=await newKey(),grant=await t.activate(key,code.code);
  // D-021: the push token comes with the per-open check; no course reminder registration is needed.
  const meta={appVersion:'0.1.0 (5)',model:'iPhone17,1',bundleId:'cn.xjtlu.ams.ios'},account={name:'Student.T',revision:1},nonce='m'.repeat(32);
  const forged=await t.call('POST','/api/client/check',{grant,nonce,platform:'ios',account,publicKey:await spki(key),proof:await sign(key,checkMessage({grant,nonce,platform:'ios',account,...meta,alertToken:'ab'.repeat(32),apnsEnv:'production'})),...meta,alertToken:'cd'.repeat(32),apnsEnv:'production'});
  assert.equal(forged.status,400,'proof covers the push token');
  const ck=await t.call('POST','/api/client/check',{grant,nonce,platform:'ios',account,publicKey:await spki(key),proof:await sign(key,checkMessage({grant,nonce,platform:'ios',account,...meta,alertToken:'cd'.repeat(32),apnsEnv:'production'})),...meta,alertToken:'cd'.repeat(32),apnsEnv:'production'});
  assert.equal(ck.status,200);
  const installationId=t.status(ck.body.status).data.installationId;
  const dv=(await t.call('GET',`/api/admin/devices/${installationId}`)).body.device;
  assert.deepEqual([dv.alertTokenState,dv.apnsEnv,dv.reminder],['ready','production',null]);
  await t.call('PATCH',`/api/admin/devices/${installationId}`,{test:true});
  const first=await submit('key-00000002');
  assert.deepEqual([first.status,first.body.message.status,first.body.message.recipientCount],[202,'queued',1]);
  const repeat=await submit('key-00000002',999);
  assert.deepEqual([repeat.status,repeat.body.message.id],[202,m.id],'same key returns first result before revision check');
  assert.equal((await submit('key-00000003',first.body.message.revision)).status,409);
  t.apns.result={status:503,reason:'ServiceUnavailable'};
  for(let i=0;i<5;i++){await t.app.runTick(t.clock.now);t.clock.now+=11*60e3;}
  m=(await t.call('GET',`/api/admin/messages/${m.id}`)).body.message;
  assert.deepEqual([m.status,m.failedCount,m.retryable],['failed',1,true]);
  assert.deepEqual([t.apns.sent[0].pushType,t.apns.sent[0].topic],['alert','cn.xjtlu.ams.ios']);
  assert.deepEqual(t.apns.sent[0].payload.aps.alert,{title:'服务提醒',body:'今晚维护'});
  t.apns.result={status:200};
  assert.equal((await t.call('POST',`/api/admin/messages/${m.id}/retry`,{revision:m.revision,confirmed:true,idempotencyKey:'retry-0001'})).status,202);
  await t.app.runTick(t.clock.now);
  m=(await t.call('GET',`/api/admin/messages/${m.id}`)).body.message;
  assert.deepEqual([m.status,m.acceptedCount],['accepted_by_apns',1]);
  const records=(await t.call('GET','/api/admin/apns')).body.records;
  assert.ok(records.some(r=>r.kind==='notification'&&r.status==='accepted_by_apns'&&r.accountName==='Student.T'));
  assert.equal(JSON.stringify(records).includes('cd'.repeat(32)),false,'tokens never returned');
 }finally{t.close();}
});

test('without migrated secrets activation/admin answer 503 JSON and APNs-less submit is refused',async()=>{
 const t=await setup({secrets:{SIGNING_KEY:'',CODE_PEPPER:'',SESSION_SECRET:''}});
 try{
  const r=await t.call('GET','/api/admin/profile');
  assert.deepEqual([r.status,r.body.error.code],[503,'SERVICE_NOT_CONNECTED']);
  assert.equal((await t.call('GET','/api/notify/health')).body.ok,true);
 }finally{t.close();}
 const u=await setup({apns:new FakeApns(false)});
 try{
  await u.login();
  const m=(await u.call('POST','/api/admin/messages',{title:'a',body:'b',platform:'ios',audience:'all',scheduleAt:null})).body.message;
  const r=await u.call('POST',`/api/admin/messages/${m.id}/submit`,{revision:m.revision,confirmed:true,idempotencyKey:'key-0000000x'});
  assert.deepEqual([r.status,r.body.error.code],[503,'APNS_NOT_CONFIGURED']);
 }finally{u.close();}
});

test('trusted proxy header sets client IP only with the proxy key',async()=>{
 const t=await setup();
 try{
  // 5 failed logins per IP per minute: spoofed header without key shares the socket IP limit.
  for(let i=0;i<5;i++)await t.call('POST','/api/admin/login',{username:'admin',password:'wrong'},{headers:{'x-ams-client-ip':`10.0.0.${i}`}});
  assert.equal((await t.call('POST','/api/admin/login',{username:'admin',password:'wrong'},{headers:{'x-ams-client-ip':'10.0.0.9'}})).status,429);
  assert.equal((await t.call('POST','/api/admin/login',{username:'admin',password:'wrong'},{headers:{'x-ams-client-ip':'10.0.0.9','x-ams-proxy-key':'proxy-secret-value'}})).status,401);
 }finally{t.close();}
});

test('Android inbox: no APNs dependency, signed device-scoped read acknowledgements, capability and audience gating',async()=>{
 const t=await setup({apns:new FakeApns(false)});
 try{
  await t.login();
  const code=await t.newCode(4),a=await newKey(),b=await newKey(),old=await newKey(),ios=await newKey();
  const ga=await t.activate(a,code.code),gb=await t.activate(b,code.code),go=await t.activate(old,code.code),gi=await t.activate(ios,code.code);
  const check=(key,grant,ids=[])=>t.check(key,grant,{extra:{readMessageIds:ids}});
  const ia=t.status((await check(a,ga)).body.status).data.installationId;
  const ib=t.status((await check(b,gb)).body.status).data.installationId;
  await t.check(old,go);await t.check(ios,gi,{platform:'ios'});
  await t.call('PATCH',`/api/admin/devices/${ia}`,{test:true});
  const create=async(extra={})=>(await t.call('POST','/api/admin/messages',{title:'App内维护消息',body:'打开后可读',channel:'notification',platform:'android',audience:'test',scheduleAt:null,...extra})).body.message;
  let m=await create({clientRequestId:'android-message-001'});
  assert.equal((await create({clientRequestId:'android-message-001'})).id,m.id,'idempotent draft');
  const publish=async(message,key)=>t.call('POST',`/api/admin/messages/${message.id}/submit`,{revision:message.revision,confirmed:true,idempotencyKey:key});
  const submitted=await publish(m,'android-submit-001');
  assert.deepEqual([submitted.status,submitted.body.message.status,submitted.body.message.recipientCount,submitted.body.message.acceptedCount],[202,'available_in_app',1,null]);
  assert.equal((await publish(m,'android-submit-001')).body.message.id,m.id,'idempotent publication');
  assert.deepEqual(t.status((await check(b,gb)).body.status).data.messages,[],'non-test device excluded');
  const response=await check(a,ga),state=t.status(response.body.status);
  assert.equal(await crypto.subtle.verify(rsa,serverKey.publicKey,unb64(state.sig),enc.encode(state.p)),true,'inbox is inside verified status');
  assert.deepEqual(state.data.messages.map(x=>x.id),[m.id]);
  assert.equal(state.data.messages[0].expiresAt,null);
  m=(await t.call('GET',`/api/admin/messages/${m.id}`)).body.message;
  assert.deepEqual([m.availableCount,m.offeredCount,m.readCount],[0,1,0],'returning content is not a read receipt');
  const nonce='z'.repeat(32),account={name:null,revision:0};
  const forged=await t.call('POST','/api/client/check',{grant:ga,nonce,platform:'android',account,...BODY_META,publicKey:await spki(a),proof:await sign(a,checkMessage({grant:ga,nonce,platform:'android',account,...BODY_META,readMessageIds:[]})),readMessageIds:[m.id]});
  assert.equal(forged.status,400,'read ids cannot be changed outside the proof');
  await check(b,gb,[m.id]);
  assert.equal((await t.call('GET',`/api/admin/messages/${m.id}`)).body.message.readCount,0,'other install cannot mark target read');
  assert.deepEqual(t.status((await check(a,ga,[m.id])).body.status).data.messages,[]);
  await check(a,ga,[m.id]);
  assert.equal((await t.call('GET',`/api/admin/messages/${m.id}`)).body.message.readCount,1,'read acknowledgement is idempotent');
  const all=await create({audience:'all'});
  assert.equal((await publish(all,'android-submit-002')).body.message.recipientCount,2,'legacy Android and iOS do not count as inbox recipients');
  await t.call('PATCH',`/api/admin/devices/${ia}`,{enabled:false,confirmed:true});
  const disabled=t.status((await check(a,ga,[all.id])).body.status).data;
  assert.equal(disabled.enabled,false);assert.deepEqual(disabled.messages,[],'disabled device receives no content');
  await t.call('PATCH',`/api/admin/devices/${ia}`,{enabled:true,confirmed:true});
  assert.equal(t.status((await check(a,ga)).body.status).data.messages[0].id,all.id,'reenabled device can fetch its pending message');
  const expiring=await create({expiresAt:new Date(t.clock.now+1000).toISOString()});
  await publish(expiring,'android-submit-003');t.clock.now+=2000;
  assert(!t.status((await check(a,ga)).body.status).data.messages.some(x=>x.id===expiring.id),'expired message excluded');
  const planned=await create({scheduleAt:new Date(t.clock.now+60e3).toISOString()});
  assert.equal((await publish(planned,'android-submit-004')).body.message.status,'scheduled');
  assert(!t.status((await check(a,ga)).body.status).data.messages.some(x=>x.id===planned.id));
  t.clock.now+=61e3;await t.app.runTick(t.clock.now);
  assert(t.status((await check(a,ga)).body.status).data.messages.some(x=>x.id===planned.id),'scheduled publication becomes available');
  assert.equal(t.apns.sent.length,0,'Android publication and retrieval never call APNs');
  assert(!(await t.call('GET','/api/admin/apns')).body.records.some(r=>r.deviceId===ia||r.deviceId===ib),'Android receipts do not contaminate Apple push records');
 }finally{t.close();}
});

test('Android inbox drains batches without repeats and rejects malformed acknowledgement requests',async()=>{
 const t=await setup();
 try{
  await t.login();const code=await t.newCode(1),key=await newKey(),grant=await t.activate(key,code.code);
  const check=ids=>t.check(key,grant,{extra:{readMessageIds:ids}});
  await check([]);
  for(let i=0;i<12;i++){
   const m=(await t.call('POST','/api/admin/messages',{title:`消息${i}`,body:'批次检查',channel:'notification',platform:'android',audience:'all',scheduleAt:null})).body.message;
   assert.equal((await t.call('POST',`/api/admin/messages/${m.id}/submit`,{revision:m.revision,confirmed:true,idempotencyKey:`batch-key-${i}`})).status,202);
  }
  const first=t.status((await check([])).body.status).data.messages;
  assert.equal(first.length,10);
  const ids=first.map(m=>m.id),next=t.status((await check(ids)).body.status).data.messages;
  assert.equal(next.length,2);assert(next.every(m=>!ids.includes(m.id)));
  assert.deepEqual(t.status((await check([...ids,...next.map(m=>m.id)])).body.status).data.messages,[]);
  assert.equal((await check(Array(101).fill(ids[0]))).status,400);
  assert.equal((await check(['msg-bad\nvalue'])).status,400);
  assert.equal((await check(null)).status,400);
 }finally{t.close();}
});

test('Android inbox migration is additive/idempotent and preserves existing installation authorization/account',async()=>{
 const t=await setup();
 try{
  await t.login();const code=await t.newCode(1),key=await newKey(),grant=await t.activate(key,code.code);
  const id=t.status((await t.check(key,grant,{account:{name:'Migration.Student',revision:2}})).body.status).data.installationId;
  await t.call('PATCH',`/api/admin/devices/${id}`,{enabled:false,confirmed:true});
  const before=t.store.db.prepare('SELECT * FROM installations WHERE id=?').get(id);
  t.store.db.exec('ALTER TABLE installations DROP COLUMN inbox_supported');
  migrateRegistry(t.store.db);migrateRegistry(t.store.db);
  assert.deepEqual(t.store.db.prepare('SELECT * FROM installations WHERE id=?').get(id),before);
 }finally{t.close();}
});
