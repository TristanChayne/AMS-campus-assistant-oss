import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {iosPublicConfig} from '../src/ios-public-config.mjs';
const release={version:'0.1.1',build:4,url:'https://testflight.apple.com/join/TESTONLY',notes:'仅测试'};
test('public iOS config defaults and independent release without DB or school data',async()=>{
 const env={DB:{prepare(){throw Error('No database access allowed')}},IOS_PUBLIC_CONFIG:JSON.stringify({schemaVersion:1,release,announcement:{id:'test',title:'测试',message:'测试公告'},secret:'MUST_NOT_APPEAR'})};
 const response=await worker.fetch(new Request('https://example.com/api/public/ios/config?platform=ios&build=3'),env);
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const data=await response.json();assert.equal(data.release.build,4);assert.equal(data.release.url,release.url);assert(!JSON.stringify(data).includes('MUST_NOT_APPEAR'));
 const empty=await worker.fetch(new Request('https://example.com/api/public/ios/config'),{});assert.deepEqual(await empty.json(),{schemaVersion:1,announcement:null,release:null});
});
test('reject Android/download/phishing URLs and malformed release or announcement',()=>{
 for(const url of ['https://www.pgyer.com/android','http://testflight.apple.com/join/test','https://testflight.apple.com.evil.example/test','https://user:password@testflight.apple.com/join/test'])assert.throws(()=>iosPublicConfig(JSON.stringify({schemaVersion:1,release:{...release,url}})));
 for(const build of [0,-1,'4',4.5,2147483648])assert.throws(()=>iosPublicConfig(JSON.stringify({schemaVersion:1,release:{...release,build}})));
 assert.throws(()=>iosPublicConfig('{'));
 assert.throws(()=>iosPublicConfig(JSON.stringify({schemaVersion:2})));
 assert.throws(()=>iosPublicConfig(JSON.stringify({schemaVersion:1,announcement:{id:'test',title:'测试',message:'测试',expiresAt:'invalid'}})));
 const allowed=iosPublicConfig(JSON.stringify({schemaVersion:1,release:{...release,url:'https://apps.apple.com/app/id123'}}));assert.equal(allowed.release.build,4);
});
