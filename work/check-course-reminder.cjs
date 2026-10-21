// REMIND-001: timetable export for native reminders and the shared settings / detail UI.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {JSDOM,VirtualConsole}=require(process.env.AMS_JSDOM||'../outputs/sports-offline-test-runtime/node_modules/jsdom');

// Parent bridge: run the injected source against a fake clock and location.
const parentSource=fs.readFileSync('work/managed-course-reminder-parent.js','utf8');
let now=Date.UTC(2026,11,31,4,0);// 2026-12-31 12:00 China time
class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
const location={href:''},pings=[];
const ctx={Date:Clock,window:{},location:new Proxy(location,{set(t,k,v){if(k==='href')pings.push(v);t[k]=v;return true;}}),frame:null,cachedDays:[]};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(parentSource+'\nthis.buildSchedule=buildSchedule;this.publishSchedule=publishSchedule;this.scheduleDate=scheduleDate;',ctx);
assert.equal(ctx.scheduleDate('12-31'),'2026-12-31');
assert.equal(ctx.scheduleDate('01-01'),'2027-01-01','year boundary picks the nearest year');
assert.equal(ctx.scheduleDate('2026-10-14'),'2026-10-14');
assert.equal(ctx.scheduleDate('-'),null);assert.equal(ctx.scheduleDate('02-30'),null);
const days=[
 {date:'12-31',timetableVoList:[{id:7,moduleTime:'09:00~10:50',moduleTitle:' Calculus ',moduleCode:'MTH101',room:'SA169'},{moduleTime:'待定',moduleTitle:'No time'},{moduleTime:'14:00~14:05',moduleTitle:'Too short'}]},
 {date:'01-01',timetableVoList:[]},
 {date:'-',timetableVoList:null}
];
const s=ctx.buildSchedule(days);
assert.deepEqual(s.dates,['2026-12-31','2027-01-01'],'empty days are still reported as known dates');
assert.equal(s.courses.length,1);
assert.deepEqual(s.courses[0],{key:'2026-12-31|09:00|7',date:'2026-12-31',start:'09:00',end:'10:40',rawEnd:'10:50',title:'Calculus',code:'MTH101',room:'SA169',location:''});
// Ping only with the native bridge, only when content changes.
ctx.cachedDays=days;ctx.publishSchedule();assert.equal(pings.length,0,'no bridge, no ping');
ctx.__amsCourseReminderBridge=true;ctx.publishSchedule();ctx.publishSchedule();
assert.deepEqual(pings,['ams-local://schedule']);assert.equal(ctx.__amsSchedule.courses[0].key,'2026-12-31|09:00|7');
ctx.cachedDays=[{date:'12-31',timetableVoList:[{id:7,moduleTime:'09:00~10:50',moduleTitle:'Calculus',moduleCode:'MTH101',room:'SA170'}]}];ctx.publishSchedule();
assert.equal(pings.length,2,'room change republishes');

