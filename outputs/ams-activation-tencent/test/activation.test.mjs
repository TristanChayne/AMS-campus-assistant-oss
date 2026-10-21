import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{b64,unb64,deviceProof,passwordHash} from '../src/worker.mjs';

const rsa={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256',modulusLength:2048,publicExponent:new Uint8Array([1,0,1])};
const server=await crypto.subtle.generateKey(rsa,true,['sign','verify']);
const device=await crypto.subtle.generateKey(rsa,true,['sign','verify']);
const other=await crypto.subtle.generateKey(rsa,true,['sign','verify']);
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
const adminSalt=b64(crypto.getRandomValues(new Uint8Array(16)));db.prepare('INSERT INTO admin_credentials VALUES (?,?,?,?,1)').run('owner','owner@example.com',await passwordHash('test-password',adminSalt),adminSalt);
const env={DB:{prepare(sql){const statement=db.prepare(sql);return {bind(...args){return {first:async()=>statement.get(...args)||null,all:async()=>({results:statement.all(...args)}),run:async()=>({meta:statement.run(...args)})};},all:async()=>({results:statement.all()})};}},SIGNING_KEY:b64(await crypto.subtle.exportKey('pkcs8',server.privateKey)),SESSION_SECRET:'test-session-secret-not-production',CODE_PEPPER:'test-pepper-not-production',ADMIN_EMAIL:'owner@example.com',ADMIN_PASSWORD:'test-password',ASSETS:{fetch:async()=>new Response('asset')}};
let cookie;
async function request(path,data,auth=true,origin='https://licenses.example') {
 const headers={};if(data!==undefined){headers['Content-Type']='application/json';headers.Origin=origin;}if(auth&&cookie)headers.Cookie=cookie;
 const r=await worker.fetch(new Request('https://licenses.example'+path,{method:data!==undefined?'POST':'GET',headers,body:data!==undefined?JSON.stringify(data):undefined}),env);return {r,data:await r.json()};
}
async function proof(key,code){return {code,publicKey:b64(await crypto.subtle.exportKey('spki',key.publicKey)),proof:b64(await crypto.subtle.sign(rsa,key.privateKey,new TextEncoder().encode('AMS-ACTIVATE-1\n'+code)))};}
test('admin authentication, CSRF, one-use activation and safe retry',async()=>{
 assert.equal((await request('/api/admin/codes')).r.status,401);
 assert.equal((await request('/api/admin/login',{email:env.ADMIN_EMAIL,password:'wrong'},false)).r.status,401);
 const login=await request('/api/admin/login',{email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD},false);assert.equal(login.r.status,200);
 cookie=login.r.headers.get('set-cookie').split(';')[0];assert.match(login.r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await request('/api/admin/codes',{note:'x'},true,'https://evil.example')).r.status,403);
 const created=await request('/api/admin/codes',{note:'手机'});assert.match(created.data.code,/^AMS-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/);
 const info=await proof(device,created.data.code);const first=await request('/api/activate',info,false);assert.equal(first.r.status,200);
 const [payload,signature]=first.data.grant.split('.');assert.equal(await crypto.subtle.verify(rsa,server.publicKey,unb64(signature),new TextEncoder().encode(payload)),true);
 const data=JSON.parse(new TextDecoder().decode(unb64(payload)));assert.equal(data.device,await deviceProof(info.publicKey,info.code,info.proof));assert.equal(data.app,'cn.local.ams');assert.equal(data.exp,undefined);
 const retry=await request('/api/activate',info,false);assert.equal(retry.data.grant,first.data.grant);
 const stolen=await request('/api/activate',await proof(other,created.data.code),false);assert.equal(stolen.r.status,409);
 assert.equal((await request('/api/activate',{...info,proof:info.proof.slice(0,-4)+'AAAA'},false)).r.status,400);
 await request('/api/admin/update',{id:created.data.id,action:'disable'});assert.equal((await request('/api/activate',info,false)).r.status,409);
 await request('/api/admin/update',{id:created.data.id,action:'enable'});await request('/api/admin/update',{id:created.data.id,action:'reset'});
 assert.equal((await request('/api/activate',await proof(other,created.data.code),false)).r.status,200);
 const records=await request('/api/admin/codes');assert.equal(records.data.codes[0].note,'手机');assert.equal('code_hash' in records.data.codes[0],false);
 assert.notEqual(db.prepare('SELECT code_hash FROM activation_codes').get().code_hash,created.data.code);
 const parts=cookie.split('=')[1].split('.');cookie='ams_admin='+parts[0]+'.'+parts[1].slice(0,-4)+'AAAA';assert.equal((await request('/api/admin/codes')).r.status,401);
});
test('rate limit and expired session',async()=>{
 db.prepare('INSERT INTO rate_limits VALUES (?,?,?)').run('expired-test',1,1);
 for(let i=0;i<6;i++)await request('/api/admin/login',{email:env.ADMIN_EMAIL,password:'wrong'},false);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE key=?').get('expired-test').n,0);
 assert.equal((await request('/api/admin/login',{email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD},false)).r.status,429);
 const payload=b64(new TextEncoder().encode(JSON.stringify({email:env.ADMIN_EMAIL,exp:1}))),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 cookie='ams_admin='+payload+'.'+b64(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));
 assert.equal((await request('/api/admin/codes')).r.status,401);
});

