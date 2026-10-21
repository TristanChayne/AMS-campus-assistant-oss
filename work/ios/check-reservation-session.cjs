const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('work/ios/reservation-session.js','utf8');
const host='seatbookings.xjtlu.edu.cn';
function launch(saved='',actual=host,main=true){
 class Storage{constructor(){this.items=new Map()}getItem(k){return this.items.get(String(k))??null}setItem(k,v){this.items.set(String(k),String(v))}removeItem(k){this.items.delete(String(k))}clear(){this.items.clear()}}
 const messages=[],sessionStorage=new Storage(),localStorage=new Storage();
 const window={webkit:{messageHandlers:{reservationSession:{postMessage(v){messages.push(v)}}}}};window.top=main?window:{};
 vm.runInNewContext(source.replace('__RESERVATION_SESSION__',JSON.stringify(saved)).replace('__RESERVATION_HOST__',JSON.stringify(host)),{window,location:{protocol:'https:',hostname:actual},Storage,sessionStorage});
 return {sessionStorage,localStorage,messages};
}
const user=JSON.stringify({token:'synthetic-reservation-token',roleId:1});
let a=launch();a.sessionStorage.setItem('userInfo',user);assert.equal(a.messages.length,0);a.sessionStorage.setItem('isLogin',true);
let saved=a.messages.at(-1);assert.equal(JSON.parse(saved).userInfo,user);
for(const label of ['separate-query-container','fresh-app-page']){let b=launch(saved);assert.equal(b.sessionStorage.getItem('userInfo'),user,label);assert.equal(b.sessionStorage.getItem('isLogin'),'true');assert.equal(b.messages.length,0);}
a.localStorage.clear();a.sessionStorage.setItem('selectedRoom','10');assert.equal(a.messages.length,1);
a.sessionStorage.setItem('isLogin',false);assert.equal(JSON.parse(a.messages.at(-1)).expiredToken,'synthetic-reservation-token');
let b=launch(saved);b.sessionStorage.removeItem('userInfo');assert.equal(JSON.parse(b.messages.at(-1)).expiredToken,'synthetic-reservation-token');
b=launch(saved);b.sessionStorage.clear();assert.equal(JSON.parse(b.messages.at(-1)).expiredToken,'synthetic-reservation-token');
let stale=launch();stale.sessionStorage.setItem('isLogin',false);assert.equal(stale.messages.length,0);stale.sessionStorage.clear();assert.equal(stale.messages.length,0);
assert.equal(launch(saved,'roombookings.xjtlu.edu.cn').sessionStorage.getItem('userInfo'),null);
assert.equal(launch(saved,host,false).sessionStorage.getItem('userInfo'),null);
assert.equal(launch('broken').sessionStorage.getItem('userInfo'),null);
console.log('PASS: booking/query and fresh-page restoration, expired/logout clearing, unrelated storage, host/frame isolation');
