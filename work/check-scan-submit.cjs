const fs=require('fs'),vm=require('vm'),assert=require('assert');
let calls=0,received='',path='/home';
const home={$options:{name:'home'},$route:{get path(){return path}},onSubmit(code){calls++;received=code},$children:[]};
const root={$options:{name:'root'},$route:home.$route,$children:[home]};home.$parent=root;home.$root=root;
const child={$options:{name:'schedule'},$parent:home,$root:root,$children:[]};home.$children=[child];
const nodes=[{__vue__:child},{__vue__:root}];
assert(!nodes.some(n=>n.__vue__.$options.name==='home')); // Reproduce the previous direct-DOM lookup failure.
const context={window:{},location:{protocol:'https:',hostname:'ams.xjtlu.edu.cn',pathname:'/studenth5/'},document:{querySelectorAll(){return nodes}}};
vm.runInNewContext(fs.readFileSync('outputs/ams-android/app/src/main/assets/ams-submit-scan.js','utf8'),context);
const submit=context.window.__amsSubmitScan;
assert.equal(submit('MOCK_ONLY'),'submitted');assert.equal(calls,1);assert.equal(received,'MOCK_ONLY');
path='/leave';assert.equal(submit('MOCK_ONLY'),'unavailable');assert.equal(calls,1);
path='/home';home._inactive=true;assert.equal(submit('MOCK_ONLY'),'unavailable');assert.equal(calls,1);
home._inactive=false;home._isDestroyed=true;assert.equal(submit('MOCK_ONLY'),'unavailable');assert.equal(calls,1);
home._isDestroyed=false;home.onSubmit=()=>{calls++;throw new Error('mock')};assert.equal(submit('MOCK_ONLY'),'handler-error');assert.equal(calls,2);
context.location.hostname='example.com';assert.equal(submit('MOCK_ONLY'),'unavailable');assert.equal(calls,2);
console.log('PASS: reproduced direct-DOM failure; nested/cyclic Vue lookup; one handler call; wrong route, inactive/destroyed component and origin blocked; handler errors distinguished; no network submission');