test('manual account changes, password hashing, invalidation and activation preservation',async()=>{
 db.exec('DELETE FROM rate_limits');
 const before=db.prepare('SELECT * FROM activation_codes ORDER BY id').all();
 let login=await request('/api/admin/login',{username:'owner@example.com',password:'test-password'},false);assert.equal(login.r.status,200);cookie=login.r.headers.get('set-cookie').split(';')[0];const oldCookie=cookie;
 assert.equal((await request('/api/admin/credentials',{username:'changed',currentPassword:'wrong',newPassword:'new-password-123'})).r.status,400);
 assert.equal((await request('/api/admin/credentials',{username:'changed',currentPassword:'test-password',newPassword:'short'})).r.status,400);
 assert.equal((await request('/api/admin/credentials',{username:'changed',currentPassword:'test-password',newPassword:'new-password-123'},true,'https://evil.example')).r.status,403);
 assert.equal((await request('/api/admin/credentials',{username:'tristan',currentPassword:'test-password',newPassword:'new-password-123'})).r.status,200);
 cookie=oldCookie;assert.equal((await request('/api/admin/codes')).r.status,401);
 assert.equal((await request('/api/admin/login',{username:'owner@example.com',password:'test-password'},false)).r.status,401);
 login=await request('/api/admin/login',{username:'tristan',password:'new-password-123'},false);assert.equal(login.r.status,200);cookie=login.r.headers.get('set-cookie').split(';')[0];
 assert.equal((await request('/api/admin/profile')).data.username,'tristan');
 assert.equal((await request('/api/admin/credentials',{username:'chayne',currentPassword:'new-password-123',newPassword:''})).r.status,200);
 login=await request('/api/admin/login',{username:'chayne',password:'new-password-123'},false);assert.equal(login.r.status,200);
 assert.deepEqual(db.prepare('SELECT * FROM activation_codes ORDER BY id').all(),before);
 const row=db.prepare('SELECT * FROM admin_credentials').get();assert.notEqual(row.password_hash,'new-password-123');assert.equal(row.revision,3);
});

