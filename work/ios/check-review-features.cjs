const fs=require('fs'),assert=require('assert/strict'),{JSDOM,VirtualConsole}=require(process.env.AMS_JSDOM||'../../outputs/sports-offline-test-runtime/node_modules/jsdom');
const html=fs.readFileSync('outputs/ams-ios/Assets/review-content.html','utf8');
const v=new VirtualConsole(),errors=[];v.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{url:'file:///review-content.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:v,beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){}});}});
const w=dom.window,doc=w.document,outgoing=[];
w.addEventListener('message',e=>{if(e.data?.amsUiAction)outgoing.push(e.data)});
const course={id:'example-1',dayOffset:0,date:'2026-10-14',moduleCode:'SOE106TC',moduleTitle:'Programming with C++',moduleTime:'10:00–10:50',room:'DE-2001',location:'演示教室'};
const demo={today:'2026-10-14',courses:[course],seed:{notice:'演示环境 · 不提交学校',resources:[],leaveTypes:[],busTimes:[]},state:{anchor:'2026-10-14',attendance:[],leaves:[],bookings:[],sports:[]},reviewReminder:{state:{phase:'before'},prefs:{enabled:true,island:true},pushReady:false}};
function publish(route){w.dispatchEvent(new w.MessageEvent('message',{source:w.parent,data:{amsUiData:{route,ready:true,loading:false,leave:true,list:[],account:'演示同学',days:[{date:'10-14',fullDate:'2026-10-14',timetableVoList:[course]}],demo,courseReminder:{available:true,decided:true,enabled:true,channels:[{key:'island',title:'灵动岛',on:true},{key:'notify',title:'课前通知',on:true}],leadMin:15,merge:true,mutedCodes:[],courses:[{code:course.moduleCode,title:course.moduleTitle}],upload:{available:true,enabled:true}}}}}));}
(async()=>{
 publish('/home');assert.ok(doc.querySelector('#reviewReminderOpen'),'home review control is reachable');
 publish('/review/reminder');assert.ok(doc.querySelector('#reviewReminderSettings'));assert.equal(doc.querySelectorAll('[data-review-phase]').length,3);assert.ok(doc.querySelector('#reviewReminderDelayed').disabled,'no-token/permissions cannot claim remote ready');
 assert.match(doc.body.textContent,/Programming with C\+\+/);assert.match(doc.body.textContent,/SOE106TC/);assert.match(doc.body.textContent,/DE-2001/);
 demo.reviewReminder.pushReady=true;publish('/review/reminder');assert.equal(doc.querySelector('#reviewReminderDelayed').disabled,false);
 doc.querySelector('[data-review-phase="during"]').click();await new Promise(r=>setTimeout(r,10));assert.ok(outgoing.some(x=>x.amsUiAction==='reviewReminderPhase'&&x.phase==='during'&&x.delaySeconds===0));
 doc.querySelector('#reviewReminderDelayed').click();await new Promise(r=>setTimeout(r,10));assert.ok(outgoing.some(x=>x.amsUiAction==='reviewReminderPhase'&&x.delaySeconds===15));
 publish('/review/sports');assert.ok(doc.querySelector('#reviewSportsBook'));assert.match(doc.body.textContent,/不扣款|不会.*扣款/);
 demo.state.sports=[{id:'fictional-order',name:'羽毛球馆',date:demo.today,start:'10:00',end:'11:00',paid:false,cancelled:false,ticket:'AMS-DEMO-NOT-VALID:sports:fictional'}];publish('/review/sports');assert.ok(doc.querySelector('[data-sports-pay]'));assert.equal(doc.querySelector('[data-sports-ticket]'),null);
 demo.state.sports[0].paid=true;publish('/review/sports');assert.ok(doc.querySelector('[data-sports-ticket]'));
 assert.deepEqual(errors,[]);console.log('PASS: generated review home / phase controls / remote-ready gate / exact course / sports order-payment-ticket UI / no script errors');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
