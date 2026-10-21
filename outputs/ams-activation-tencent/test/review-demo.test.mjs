import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{b64,hash,issueGrant} from '../src/worker.mjs';
const rsa={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256',modulusLength:2048,publicExponent:new Uint8Array([1,0,1])},enc=new TextEncoder();
const server=await crypto.subtle.generateKey(rsa,true,['sign','verify']),device=await crypto.subtle.generateKey(rsa,true,['sign','verify']),other=await crypto.subtle.generateKey(rsa,true,['sign','verify']);
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
const env={SIGNING_KEY:b64(await crypto.subtle.exportKey('pkcs8',server.privateKey)),SESSION_SECRET:'unit-test-secret',CODE_PEPPER:'unit-test-pepper',DB:{prepare(sql){const q=db.prepare(sql);return {bind(...args){return {first:async()=>q.get(...args),run:async()=>q.run(...args),all:async()=>({results:q.all(...args)})}}}}},ASSETS:{fetch:async()=>new Response('isolated asset')}};
const publicKey=b64(await crypto.subtle.exportKey('spki',device.publicKey));const deviceId=Buffer.from(await crypto.subtle.digest('SHA-256',Buffer.from(publicKey,'base64url'))).toString('hex');
db.prepare('INSERT INTO activation_codes(id,code_hash,created,device,issued,bound_devices) VALUES (?,?,?,?,?,?)').run('demo','hash',1,deviceId,1,'|'+deviceId+'|');db.prepare('INSERT INTO demo_codes VALUES (?)').run('demo');
const grant=await issueGrant(env,{id:'demo',device:deviceId,issued:1});let cookie;
async function call(path,data,headers={}){const response=await worker.fetch(new Request('https://demo.example'+path,{method:data===undefined?'GET':'POST',headers:{...(data?{'Content-Type':'application/json',Origin:'https://demo.example','X-AMS-Demo':'1'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:data?JSON.stringify(data):undefined}),env);return {response,data:response.headers.get('Content-Type')?.includes('json')?await response.json():await response.text()};}
async function bootstrap(key=device,token=grant,age=0){const timestamp=String(Math.floor(Date.now()/1000)+age),nonce=b64(crypto.getRandomValues(new Uint8Array(24)));return {grant:token,publicKey:b64(await crypto.subtle.exportKey('spki',key.publicKey)),timestamp,nonce,proof:b64(await crypto.subtle.sign(rsa,key.privateKey,enc.encode('AMS-DEMO-1\n'+token+'\n'+timestamp+'\n'+nonce)))};}
const act=data=>call('/api/demo/action',{requestId:crypto.randomUUID(),...data});
test('device-bound demo session, replay/age checks, ordinary grants denied',async()=>{
 assert.equal((await call('/api/demo/state')).response.status,401);
 assert.equal((await call('/api/demo/bootstrap',await bootstrap(other))).response.status,401);
 assert.equal((await call('/api/demo/bootstrap',await bootstrap(device,grant,-120))).response.status,401);
 const body=await bootstrap(),ok=await call('/api/demo/bootstrap',body);assert.equal(ok.response.status,303);cookie=ok.response.headers.get('set-cookie').split(';')[0];assert.match(ok.response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await call('/api/demo/bootstrap',body)).response.status,409);
 const native=await call('/api/demo/bootstrap',await bootstrap(),{Accept:'application/json'});assert.equal(native.response.status,200);assert.equal(native.data.ok,true);
 db.prepare('INSERT INTO activation_codes(id,code_hash,created,bound_devices) VALUES (?,?,?,?)').run('normal','normalhash',1,'|'+deviceId+'|');const normal=await issueGrant(env,{id:'normal',device:deviceId,issued:1});assert.equal((await call('/api/demo/bootstrap',await bootstrap(device,normal))).response.status,403);
 assert.equal((await call('/api/demo/assets/content.html')).response.status,200);
});
test('persistent sign, complete leave/attachment/cancel and booking/ticket/cancel operations; no school fetch',async()=>{
 const before=db.prepare('SELECT * FROM activation_codes').all();const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('School network forbidden')};
 try{
 const saved=db.prepare('SELECT id,state FROM demo_states').get();const stale=JSON.parse(saved.state);stale.anchor='2020-01-01';db.prepare('UPDATE demo_states SET state=? WHERE id=?').run(JSON.stringify(stale),saved.id);
 const m=(await call('/api/demo/state')).data,c=m.courses[0];assert.equal(m.state.anchor,m.today);assert.equal(c.date,m.today);assert.equal(m.state.leaves.length,0);assert.equal(m.seed.student,'演示同学');
 assert.equal((await act({action:'sign',courseId:c.id,code:'invalid'})).response.status,400);
 const sign={action:'sign',courseId:c.id,code:'123456',requestId:crypto.randomUUID()};assert.equal((await call('/api/demo/action',sign)).response.status,200);assert.equal((await call('/api/demo/action',sign)).response.status,200);assert.equal((await call('/api/demo/action',{...sign,code:'654321'})).response.status,409);
 const form={startDate:c.date,endDate:c.date,leaveType:'Illness',leaveReason:'Demonstration only',fileList:[{originalFileName:'proof.png',content:'data:image/png;base64,aGVsbG8='}]};assert.equal((await act({action:'leave',form,selected:['invalid']})).response.status,400);assert.equal((await act({action:'leave',form,selected:[c.id]})).response.status,200);
 let state=(await call('/api/demo/state')).data.state;assert.equal(state.attendance.length,1);assert.equal(state.leaves.length,1);assert.equal(state.leaves[0].fileList[0].content,form.fileList[0].content);assert.equal((await act({action:'cancelLeave',id:state.leaves[0].id})).response.status,200);
 for(const kind of ['seat','room','bus']){
 const resource=m.seed.resources.find(r=>r.kind===kind),booking={action:'book',kind,date:m.today,resourceId:resource?.id,start:kind==='bus'?'07:30':'10:00',end:'11:00',people:kind==='room'?2:1,direction:'TC-SIP'};
 assert.equal((await act(booking)).response.status,200);assert.equal((await act(booking)).response.status,409);
 }
 state=(await call('/api/demo/state')).data.state;assert.equal(state.bookings.length,3);assert(state.bookings.every(r=>r.ticket.startsWith('AMS-DEMO-NOT-VALID:')));assert.equal((await act({action:'cancelBooking',id:state.bookings[0].id})).response.status,200);
 assert.equal((await call('/api/demo/action',{requestId:crypto.randomUUID(),action:'sign',courseId:c.id,code:'123456'},{Origin:'https://evil.example'})).response.status,403);
 assert.deepEqual(db.prepare('SELECT * FROM activation_codes').all(),before);
 }finally{globalThis.fetch=originalFetch;}
});
test('revocation stops existing demo sessions and copied/tampered cookies fail',async()=>{
 const saved=cookie;cookie=cookie.slice(0,-5)+'xxxxx';assert.equal((await call('/api/demo/state')).response.status,401);cookie=saved;db.prepare('UPDATE activation_codes SET enabled=0 WHERE id=?').run('demo');assert.equal((await call('/api/demo/state')).response.status,401);
});
