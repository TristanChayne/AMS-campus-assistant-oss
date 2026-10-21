import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);

test('cutover forwarder: passes API calls with proxy key and client IP, redirects admin, refuses other paths',async()=>{
 const seen=[];
 const server=http.createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{seen.push({method:req.method,url:req.url,headers:req.headers,body:b});res.writeHead(409,{'content-type':'application/json; charset=utf-8','set-cookie':'x=1'});res.end('{"message":"激活码无效"}');});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 process.env.AMS_TARGET=`http://127.0.0.1:${server.address().port}`;process.env.AMS_PROXY_KEY='k'.repeat(32);
 const {main}=require('../proxy/index.js');
 try{
  const r=await main({httpMethod:'POST',path:'/api/activate',headers:{'Content-Type':'application/json',Cookie:'ams_admin=x'},body:'{"code":"AMS-1"}',requestContext:{sourceIp:'1.2.3.4'}});
  assert.deepEqual([r.statusCode,JSON.parse(r.body).message,r.headers['set-cookie']],[409,'激活码无效',undefined]);
  assert.deepEqual([seen[0].url,seen[0].body,seen[0].headers['x-ams-client-ip'],seen[0].headers['x-ams-proxy-key'],seen[0].headers.cookie],['/api/activate','{"code":"AMS-1"}','1.2.3.4','k'.repeat(32),undefined]);
  await main({httpMethod:'GET',path:'/api/public/ios/config',queryStringParameters:{platform:'ios'},headers:{}});
  assert.equal(seen[1].url,'/api/public/ios/config?platform=ios');
  const admin=await main({httpMethod:'GET',path:'/admin',headers:{}});
  assert.deepEqual([admin.statusCode,admin.headers.Location],[302,`${process.env.AMS_TARGET}/admin/`]);
  assert.equal((await main({httpMethod:'GET',path:'/other',headers:{}})).statusCode,404);
 }finally{server.close();}
});