test('quota increases, idempotent retry, encrypted codes and conditional deletion',async()=>{
 db.exec('DELETE FROM rate_limits');
 const login=await request('/api/admin/login',{username:'chayne',password:'new-password-123'},false);cookie=login.r.headers.get('set-cookie').split(';')[0];
 const created=await request('/api/admin/codes',{note:'multi',maxUses:2});assert.equal(created.r.status,200);
 const a=await proof(device,created.data.code),b=await proof(other,created.data.code);
 assert.equal((await request('/api/activate',a,false)).r.status,200);assert.equal((await request('/api/activate',a,false)).r.status,200);
 assert.equal((await request('/api/activate',b,false)).r.status,200);
 const third=await crypto.subtle.generateKey(rsa,true,['sign','verify']),c=await proof(third,created.data.code);
 assert.equal((await request('/api/activate',c,false)).r.status,409);
 let row=(await request('/api/admin/codes')).data.codes.find(c=>c.id===created.data.id);assert.equal(row.used_count,2);assert.equal(row.remaining,0);assert.equal(row.code,created.data.code);
 const cipher=db.prepare('SELECT code_cipher FROM activation_codes WHERE id=?').get(created.data.id).code_cipher;assert(!cipher.includes(created.data.code));
 assert.equal((await request('/api/admin/update',{id:row.id,action:'quota',maxUses:1})).r.status,409);
 assert.equal((await request('/api/admin/update',{id:row.id,action:'quota',maxUses:3})).r.status,200);assert.equal((await request('/api/activate',c,false)).r.status,200);
 assert.equal((await request('/api/admin/update',{id:row.id,action:'disable'})).r.status,200);assert.equal((await request('/api/admin/update',{id:row.id,action:'delete'})).r.status,409);
 await request('/api/admin/update',{id:row.id,action:'reset'});assert.equal((await request('/api/admin/update',{id:row.id,action:'delete'})).r.status,409);
 const unused=await request('/api/admin/codes',{note:'delete'});assert.equal((await request('/api/admin/update',{id:unused.data.id,action:'delete'})).r.status,409);await request('/api/admin/update',{id:unused.data.id,action:'disable'});assert.equal((await request('/api/admin/update',{id:unused.data.id,action:'delete'})).r.status,200);
 db.prepare('UPDATE activation_codes SET code_cipher=NULL WHERE id=?').run(row.id);assert.equal((await request('/api/admin/update',{id:row.id,action:'saveCode',code:unused.data.code})).r.status,409);assert.equal((await request('/api/admin/update',{id:row.id,action:'saveCode',code:created.data.code})).r.status,200);
 assert.equal((await request('/api/admin/codes',undefined,false)).r.status,401);
});

test('signed periodic check, remote interval and version settings, explicit disable only',async()=>{
 db.exec('DELETE FROM rate_limits');
 const login=await request('/api/admin/login',{username:'chayne',password:'new-password-123'},false);cookie=login.r.headers.get('set-cookie').split(';')[0];
 assert.equal((await request('/api/admin/settings',undefined,false)).r.status,401);
 const settings={intervalDays:7,versionCode:33,versionName:'0.12.9',downloadUrl:'https://www.pgyer.com/amsxiaoyuanzhushou',notes:'更新测试'};
 assert.equal((await request('/api/admin/settings',settings,true,'https://evil.example')).r.status,403);
 assert.equal((await request('/api/admin/settings',{...settings,intervalDays:0})).r.status,400);
 assert.equal((await request('/api/admin/settings',{...settings,downloadUrl:'javascript:alert(1)'})).r.status,400);
 assert.equal((await request('/api/admin/settings',settings)).r.status,200);
 const created=await request('/api/admin/codes',{note:'periodic'});const activated=await request('/api/activate',await proof(device,created.data.code),false);
 const grant=activated.data.grant,nonce=b64(crypto.getRandomValues(new Uint8Array(24)));
 const data={grant,nonce,publicKey:b64(await crypto.subtle.exportKey('spki',device.publicKey)),proof:b64(await crypto.subtle.sign(rsa,device.privateKey,new TextEncoder().encode('AMS-CHECK-1\n'+grant+'\n'+nonce)))};
 const decode=async result=>{assert.equal(result.r.status,200);const [p,s]=result.data.status.split('.');assert(await crypto.subtle.verify(rsa,server.publicKey,unb64(s),new TextEncoder().encode(p)));return JSON.parse(new TextDecoder().decode(unb64(p)));};
 let status=await decode(await request('/api/check',data,false));assert.equal(status.enabled,true);assert.equal(status.nonce,nonce);assert.equal(status.intervalDays,7);assert.equal(status.release.versionCode,33);
 await request('/api/admin/settings',{...settings,intervalDays:14});status=await decode(await request('/api/check',data,false));assert.equal(status.intervalDays,14);
 assert.equal((await request('/api/check',{...data,nonce:b64(crypto.getRandomValues(new Uint8Array(24)))},false)).r.status,400);
 await request('/api/admin/update',{id:created.data.id,action:'disable'});status=await decode(await request('/api/check',data,false));assert.equal(status.enabled,false);
 db.prepare('DELETE FROM activation_codes WHERE id=?').run(created.data.id);assert.equal((await request('/api/check',data,false)).r.status,503);
});
