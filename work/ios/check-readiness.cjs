const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('work/ios/readiness.js','utf8');
function run(host,path,panel=false,password=false,frame=false,completedContent=false){
  const messages=[],classes=[];
  const document={readyState:completedContent?'complete':'loading',documentElement:{append(){},classList:{add(x){classes.push(x)}}},body:{textContent:completedContent?'请选择安全验证方式':''},createElement(){return {}},querySelector(selector){return selector.includes('input[type=password]')||selector==='input[type="password"]'?password:panel},getElementById(){return frame?{style:{display:''},contentDocument:{querySelector(){return {}}}}:null}};
  const context={location:{protocol:'https:',hostname:host,pathname:path,hash:''},document,window:{webkit:{messageHandlers:{amsReady:{postMessage(x){messages.push(x)}}}},addEventListener(){}},MutationObserver:class{observe(){}disconnect(){}},setInterval(){return 1},clearInterval(){},requestAnimationFrame(){}};
  const originalQuery = document.querySelector;
  document.querySelector = selector => selector === '#ams-login-cover input[type=password]' ? frame : originalQuery(selector);
  vm.runInNewContext(source,context);return {messages,classes};
}
assert.equal(run('seatbookings.xjtlu.edu.cn','/').messages.length,0);
assert.equal(run('roombookings.xjtlu.edu.cn','/').messages.length,0);
assert.deepEqual(run('seatbookings.xjtlu.edu.cn','/',true).messages,['ready']);
assert.deepEqual(run('seatbookings.xjtlu.edu.cn','/',false,true).messages,['ready']);
assert.equal(run('ams.xjtlu.edu.cn','/studenth5/').messages.length,0);
assert.deepEqual(run('ams.xjtlu.edu.cn','/studenth5/',false,false,true).messages,['ready']);
assert.deepEqual(run('ams.xjtlu.edu.cn','/',false,false,true).messages,['ready']);
assert.deepEqual(run('ams.xjtlu.edu.cn','/',false,true,false).messages,['ready']);
assert.equal(run('uim.xjtlu.edu.cn','/').messages.length,0);
assert.deepEqual(run('uim.xjtlu.edu.cn','/',false,true).messages,['ready']);
assert.deepEqual(run('uim.xjtlu.edu.cn','/esc-sso/login/page',false,true).messages,['ready']);
assert.deepEqual(run('uim.xjtlu.edu.cn','/esc-sso/login/page',false,true,true).messages,['ready']);
assert.deepEqual(run('uim.xjtlu.edu.cn','/verification',false,false,false,true).messages,['ready']);
assert.deepEqual(run('portalapp.xjtlu.edu.cn','/recovery',false,false,false,true).messages,['ready']);
assert.equal(run('ams.xjtlu.edu.cn','/studenth5/',false,false,false,true).messages.length,0);
console.log('PASS: raw seat/room/AMS pages stay hidden, adapted pages reveal, school login remains usable');

// A hash navigation cannot reveal a records route using a leftover booking panel.
{
 let hash='#/ic/home',records=false;const messages=[],events={},classes=new Set();
 const document={documentElement:{append(){},classList:{add(x){classes.add(x)},remove(x){classes.delete(x)}}},body:{},createElement(){return {}},querySelector(q){return q==='input[type="password"]'?false:q==='#campus-records-panel'?records:true}};
 const location={protocol:'https:',hostname:'seatbookings.xjtlu.edu.cn',get hash(){return hash}};
 vm.runInNewContext(source,{location,document,window:{addEventListener(k,v){events[k]=v},webkit:{messageHandlers:{amsReady:{postMessage(x){messages.push(x)}}}}},MutationObserver:class{observe(){}},requestAnimationFrame(){}});
 assert.deepEqual(messages,['ready']);hash='#/ic/userinfo';events.hashchange();assert.equal(messages.at(-1),'waiting');assert(!classes.has('ams-ios-ready'));
 records=true;events.hashchange();assert.equal(messages.at(-1),'ready');
}
console.log('PASS: hash navigation hides stale booking panel until the records adapter exists');

// Reproduce an offscreen WKWebView: animation-frame callbacks never execute.
// The school adapter arrives after document load; its DOM mutation must reveal the page.
{
 let adapted=false,callback,observed,frames=0;const messages=[],events={};
 const document={readyState:'complete',documentElement:{append(){},classList:{add(){},remove(){}}},body:{},createElement(){return {}},querySelector(q){return q==='input[type="password"]'?false:adapted}};
 vm.runInNewContext(source,{location:{protocol:'https:',hostname:'seatbookings.xjtlu.edu.cn',hash:'#/ic/home'},document,window:{addEventListener(k,v){events[k]=v},webkit:{messageHandlers:{amsReady:{postMessage(x){messages.push(x)}}}}},MutationObserver:class{constructor(fn){callback=fn}observe(_,options){observed=options}},requestAnimationFrame(){frames++}});
 assert.equal(messages.length,0);adapted=true;callback();
 assert.deepEqual(messages,['ready'],'an offscreen adapter must reveal without an animation frame');
 assert.equal(frames,0);assert(observed.attributes);assert(observed.attributeFilter.includes('style'));
 events['ams-ios-active']();assert.equal(messages.length,1,'activation must not duplicate readiness');
}
console.log('PASS: offscreen delayed-adapter readiness without animation frames, visibility observation and activation');
