import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='https://ams-activation-d7gv2f67vbfbacb39-1500641748.ap-shanghai.app.tcloudbase.com';
const secrets=JSON.parse(fs.readFileSync('E:/DevTools/Cache/AmsActivationSecrets/secrets.json','utf8'));
let cookie='';
async function api(path,data){const headers={};if(data){headers['Content-Type']='application/json';headers.Origin=base;}if(cookie)headers.Cookie=cookie;const r=await fetch(base+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(20000)});const json=await r.json();return {r,json};}
assert.equal((await api('/api/admin/codes')).r.status,401);
const login=await api('/api/admin/login',{email:'2689232641@qq.com',password:secrets.ADMIN_PASSWORD});assert.equal(login.r.status,200);cookie=login.r.headers.get('set-cookie').split(';')[0];
const created=await api('/api/admin/codes',{note:'自动验证 · 已停用'});assert.equal(created.r.status,200);
const rsa={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256',modulusLength:2048,publicExponent:new Uint8Array([1,0,1])};
const key=await crypto.subtle.generateKey(rsa,true,['sign','verify']);
const b64=b=>Buffer.from(b).toString('base64url');
async function proof(k){return {code:created.json.code,publicKey:b64(await crypto.subtle.exportKey('spki',k.publicKey)),proof:b64(await crypto.subtle.sign(rsa,k.privateKey,new TextEncoder().encode('AMS-ACTIVATE-1\n'+created.json.code)))};}
const first=await api('/api/activate',await proof(key));assert.equal(first.r.status,200,JSON.stringify(first.json));
const retry=await api('/api/activate',await proof(key));assert.equal(retry.json.grant,first.json.grant);
const other=await crypto.subtle.generateKey(rsa,true,['sign','verify']);assert.equal((await api('/api/activate',await proof(other))).r.status,409);
const publicKey=await crypto.subtle.importKey('spki',Buffer.from(fs.readFileSync('E:/DevTools/Cache/AmsActivationSecrets/public-key.txt','utf8'),'base64url'),rsa,false,['verify']);
const [payload,sig]=first.json.grant.split('.');assert(await crypto.subtle.verify(rsa,publicKey,Buffer.from(sig,'base64url'),new TextEncoder().encode(payload)));
assert.equal((await api('/api/admin/update',{id:created.json.id,action:'disable'})).r.status,200);
console.log('PASS Tencent: login, atomic device binding, signed grant, identical retry, other install rejected, test code disabled.');