// Timetable cache (managed-timetable-cache.js): per account, per date, empty answers overwrite, 3-day margin.
const store=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear(),keys:()=>[...m.keys()]};};
const local=store(),session=store();
const cacheCtx={Date:Clock,window:{},location:{href:''},frame:null,cachedDays:[],sessionStorage:session,localStorage:new Proxy(local,{ownKeys:()=>local.keys(),getOwnPropertyDescriptor:(t,k)=>local.keys().includes(k)?{enumerable:true,configurable:true,value:local.getItem(k)}:undefined})};
cacheCtx.window=cacheCtx;vm.createContext(cacheCtx);
vm.runInContext(parentSource+fs.readFileSync('work/managed-timetable-cache.js','utf8')+'\nthis.storeTimetable=storeTimetable;this.cachedHomeDays=cachedHomeDays;this.cachedReminderDays=cachedReminderDays;this.clearTimetableCaches=clearTimetableCaches;this.timetableCacheKey=timetableCacheKey;',cacheCtx);
now=Date.UTC(2026,9,14,4,0);// 2026-10-14 12:00 China time
const lesson=(t,title)=>({moduleTime:t,moduleTitle:title,moduleCode:'C'+title,room:'R1',teacherSecret:'not stored'});
session.setItem('amsuserInfo',JSON.stringify({account:'student-a',token:'x'}));
const keyA=cacheCtx.timetableCacheKey();assert(keyA.startsWith('amsTimetableCache:v1:')&&!keyA.includes('student-a'),'account is hashed in the key');
cacheCtx.storeTimetable([{date:'10-10',timetableVoList:[lesson('09:00~10:00','Old')]},{date:'10-13',timetableVoList:[lesson('09:00~10:00','Yesterday')]},{date:'10-14',timetableVoList:[lesson('09:00~10:00','Mon')]},{date:'10-15',timetableVoList:[lesson('09:00~10:00','Tue')]},{date:'10-16',timetableVoList:[lesson('09:00~10:00','Wed')]}]);
let saved=JSON.parse(local.getItem(keyA));
assert.deepEqual(Object.keys(saved.days).sort(),['2026-10-13','2026-10-14','2026-10-15','2026-10-16'],'dates older than 3 days dropped');
assert.equal(saved.days['2026-10-14'].timetableVoList[0].teacherSecret,undefined,'only the displayed lesson fields are kept');
// A later fetch returns 10-15..10-17 with 10-15 empty: only those dates change.
cacheCtx.storeTimetable([{date:'10-15',timetableVoList:[]},{date:'10-16',timetableVoList:[lesson('14:00~15:00','Wed2')]},{date:'10-17',timetableVoList:[lesson('09:00~10:00','Thu')]}]);
saved=JSON.parse(local.getItem(keyA));
assert.equal(saved.days['2026-10-14'].timetableVoList[0].moduleTitle,'Mon','dates not in the new fetch are kept');
assert.equal(saved.days['2026-10-15'].timetableVoList.length,0,'an empty answer replaces that date');
assert.equal(saved.days['2026-10-16'].timetableVoList[0].moduleTitle,'Wed2');
assert.deepEqual(cacheCtx.cachedHomeDays().map(d=>d.date),['10-14','10-15','10-16'],'home shows up to 3 days from today, in school date text');
assert.deepEqual(cacheCtx.cachedReminderDays().map(d=>d.date),['2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17'],'reminders get every cached day from yesterday on');
session.setItem('amsuserInfo',JSON.stringify({account:'student-b',token:'y'}));
assert.equal(cacheCtx.cachedHomeDays().length,0,'another account sees nothing');
cacheCtx.clearTimetableCaches();assert.equal(local.keys().filter(k=>k.startsWith('amsTimetableCache')).length,0,'logout clears every cached account');

// Encoding guard: GBK-misread UTF-8 (Windows PowerShell 5 default) once turned a test title into mojibake.
const mojibake=/楂樼|璇剧|鏁板|锛|銆|鈥|鍙|鐨|涓€/;
for(const file of ['work/managed-course-reminder-child.js','work/managed-course-reminder-parent.js','work/managed-timetable-cache.js','outputs/ams-ios/Sources/CourseReminderCenter.swift','outputs/ams-ios/Sources/CourseReminderPlan.swift','outputs/ams-ios/Sources/CourseReminderChecks.swift','outputs/ams-ios/Shared/CourseActivityAttributes.swift','outputs/ams-ios/LiveActivity/CourseLiveActivity.swift','outputs/ams-android/app/src/main/java/cn/local/ams/CourseReminder.java','outputs/ams-notify/src/schedule.mjs'])
 assert(!mojibake.test(fs.readFileSync(file,'utf8')),'mojibake in '+file);

// Generated outputs carry the injections.
const installer=fs.readFileSync('outputs/ams-android/app/src/main/assets/ams-modern-ui.js','utf8');
for(const piece of ['storeTimetable(cachedDays);','cachedHomeDays()','fromCache:timetableFromCache',"case 'logout':clearTimetableCaches();",'publishSchedule();',"case 'courseReminder':","ams-local://coursereminder?change=","window.__amsSetCourseReminder=","lastSchedule='';","window.__amsSetCourseReminder(window.__amsCourseReminder)"])assert(installer.includes(piece),piece);

