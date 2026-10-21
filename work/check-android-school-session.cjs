const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const source=read('work/android-school-session.js');
assert.equal(read('outputs/ams-android/app/src/main/assets/school-session.js'),source,'generated asset matches source (line endings normalized)');
const template=read('work/android-school-session-restore.html');
assert.equal(read('outputs/ams-android/app/src/main/assets/school-session-restore.html'),template,'generated restore page matches source');
function page(host='ams.xjtlu.edu.cn',{main=true,protocol='https:',bridge=true}={}){
 class Storage{constructor(){this.items=new Map()}getItem(k){return this.items.get(String(k))??null}setItem(k,v){this.items.set(String(k),String(v))}removeItem(k){this.items.delete(String(k))}clear(){this.items.clear()}}
 const calls=[],sessionStorage=new Storage(),localStorage=new Storage();
 const window={};window.top=main?window:{};
 if(bridge)window.AmsSchoolSession={changed(){calls.push(['changed'])},expired(t){calls.push(['expired',t])}};
 const context={window,location:{protocol,hostname:host},Storage,sessionStorage,localStorage};
 return {calls,sessionStorage,localStorage,run(){vm.runInNewContext(source,context);}};
}
const amsUser=JSON.stringify({token:'synthetic-ams-token',userId:'synthetic-user'});

// AMS: install reports the current state once; the school's own writes are reported; 401 / logout clear expire the exact token.
let a=page();a.sessionStorage.setItem('amsuserInfo',amsUser);a.run();
assert.deepEqual(a.calls,[['changed']]);
a.run();assert.equal(a.calls.length,1,'second install in the same document is ignored');
a.sessionStorage.setItem('selectedCourseDatas','[]');a.localStorage.setItem('amsuserInfo',amsUser);a.localStorage.clear();
assert.equal(a.calls.length,1,'unrelated keys and localStorage are ignored');
a.sessionStorage.setItem('amsuserInfo',JSON.stringify({token:'synthetic-renewed'}));assert.deepEqual(a.calls.at(-1),['changed']);
a.sessionStorage.clear();assert.deepEqual(a.calls.at(-1),['expired','synthetic-renewed'],'401 handler / logout clear()');
let b=page();b.sessionStorage.setItem('amsuserInfo',amsUser);b.run();b.sessionStorage.removeItem('amsuserInfo');
assert.deepEqual(b.calls.at(-1),['expired','synthetic-ams-token']);
let c=page();c.run();c.sessionStorage.clear();assert.deepEqual(c.calls,[['changed']],'nothing to expire on a page that never held a token');
let m=page();m.sessionStorage.setItem('amsuserInfo','not-json');m.run();m.sessionStorage.clear();assert.deepEqual(m.calls,[['changed']]);

// Isolation: seat / room keep their own UIM-gated token exchange; other hosts, subframes, HTTP and pages without the bridge never install.
for(const host of ['seatbookings.xjtlu.edu.cn','roombookings.xjtlu.edu.cn','uim.xjtlu.edu.cn','shuttlebus.xjtlu.edu.cn','sportscentre.xipueduinno.cn']){
 const blocked=page(host);blocked.sessionStorage.setItem('userInfo',JSON.stringify({token:'synthetic'}));blocked.sessionStorage.setItem('isLogin','true');blocked.run();
 blocked.sessionStorage.setItem('isLogin','false');blocked.sessionStorage.clear();assert.equal(blocked.calls.length,0,host);
}
for(const blocked of [page('ams.xjtlu.edu.cn',{main:false}),page('ams.xjtlu.edu.cn',{protocol:'http:'})]){
 blocked.sessionStorage.setItem('amsuserInfo',amsUser);blocked.run();blocked.sessionStorage.clear();assert.equal(blocked.calls.length,0);
}
const noBridge=page('ams.xjtlu.edu.cn',{bridge:false});noBridge.run();noBridge.sessionStorage.setItem('amsuserInfo',amsUser);

// Restore template: placeholders exist once, and the filled page is inert apart from storage writes and one replace().
assert.equal(template.split('__SESSION_ITEMS__').length,2);assert.equal(template.split('__TARGET__').length,2);
assert.ok(!/fetch|XMLHttpRequest|localStorage|document\.cookie|src=|href=/.test(template));
console.log('PASS: Android session hook is AMS-only, reports amsuserInfo writes, expires only the held token (401/logout), ignores unrelated storage, seat/room/other hosts, subframes and HTTP; generated assets match sources; restore template is inert.');
