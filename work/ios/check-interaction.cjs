const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('outputs/ams-ios/Assets/library-room-ui.js','utf8');
const ctx={};vm.createContext(ctx);
vm.runInContext("const minutes=t=>{const p=String(t).split(':').map(Number);return p[0]*60+p[1]};"+source.slice(source.indexOf('function iosRoomMinute'),source.indexOf('let clockSignature=')),ctx);
const c={config:{openStart:'08:00',openEnd:'22:00',resvRule:{minResvTime:30,maxResvTime:180},resvInfo:[{startTime:'2026-10-09 10:00:00',endTime:'2026-10-09 17:50:00',resvStatus:0},{startTime:'18:00',endTime:'22:00',resvStatus:0},{startTime:'08:00',endTime:'10:00',resvStatus:128}],cls:[]},resInfo:{onlyView:false},boxWidth:689,selectDay:'2099/01/01',errorArr:[{start:1,end:680}],disArr:[]};
assert.deepEqual(JSON.parse(JSON.stringify(ctx.segments(c))),[{start:480,end:600,kind:'free'},{start:600,end:1070,kind:'busy'},{start:1070,end:1080,kind:'free'},{start:1080,end:1320,kind:'busy'}]);
vm.runInContext(source.slice(source.indexOf('function available('),source.indexOf('function ranges(')),ctx);
assert.equal(ctx.available(c,480,510),true);
assert.equal(ctx.available(c,600,630),false);
assert.equal(ctx.available(c,1070,1080),false);
c.boxWidth=350;assert.equal(ctx.segments(c)[1].end,1070);
delete c.config.resvInfo;c.boxWidth=689;c.errorArr=[{start:196.85714285714283,end:336.29761904761904}];assert.equal(ctx.segments(c).find(x=>x.kind==='busy').start,720);assert.equal(ctx.segments(c).find(x=>x.kind==='busy').end,890);
let reduced=false,cancelled=0,options,frames;const panel={animate(f,o){frames=f;options=o;return {cancel(){cancelled++}}}};
const motion={window:{},matchMedia(){return {matches:reduced}}};vm.runInNewContext(fs.readFileSync('work/ios/motion.js','utf8'),motion);
motion.window.__amsIosAnimateRoute(panel,'/settings','/home');assert.equal(frames[0].transform,'translateX(-16px)');assert.equal(options.duration,220);
motion.window.__amsIosAnimateRoute(panel,'/home','/course');assert.equal(options.duration,120);assert.equal(cancelled,1);
reduced=true;motion.window.__amsIosAnimateRoute(panel,'/course','/home');assert.equal(cancelled,2);
// Validate scripts inside the serialized iframe, which outer-script syntax checks cannot cover.
const main=fs.readFileSync('outputs/ams-ios/Assets/ams-modern-ui.js','utf8');let found=0;
for(const match of main.matchAll(/"(?:[^"\\]|\\.)*"/g)){const doc=JSON.parse(match[0]);if(!doc.includes('function renderSettings(screen){'))continue;for(const script of doc.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);found++;}
assert(found>0);assert(!source.includes('for(const item of segments(c))'));
assert(source.includes("line.setAttribute('role','button')"));
const native=fs.readFileSync('outputs/ams-ios/Sources/CampusController.swift','utf8');
assert(!native.includes('bounces = false'));
assert(native.includes('preloader.page(for:key)'));
assert(main.includes('iosUpdateChrome(route)'));
assert(fs.readFileSync('work/ios/interface.css','utf8').includes('.app>header{display:none!important}'));
console.log('PASS: exact school times, ended reservations, width independence, rounded fallback, reversible/cancellable/reduced motion, iframe syntax.');