// Child UI in a DOM.
const html=fs.readFileSync('work/live-ui.html','utf8');
const sent=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:new VirtualConsole(),beforeParse(w){w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.matchMedia=()=>({matches:true,addEventListener(){}});}});
const w=dom.window;w.parent.postMessage=m=>sent.push(m);
const run=code=>w.eval(code);
run('settingsOpen=true;render()');
// D-021: settings shows one entry row; the reminder page is a settings sub-route with its own sub-pages.
const entryEl=()=>w.document.getElementById('courseReminderEntry');let entry=entryEl();
assert(entry&&entry.hidden,'hidden until native announces availability');
assert(!w.document.getElementById('courseReminderSection'),'old inline section is gone');
const state=`{available:true,decided:true,enabled:true,channels:[{key:'island',label:'灵动岛与锁屏',short:'灵动岛',detail:'倒计时',on:true,blocked:false},{key:'notify',label:'课前通知',short:'通知',detail:'弹出通知',on:false,blocked:true,blockedText:'系统通知已关闭'}],leadMin:15,merge:true,upload:{available:true,enabled:false},mutedCodes:['ENG001'],courses:[{code:'MTH101',title:'Calculus'},{code:'ENG001',title:'English'}],status:'今天已安排 2 节课',settingsLink:true}`;
run(`courseReminder=${state};renderCourseReminder()`);
assert(!entry.hidden&&entry.textContent.includes('灵动岛 · 提前 15 分钟')&&entry.textContent.includes('需要授权'),'entry summary and warning');
entry.click();
const screen=()=>w.document.getElementById('otherScreen');
assert.equal(w.document.querySelector('h1').textContent,'课程提醒');
assert(screen().textContent.includes('今天已安排 2 节课'));
assert(!screen().querySelector('[data-reminder-lead]'),'lead time lives on its own sub-page');
// Independent channels; a blocked channel shows its reason only when switched on.
assert.equal(screen().querySelector('[data-reminder-channel="island"]').getAttribute('aria-checked'),'true');
assert(!screen().textContent.includes('系统通知已关闭'),'blocked reason only for a channel that is on');
screen().querySelector('[data-reminder-channel="notify"]').click();
assert.deepEqual(sent.at(-1),{amsUiAction:'courseReminder',change:{channel:{key:'notify',on:true}}});
assert(screen().textContent.includes('系统通知已关闭'));
screen().querySelector('[data-reminder-channel="island"]').click();
assert.deepEqual(sent.at(-1).change,{channel:{key:'island',on:false}});
screen().querySelector('[data-reminder-channel="notify"]').click();
assert.deepEqual(sent.at(-1).change,{channel:{key:'notify',on:false}});
run('courseReminder.enabled').valueOf;assert.equal(run('courseReminder.enabled'),false,'both channels off switches reminders off');
assert(screen().querySelector('#reminderLead').disabled,'options disabled while off');
w.document.getElementById('courseReminderSwitch').click();
assert.deepEqual(sent.at(-1).change,{enabled:true});
assert.equal(screen().querySelector('[data-reminder-channel="island"]').getAttribute('aria-checked'),'true','switching on brings a channel back');
w.document.getElementById('courseReminderMerge').click();
assert.deepEqual(sent.at(-1).change,{merge:false});
// Lead time sub-page.
w.document.getElementById('reminderLead').click();
assert.equal(screen().querySelectorAll('[data-reminder-lead]').length,5);
assert.equal(screen().querySelector('[data-reminder-lead="15"]').getAttribute('aria-pressed'),'true');
screen().querySelector('[data-reminder-lead="5"]').click();
assert.deepEqual(sent.at(-1).change,{leadMin:5});
assert(w.document.getElementById('reminderLead').textContent.includes('5 分钟'),'back on the main page after choosing');
// Per-course sub-page lists known courses and muted ones.
w.document.getElementById('reminderMuteList').click();
assert.equal(screen().querySelectorAll('[data-reminder-course]').length,2);
assert.equal(screen().querySelector('[data-reminder-course="ENG001"]').getAttribute('aria-checked'),'false');
screen().querySelector('[data-reminder-course="ENG001"]').click();
assert.deepEqual(sent.at(-1).change,{mute:{code:'ENG001',muted:false}});
screen().querySelector('[data-reminder-course="MTH101"]').click();
assert.deepEqual(sent.at(-1).change,{mute:{code:'MTH101',muted:true}});
// Back steps: sub-page -> reminder page -> settings.
assert.equal(run('__amsHandleBack()'),true);assert(w.document.getElementById('reminderLead'));
// Cloud upload needs explicit consent in a sheet; nothing is sent before confirming.
const before=sent.length;w.document.getElementById('courseReminderUpload').click();
assert.equal(sent.length,before);assert(w.document.getElementById('sheetContent').textContent.includes('不会上传密码'));
w.document.getElementById('confirmReminderUpload').click();
assert.deepEqual(sent.at(-1).change,{upload:true});
w.document.getElementById('courseReminderUpload').click();
assert.deepEqual(sent.at(-1).change,{upload:false},'turning off needs no confirmation');
w.document.getElementById('courseReminderSettings').click();
assert.deepEqual(sent.at(-1).change,{openSettings:true});
assert.equal(run('__amsHandleBack()'),true);assert.equal(w.document.querySelector('h1').textContent,'设置');
// Not decided yet: the page is locked, only "开启课程提醒"; skipping from the page does not record a choice.
run(`courseReminder=Object.assign(${state},{decided:false,enabled:false});renderCourseReminder()`);
entry=entryEl();assert(entry.textContent.includes('去开启'));
entry.click();
assert(screen().querySelector('.reminder-locked[inert]'),'locked page');
const n=sent.length;w.document.getElementById('reminderStart').click();
assert(w.document.getElementById('sheet').open&&w.document.getElementById('reminderCloud'),'consent sheet on demand');
w.document.getElementById('reminderSkip').click();assert.equal(sent.length,n,'skip from the page records nothing');
w.document.getElementById('sheet').close();
w.document.getElementById('reminderStart').click();w.document.getElementById('reminderLocal').click();
assert.deepEqual(sent.at(-1).change,{decided:true,enabled:true,upload:false});
assert(!screen().querySelector('.reminder-locked'),'unlocked after choosing');
run('__amsHandleBack()');w.document.getElementById('sheet').close();
// Detail sheet mute button only when enabled and the course has a code.
run(`courseReminder.enabled=true;settingsOpen=false;days=[{date:'12-31',timetableVoList:[{moduleTime:'09:00~10:50',moduleTitle:'Calculus',moduleCode:'MTH101'},{moduleTime:'11:00~12:00',moduleTitle:'No code'}]}];selected=0;ready=true;detail(0)`);
const mute=w.document.getElementById('reminderMute');assert(mute&&mute.textContent.includes('这门课不提醒'));
mute.click();assert.deepEqual(sent.at(-1).change,{mute:{code:'MTH101',muted:true}});
run('detail(0)');assert(w.document.getElementById('reminderMute').textContent.includes('恢复'));
run('detail(1)');assert(!w.document.getElementById('reminderMute'));
run('courseReminder.enabled=false;detail(0)');assert(!w.document.getElementById('reminderMute'));
// First-login choice: iPhone gets cloud / local / skip, asked once, only on home with a timetable.
run(`closeSheet();document.getElementById('sheet').close();settingsOpen=false;page={route:'/home'};ready=true;courseReminderAsked=false;courseReminder={available:true,decided:false,enabled:false,upload:{available:true,enabled:false}};maybeAskCourseReminder()`);
let sheetText=w.document.getElementById('sheetContent').textContent;
assert(sheetText.includes('云端处理')&&sheetText.includes('仅本机处理')&&sheetText.includes('暂不开启')&&sheetText.includes('密码和学校登录凭证都不会上传云端'),'three choices with the privacy statement');
w.document.getElementById('reminderCloud').click();
assert.deepEqual(sent.at(-1).change,{decided:true,enabled:true,upload:true});
w.document.getElementById('sheet').close();run('maybeAskCourseReminder()');assert(!w.document.getElementById('sheet').open,'not asked twice');
run(`courseReminderAsked=false;courseReminder={available:true,decided:false,upload:{available:true}};maybeAskCourseReminder()`);
w.document.getElementById('reminderLocal').click();assert.deepEqual(sent.at(-1).change,{decided:true,enabled:true,upload:false});
w.document.getElementById('sheet').close();
run(`courseReminderAsked=false;courseReminder={available:true,decided:false,upload:{available:true}};maybeAskCourseReminder()`);
w.document.getElementById('reminderSkip').click();assert.deepEqual(sent.at(-1).change,{decided:true,enabled:false});
w.document.getElementById('sheet').close();
// Android: no cloud option.
run(`courseReminderAsked=false;courseReminder={available:true,decided:false,upload:{available:false}};maybeAskCourseReminder()`);
sheetText=w.document.getElementById('sheetContent').textContent;
assert(!w.document.getElementById('reminderCloud')&&sheetText.includes('不会上传'),'Android: local only');
assert(w.document.getElementById('close').hidden,'Android choice has no redundant close button');
assert.deepEqual([...w.document.querySelectorAll('.reminder-first-actions button')].map(b=>[b.textContent,b.className]),[['开启课程提醒','form-submit'],['暂不开启','form-submit']],'two explicit actions with identical button style');
w.document.getElementById('reminderLocal').click();assert.deepEqual(sent.at(-1).change,{decided:true,enabled:true});
w.document.getElementById('sheet').close();
run(`courseReminderAsked=false;courseReminder={available:true,decided:false,upload:{available:false}};maybeAskCourseReminder()`);
w.document.getElementById('reminderSkip').click();assert.deepEqual(sent.at(-1).change,{decided:true,enabled:false},'skip records disabled choice');
run(`document.getElementById('sheet').close();show('<h2>课程详情</h2>')`);
assert(!w.document.getElementById('close').hidden,'other dialogs retain their close button');
w.document.getElementById('sheet').close();
run(`courseReminderAsked=false;courseReminder={available:true,decided:true};maybeAskCourseReminder();page={route:'/course'};courseReminder={available:true,decided:false};maybeAskCourseReminder()`);
assert(!w.document.getElementById('sheet').open,'never once decided, never off the home screen');
// Cached timetable shows an updating hint until the school answers.
run(`settingsOpen=false;page={route:'/home',fromCache:true};days=[{date:'12-31',timetableVoList:[{moduleTime:'09:00~10:50',moduleTitle:'Calculus'}]}];ready=true;renderHome()`);
assert(w.document.getElementById('count').textContent.includes('正在更新'));
run(`page={route:'/home',fromCache:false};renderHome()`);assert(!w.document.getElementById('count').textContent.includes('正在更新'));
// Android keep-alive section still renders next to it.
run(`settingsOpen=true;render();settingsData.keepAlive={available:true,enabled:true,days:3};renderKeepAlive()`);
assert(!w.document.getElementById('keepAliveSection').hidden);
w.close();
console.log('PASS: China-time dates and year boundary, early-end rule, invalid times skipped, stable keys, bridge-gated change-only ping, generated injections, settings entry / reminder page with independent channels, lead and per-course sub-pages, locked page, back steps / consent sheet / settings link, detail mute visibility, timetable cache per account / per date / empty overwrite / 3-day margin / logout clear, first-login choice (iPhone 3 options, Android local only, asked once), cache updating hint, keep-alive coexistence');
