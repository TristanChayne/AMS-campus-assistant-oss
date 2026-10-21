const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('work/ios/session.js','utf8');
function launch(stored='',host='ams.xjtlu.edu.cn',main=true){
 class Storage{constructor(){this.items=new Map()}getItem(k){return this.items.get(String(k))??null}setItem(k,v){this.items.set(String(k),String(v))}removeItem(k){this.items.delete(String(k))}clear(){this.items.clear()}}
 const messages=[],sessionStorage=new Storage(),localStorage=new Storage();
 const window={webkit:{messageHandlers:{amsSession:{postMessage(v){messages.push(v)}}}}};window.top=main?window:{};
 vm.runInNewContext(source.replace('__AMS_SESSION__',JSON.stringify(stored)),{window,location:{protocol:'https:',hostname:host},Storage,sessionStorage});
 return {sessionStorage,localStorage,messages};
}
const user=JSON.stringify({token:'synthetic-test-token',userId:'synthetic-user',academicYear:'2026'});
let a=launch();a.sessionStorage.setItem('amsuserInfo',user);assert.equal(a.messages.at(-1),user);
let b=launch(a.messages.at(-1));assert.equal(b.sessionStorage.getItem('amsuserInfo'),user);
b.sessionStorage.setItem('selectedCourseDatas','[]');assert.equal(b.messages.length,1);
b.localStorage.clear();assert.equal(b.messages.length,1);
b.sessionStorage.clear();assert.equal(b.messages.at(-1),''); // School's 401 handler clears storage.
assert.equal(launch(b.messages.at(-1)).sessionStorage.getItem('amsuserInfo'),null);
let c=launch(user);c.sessionStorage.removeItem('amsuserInfo');assert.equal(c.messages.at(-1),'');
const rotated=JSON.stringify({token:'synthetic-rotated-token',userId:'synthetic-user'});
a.sessionStorage.setItem('amsuserInfo',rotated);
assert.equal(launch(a.messages.at(-1)).sessionStorage.getItem('amsuserInfo'),rotated);
assert.equal(launch(user,'uim.xjtlu.edu.cn').messages.length,0);
assert.equal(launch(user,'ams.xjtlu.edu.cn',false).messages.length,0);
assert.equal(launch('invalid-json').sessionStorage.getItem('amsuserInfo'),null);
console.log('PASS: session restoration in a fresh page, updates, logout/401 clearing, unrelated storage, origin/frame isolation');
