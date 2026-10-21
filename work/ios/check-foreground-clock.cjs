const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const main=fs.readFileSync('outputs/ams-ios/Assets/ams-modern-ui.js','utf8');
const doc=Array.from(main.matchAll(/"(?:[^"\\]|\\.)*"/g),m=>JSON.parse(m[0])).find(s=>s.includes('function renderSettings(screen){'));
assert(doc);
const script=doc.match(/<script>([\s\S]*?)<\/script>/)[1];
const clock=script.slice(script.indexOf("let clockMinute='';"),script.indexOf("render();send('ready');",script.indexOf("let clockMinute='';")));
assert(clock.includes('function iosSetClockActive('));
let now='2026-10-21T09:10:00',renders=0,nextTimer=0,open=false;
const timers=new Map(),events={},documentEvents={},parent={};
class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}}
const window={addEventListener:(name,fn)=>(events[name]??=[]).push(fn)};
const context={window,parent,Date:Clock,document:{getElementById:()=>({open}),addEventListener:(name,fn)=>(documentEvents[name]??=[]).push(fn)},page:{route:'/home'},render:()=>renders++,setInterval:(fn,ms)=>{assert.equal(ms,1000);timers.set(++nextTimer,fn);return nextTimer;},clearInterval:id=>timers.delete(id)};
vm.runInNewContext(clock,context);
const active=(value,source=parent)=>events.message.forEach(fn=>fn({source,data:{iosActive:value}}));
active(false);assert.equal(timers.size,0);
now='2026-10-23T09:30:00';const before=renders;active(true);assert.equal(renders,before+1);assert.equal(timers.size,1);
// A same-minute re-entry must still repaint; repeated foreground events cannot stack timers.
active(true);assert.equal(renders,before+2);assert.equal(timers.size,1);
active(false,{});assert.equal(timers.size,1);
now='2026-10-23T09:31:00';timers.values().next().value();assert.equal(renders,before+3);
open=true;now='2026-10-23T09:32:00';active(false);active(true);assert.equal(renders,before+3);
open=false;timers.values().next().value();assert.equal(renders,before+4,'closing a sheet must not consume the minute before rendering');
active(false);events.pageshow.forEach(fn=>fn());assert.equal(timers.size,1);
const native=fs.readFileSync('outputs/ams-ios/Sources/CampusController.swift','utf8');
assert(/super\.viewDidAppear\(animated\)\s+setReservationActive\(true\)/.test(native));
assert(native.includes("contentWindow.postMessage({iosActive:"));
console.log('PASS: generated iOS clock, two-day suspension, same-minute return, single timer, untrusted message, sheet close and pageshow');
