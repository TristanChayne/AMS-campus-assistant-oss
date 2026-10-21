const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve('outputs/ams-miniprogram');
function checkFiles(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())checkFiles(p);else if(p.endsWith('.js'))new vm.Script(fs.readFileSync(p,'utf8'),{filename:p});else if(p.endsWith('.json'))JSON.parse(fs.readFileSync(p,'utf8'));}}
checkFiles(root);
// WXML accepts literal condition strings at compile time; these must be bound.
function checkBindings(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())checkBindings(p);else if(p.endsWith('.wxml')){const w=fs.readFileSync(p,'utf8');for(const m of w.matchAll(/wx:(if|elif)="([^"]*)"/g))assert(/^\{\{[\s\S]*\}\}$/.test(m[2]),'Unbound conditional in '+p+': '+m[0]);}}}
checkBindings(root);
const screenWxml=fs.readFileSync(path.join(root,'components/campus-screen/index.wxml'),'utf8');assert(screenWxml.includes('wx:if="{{!logged}}"'));assert.equal(vm.runInNewContext('!logged',{logged:true}),false);assert.equal(vm.runInNewContext('!logged',{logged:false}),true);assert.equal(Boolean('!logged'),true,'reproduces the original literal-condition bug');
assert(screenWxml.includes('class="course-sheet"'));assert(!screenWxml.includes('<scroll-view scroll-x class="week">'));
const productCss=fs.readFileSync(path.join(root,'components/campus-screen/index.wxss'),'utf8');assert(productCss.includes('.card{color:var(--ink);width:100%'));assert(productCss.includes('button::after{border:0}'));
// Reproduce onShow before component availability, then verify the ready fallback.
let componentDefinition,pageDefinition,logged=false,clears=0;
const lifecycleService={revision:()=>1,authenticated:()=>logged,account:()=>logged?'demo':'',clear(){clears++;},login:async()=>{logged=true;}};
const lifecycleApp={sessionService:lifecycleService,globalData:{appearance:'light',theme:'blue'},sessionEvents:[],recordSessionEvent(tag){this.sessionEvents.push({event:tag,authenticated:logged});}};
const lifecycleWx={setNavigationBarColor(){},setTabBarStyle(){},setTabBarItem(){},switchTab(o){loginInstance.onUnload();componentDefinition.pageLifetimes.show.call(componentInstance);o.success();}};
vm.runInNewContext(fs.readFileSync(path.join(root,'components/campus-screen/index.js'),'utf8'),{Component:c=>componentDefinition=c,require:p=>{assert(!p.includes('session'),'components must use the App-owned service');return {};},getApp:()=>lifecycleApp,getCurrentPages:()=>[{options:{},query:{}}],wx:lifecycleWx,setInterval:()=>1,clearInterval(){},Date});
const componentInstance={properties:{role:'reservations'},data:structuredClone(componentDefinition.data),setData(update){Object.assign(this.data,update)},...componentDefinition.methods};
vm.runInNewContext(fs.readFileSync(path.join(root,'pages/today/index.js'),'utf8'),{Page:p=>pageDefinition=p});
const pageInstance={query:{},selectComponent:()=>null};pageDefinition.onShow.call(pageInstance);assert.equal(componentInstance.data.logged,false);
assert.equal(typeof componentDefinition.lifetimes.ready,'function');componentDefinition.lifetimes.ready.call(componentInstance);assert.equal(componentInstance.data.logged,false);
logged=true;componentDefinition.pageLifetimes.show.call(componentInstance);assert.equal(componentInstance.data.logged,true);logged=false;
let loginDefinition;vm.runInNewContext(fs.readFileSync(path.join(root,'pages/login/index.js'),'utf8'),{Page:p=>loginDefinition=p,require:()=>{throw Error('login must use App-owned service');},getApp:()=>lifecycleApp,wx:lifecycleWx});
const loginInstance={...loginDefinition,data:{...loginDefinition.data,username:'demo',imageCode:'ABCD',otp:'123456'},captchaKey:'private',setData(update){Object.assign(this.data,update)}};
const t=require(path.join(root,'utils/timetable'));
const now=new Date(2026,9,8,13,36),raw=[{date:'10-09',timetableVoList:[{moduleTitle:'Future',moduleTime:'14:00~16:00'}]},{date:'10-11',timetableVoList:[]}];
let view=t.view(raw,null,now);assert.equal(view.selected,'10-08');assert.equal(view.count,0);assert.equal(view.days.length,3);assert.equal(t.view(raw,null,now).days.length,3);
view=t.view(raw,'10-09',now);assert.equal(view.focus.active,false);assert.equal(view.focus.end,'15:50');assert.equal(raw[0].timetableVoList[0].moduleTime,'14:00~16:00');
assert.equal(t.course({moduleTime:'14:00~16:00'},new Date(2026,9,8,15,50),true).ended,true);
assert.equal(t.offset('01-01',new Date(2026,11,31)),1);assert.equal(t.offset('02-31',now),null);
assert.equal(t.course({moduleTime:'14:99~16:00'},now,true).state,'时间待确认');assert.throws(()=>t.view({},null,now));
const mixed=t.view([{date:'10-08',timetableVoList:[{moduleTime:'16:00~18:00'}]},{date:'10-12',timetableVoList:[]}],null,new Date(2026,9,9,11,19));assert.equal(mixed.selected,'10-09');assert.equal(mixed.focus,null);assert.equal(mixed.days[1].label,'周一');assert.throws(()=>t.view([{date:'10-08',timetableVoList:[]}],null,new Date(2026,9,9,11,19)),/过期/);
const detailInstance={data:{view:{remaining:[{moduleCode:'TEST',moduleTitle:'Test',room:'ROOM',start:'16:00',end:'17:50'}]}},setData(u){Object.assign(this.data,u)}};componentDefinition.methods.course.call(detailInstance,{currentTarget:{dataset:{index:0}}});assert.equal(detailInstance.data.courseSheet.moduleCode,'TEST');componentDefinition.methods.closeCourse.call(detailInstance);assert.equal(detailInstance.data.courseSheet,null);
const bridge=require(path.join(root,'services/mobile-bridge')),probe=fs.readFileSync('outputs/miniprogram-interface-probe/pages/probe/index.js','utf8');
assert.equal(bridge.amsRequest.toString(),vm.runInNewContext('({'+probe.slice(probe.indexOf(' async amsRequest('),probe.indexOf(' async loadAmsPolicy(')).replaceAll('wx.request(','this.request(')+'}).amsRequest').toString());
let requests=[],hold=false,pending=[];
global.wx={getDeviceInfo:()=>({platform:'android'}),request(options){requests.push(options);const task={abort(){options.fail({errMsg:'abort'});},onHeadersReceived(){}};let data,statusCode=200,header={};
 if(options.url.includes('loginByOtp'))data={success:true,data:{token:'portal-private',ssoToken:'sso-private',userId:'123'}};
 else if(options.url.includes('getPhoUserAppTargets'))data={success:true,data:[{isSso:'Y',uimAppId:12,appUrl:'https://ams.xjtlu.edu.cn'}]};
 else if(options.url.includes('changeCode'))data={success:true,data:{code:'one-use-code'}};
 else if(options.url.includes('/api/v1/app/login')){statusCode=302;header.Location='https://ams.xjtlu.edu.cn/studenth5/?type=mobile&code=callback';data='';}
 else if(options.url.includes('/sso/mobile/login'))data={code:0,data:{token:'ams-private',academicYear:'2026',semester:'1'}};
 else if(options.url.includes('recordList'))data={code:0,data:{list:[{date:'10-08',status:1}],total:1}};
 else if(options.url.includes('getCaptcha'))data={success:true,data:{captchaKey:'captcha-private',imageBase:'mock'}};
 else data={code:0,data:[]};
 const deliver=()=>options.success({statusCode,header,data});if(hold)pending.push(deliver);else setImmediate(deliver);return task;}};
(async()=>{await loginInstance.submit();assert.equal(clears,0);assert.equal(componentInstance.data.logged,true);assert.equal(loginInstance.completed,true);assert.equal(loginInstance.gone,true);
const failedNavigation={...loginDefinition,data:{...loginDefinition.data,username:'demo',imageCode:'ABCD',otp:'123456'},captchaKey:'private',setData(update){Object.assign(this.data,update)}};lifecycleWx.switchTab=o=>o.fail();await failedNavigation.submit();assert(failedNavigation.data.error.includes('返回课表未完成'));
const s=require(path.join(root,'services/session'));await s.login({username:'demo',imageCode:'ABCD',otp:'123456',captchaKey:'private'},()=>{});assert(s.authenticated());await s.detail('CSE 205',1);const detail=requests.find(r=>r.url.includes('recordList'));assert(detail.url.includes('moduleCode=CSE%20205'));assert.equal(detail.header['X-Token'],'ams-private');assert(!detail.header.Authorization);
const isolatedCopy={authenticated:()=>false};assert.notEqual(isolatedCopy.authenticated(),s.authenticated());lifecycleApp.sessionService=s;componentDefinition.pageLifetimes.show.call(componentInstance);assert.equal(componentInstance.data.logged,true,'component must see App session even if a local module copy differs');
let appDefinition;vm.runInNewContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),{App:a=>appDefinition=a,Date,require:()=>s,wx:{getStorageSync:()=>''}});appDefinition.onLaunch.call(appDefinition);appDefinition.recordSessionEvent('test');const report=JSON.stringify(appDefinition.sessionEvents);for(const secret of ['ams-private','portal-private','demo','123456'])assert(!report.includes(secret));assert.equal(appDefinition.sessionService,s);
 assert(requests.every(r=>!r.url.includes('qRCodeSign')&&!r.url.includes('addLeave')));
 hold=true;const reading=s.timetable();s.clear();await assert.rejects(reading);pending.forEach(f=>f());assert(!s.authenticated());await assert.rejects(s.timetable(),/登录/);
 assert(!fs.readFileSync(path.join(root,'services/session.js'),'utf8').includes('setStorageSync'));
 console.log('PASS: ready fallback, login return refresh, unload preserves successful session, navigation failure visible, syntax/config, dates/early-end, auth extraction, mocked login, token isolation, pagination, logout race, no business writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
