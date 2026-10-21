const fs=require('fs'),vm=require('vm'),assert=require('assert');
const installer=fs.readFileSync('outputs/ams-android/app/src/main/assets/ams-modern-ui.js','utf8');
let listeners={},intervals=[],messages=[],route='/home',codeCalls=0,routeHook;
const schedule={scheduleList:[{date:'10-05',timetableVoList:[{moduleTime:'11:00~13:00',moduleTitle:'Math',moduleCode:'ADS',room:'DE-2001'}]},{date:'10-06',timetableVoList:[]}],getStudentTimetable(){}};
const home={$options:{name:'home'},$route:{get path(){return route}},$children:[{$children:[schedule]},{tabDatas:[{path:'/course'},{path:'/leave'}]}],onSubmit(){},onSMSCode(){codeCalls++;route='/signCode'},$router:{afterEach(f){routeHook=f},push(p){route=p}}};
let iframe;
const context={location:{protocol:'https:',hostname:'ams.xjtlu.edu.cn',pathname:'/studenth5/',href:'unchanged'},window:{addEventListener(t,f){listeners[t]=f}},document:{querySelectorAll(){return [{__vue__:{$children:[home]}}]},createElement(){iframe={style:{},contentWindow:{postMessage(m){messages.push(m)}},remove(){this.removed=true}};return iframe},body:{appendChild(){}}},setInterval(f){intervals.push(f)},setTimeout(f){f()}};
vm.runInNewContext(installer,context);
assert.equal(messages[0].amsUiData.days[0].timetableVoList[0].room,'DE-2001');
assert.equal(messages[0].amsUiData.days.length,2);
listeners.message({source:{},data:{amsUiAction:'scan'}});assert.equal(context.location.href,'unchanged');
listeners.message({source:iframe.contentWindow,data:{amsUiAction:'scan'}});assert.equal(context.location.href,'ams-local://scan');
assert.equal(typeof routeHook,'function');route='/course';routeHook();assert(iframe.removed);route='/home';intervals[0]();listeners.message({source:iframe.contentWindow,data:{amsUiAction:'code'}});assert.equal(codeCalls,1);assert(iframe.removed);
const html=fs.readFileSync('work/live-ui.html','utf8');
const child=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements={};let onMessage;
const ui={Date:class extends Date{constructor(){super('2026-10-05T13:35:00+08:00')} getHours(){return 13}getMinutes(){return 35}},parent:{postMessage(){}},window:{addEventListener(t,f){onMessage=f}},document:{addEventListener(){},getElementById(id){return elements[id]||(elements[id]={innerHTML:'',textContent:'',open:false,showModal(){this.open=true},close(){this.open=false}})},querySelectorAll(){return []}},setInterval(){}};
vm.runInNewContext(child,ui);
onMessage({source:ui.parent,data:{amsUiData:{days:[{date:'10-05',timetableVoList:[{moduleTime:'11:00~13:00',moduleTitle:'Old class',room:'DE-2001'},{moduleTime:'14:00~15:00',moduleTitle:'<script>bad</script>',room:'TEST-ROOM'}]}],ready:true,leave:false}}});
assert(elements.focus.innerHTML.includes('TEST-ROOM'));
assert(elements.focus.innerHTML.includes('&lt;script&gt;'));
assert(elements.completed.innerHTML.includes('Old class'));
assert(!elements.lessons.innerHTML.includes('Old class'));
assert(elements.leaveBtn.hidden);
vm.runInNewContext('selected=2;render()',ui);
assert(elements.lessons.innerHTML.includes('不代表当天没有课'));
assert(!html.includes('data-time='));
console.log('PASS: live data mapping, route cleanup, sender checks, scan/code routing, next room, ended collapse, escaping, missing day, no demo controls');



