import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import {d1} from '../src/host.mjs';
import {demoRequest} from '../../ams-activation-tencent/src/review-demo.mjs';
import {b64,unb64,hash} from '../../ams-activation-tencent/src/worker.mjs';
import {openDb} from '../src/db.mjs';
import {Registry,migrateRegistry} from '../src/registry.mjs';
import {ReviewReminder,reviewPhase} from '../src/review-reminder.mjs';
const prefs={decided:true,enabled:true,island:true,notify:true,leadMin:15,merge:true,mutedCodes:[],upload:true};
function fixture(){
 const store=openDb(':memory:'),db=store.db;db.exec(readFileSync(new URL('../../ams-activation-tencent/schema.sql',import.meta.url),'utf8'));migrateRegistry(db);
 const registry=new Registry(db),clock={now:Date.parse('2026-10-14T02:00:00Z')},apns={configured:true,sent:[],async send(m){this.sent.push(m);return {status:200};}};
 const auth=fingerprint=>({id:createHash('sha256').update('review-code:'+fingerprint).digest('hex'),mode:'demo',grant:'review-code',device:fingerprint,exp:clock.now/1000+21600});
 const a=auth('a'.repeat(64)),b=auth('b'.repeat(64));
 db.prepare('INSERT INTO activation_codes(id,code_hash,created,bound_devices) VALUES(?,?,?,?)').run('review-code','fictional-only',1,'|'+a.device+'|'+b.device+'|');
 db.prepare('INSERT INTO demo_codes VALUES(?)').run('review-code');registry.claim({fingerprint:a.device,codeId:a.grant,now:clock.now});registry.claim({fingerprint:b.device,codeId:b.grant,now:clock.now});
 return {db,registry,clock,apns,a,b,service:new ReviewReminder({db,registry,apns,allowedBundles:['cn.xjtlu.ams.ios'],now:()=>clock.now})};
}
async function ready(f,auth,token){let r=await f.service.handle(auth,{op:'prefs',prefs});await f.service.handle(auth,{op:'activity',chain:r.chain,updateToken:token,apnsEnv:'production',bundleId:'cn.xjtlu.ams.ios'});return r;}
test('phase clocks match actual before/during/after and preserve exact sample text',()=>{
 const now=Date.parse('2026-10-14T02:00:35Z')/1000;
 for(const phase of ['before','during','after']){const s=reviewPhase(phase,now*1000);assert.equal(s.title,'Programming with C++');assert.equal(s.code,'SOE106TC');assert.equal(s.room,'DE-2001');assert.ok(s.end>s.start);if(phase==='before')assert.ok(s.start>now);if(phase==='during')assert.ok(s.start<now&&s.end>now);if(phase==='after')assert.ok(s.end<now);}
});
test('queued remote transition sends only owning reviewer token, never normal tables',async()=>{
 const f=fixture();await ready(f,f.a,'a'.repeat(64));await ready(f,f.b,'b'.repeat(64));
 const before=['devices','courses','prefs','events'].map(t=>f.db.prepare('SELECT COUNT(*) AS n FROM '+t).get().n);
 const request={op:'phase',phase:'during',delaySeconds:15,requestId:'phase-request-01'};
 let r=await f.service.handle(f.a,request);assert.equal(r.state.phase,'before');assert.equal(r.pushStatus,'queued');
 await f.service.handle(f.a,request);await assert.rejects(f.service.handle(f.a,{...request,phase:'after'}),e=>e.status===409);
 f.clock.now+=16000;await f.service.tick();assert.equal(f.apns.sent.length,1);assert.equal(f.apns.sent[0].deviceToken,'a'.repeat(64));assert.equal(f.apns.sent[0].payload.aps.event,'update');assert.equal(f.apns.sent[0].payload.aps['content-state'].phase,'during');
 r=await f.service.handle(f.b,{op:'state'});assert.equal(r.state.phase,'before');assert.deepEqual(['devices','courses','prefs','events'].map(t=>f.db.prepare('SELECT COUNT(*) AS n FROM '+t).get().n),before);
});
test('ordinary/expired/revoked grants and wrong chain/bundle cannot send',async()=>{
 const f=fixture();const r=await ready(f,f.a,'a'.repeat(64));
 for(const auth of [{...f.a,mode:'normal'},{...f.a,exp:0},{...f.a,device:'c'.repeat(64)}])await assert.rejects(f.service.handle(auth,{op:'state'}),e=>e.status===403);
 await assert.rejects(f.service.handle(f.a,{op:'activity',chain:'other',updateToken:'b'.repeat(64),apnsEnv:'production',bundleId:'cn.xjtlu.ams.ios'}),e=>e.status===409);
 await assert.rejects(f.service.handle(f.a,{op:'activity',chain:r.chain,updateToken:'a'.repeat(64),apnsEnv:'production',bundleId:'other.bundle'}),e=>e.status===400);
 await f.service.handle(f.a,{op:'phase',phase:'during',delaySeconds:15,requestId:'revoked-request-1'});
 const installation=f.registry.installationByFingerprint(f.a.device);f.db.prepare('UPDATE installations SET enabled=0 WHERE id=?').run(installation.id);f.clock.now+=16000;await f.service.tick();assert.equal(f.apns.sent.length,0);assert.equal(f.service.load(f.a.id),null);
});
test('cloud disable clears queued job/token; no-key is not successful delivery',async()=>{
 const f=fixture();await ready(f,f.a,'a'.repeat(64));await f.service.handle(f.a,{op:'phase',phase:'during',delaySeconds:15,requestId:'disabled-request-1'});
 await f.service.handle(f.a,{op:'prefs',prefs:{...prefs,upload:false}});f.apns.sent=[];f.clock.now+=16000;await f.service.tick();assert.equal(f.apns.sent.length,0);assert.equal(f.service.load(f.a.id).value.updateToken,null);
 await ready(f,f.a,'a'.repeat(64));f.apns.configured=false;const r=await f.service.handle(f.a,{op:'phase',phase:'during',delaySeconds:0,requestId:'no-key-request-1'});assert.equal(r.pushStatus,'no-key');assert.equal(r.pushReady,false);
 await assert.rejects(f.service.handle(f.a,{op:'phase',phase:'during',delaySeconds:15,requestId:'no-key-delay-req'}),e=>e.status===409);
});
test('end and restart replace chain; deleting one session preserves another',async()=>{
 const f=fixture();const old=await ready(f,f.a,'a'.repeat(64));await ready(f,f.b,'b'.repeat(64));
 await f.service.handle(f.a,{op:'phase',phase:'after',delaySeconds:0,requestId:'end-request-0001'});assert.equal(f.apns.sent[0].payload.aps.event,'end');
 const next=await f.service.handle(f.a,{op:'phase',phase:'before',delaySeconds:0,requestId:'restart-request-1'});assert.notEqual(next.chain,old.chain);assert.equal(next.pushReady,false);
 await f.service.handle(f.a,{op:'delete'});assert.equal(f.service.load(f.a.id),null);assert.ok(f.service.load(f.b.id));
});
test('authenticated demo API includes sports order/payment/ticket and rejects untrusted reminder requests',async()=>{
 const f=fixture(),secret='local-review-fixture',auth={...f.a,exp:Math.floor(Date.now()/1000)+21600};
 f.db.prepare('INSERT INTO demo_states(id,state) VALUES(?,?)').run(auth.id,JSON.stringify({attendance:[],leaves:[],bookings:[],receipts:[]}));
 const payload=Buffer.from(JSON.stringify(auth)).toString('base64url'),cookie='ams_demo='+payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
 const env={DB:d1(f.db),SESSION_SECRET:secret,REVIEW_REMINDER:(a,b)=>f.service.handle(a,b)};
 const h={b64,unb64,hash,json:(body,status=200)=>Response.json(body,{status})};
 async function call(path,body,headers={}){return demoRequest(new Request('https://ams.example/api/demo/'+path,{method:body?'POST':'GET',headers:{cookie,Origin:'https://ams.example','X-AMS-Demo':'1',...headers},...(body?{body:JSON.stringify(body)}:{})}),env,h);}
 assert.equal((await call('reminder',{op:'state'},{cookie:''})).status,401);assert.equal((await call('reminder',{op:'state'},{Origin:'https://other.example'})).status,403);
 const state=await (await call('state')).json();assert.ok(state.courses.every(c=>c.moduleCode==='SOE106TC'&&c.moduleTitle==='Programming with C++'&&c.room==='DE-2001'));
 const book={action:'sportsBook',venue:'badminton',date:state.today,start:'10:00',end:'11:00',requestId:'sports-book-request'};
 assert.equal((await call('action',book)).status,200);assert.equal((await call('action',book)).status,200);
 let sports=(await (await call('state')).json()).state.sports;assert.equal(sports.length,1);assert.equal(sports[0].paid,false);
 assert.equal((await call('action',{action:'sportsPay',id:sports[0].id,requestId:'sports-pay-request'})).status,200);
 sports=(await (await call('state')).json()).state.sports;assert.equal(sports[0].paid,true);assert.match(sports[0].ticket,/^AMS-DEMO-NOT-VALID:sports:/);
 assert.equal((await call('action',{action:'sportsCancel',id:sports[0].id,requestId:'sports-cancel-request'})).status,200);
 assert.equal((await (await call('state')).json()).state.sports[0].cancelled,true);assert.equal(f.apns.sent.length,0);
});
test('automatic boundaries and concurrent token/phase requests keep current reviewer state',async()=>{
 const f=fixture(),first=await ready(f,f.a,'a'.repeat(64));f.clock.now=first.state.start*1000+1000;await f.service.tick();assert.equal(f.service.load(f.a.id).value.state.phase,'during');
 f.clock.now=first.state.end*1000+1000;await f.service.tick();assert.equal(f.service.load(f.a.id).value.state.phase,'after');assert.equal(f.apns.sent.at(-1).payload.aps.event,'end');
 const before=await f.service.handle(f.a,{op:'phase',phase:'before',delaySeconds:0,requestId:'concurrent-reset-1'});
 await Promise.all([f.service.handle(f.a,{op:'phase',phase:'during',delaySeconds:0,requestId:'concurrent-phase-1'}),f.service.handle(f.a,{op:'activity',chain:before.chain,updateToken:'a'.repeat(64),apnsEnv:'production',bundleId:'cn.xjtlu.ams.ios'})]);
 const row=f.service.load(f.a.id);assert.equal(row.value.state.phase,'during');assert.equal(row.value.updateToken,'a'.repeat(64));assert.equal(f.service.inflight.size,0);
});
