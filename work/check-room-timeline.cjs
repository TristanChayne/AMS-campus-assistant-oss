const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('outputs/ams-android/app/src/main/assets/library-room-ui.js','utf8');
const fn=source.slice(source.indexOf('function segments('),source.indexOf("let clockSignature="));
const ctx={};vm.createContext(ctx);vm.runInContext("const minutes=t=>{const p=String(t).split(':').map(Number);return p[0]*60+p[1]};"+fn,ctx);
const c={config:{openStart:'08:00',openEnd:'22:00',resvRule:{minResvTime:30,maxResvTime:180}},resInfo:{onlyView:false},boxWidth:840,selectDay:'2099/01/01',isShowAll:false,errorArr:[{start:120,end:240},{start:420,end:540}],disArr:[{start:0,end:60}],$refs:{showLatestRT:{style:{left:'0%',width:'0%'}}}};
assert.deepEqual(JSON.parse(JSON.stringify(ctx.segments(c))),[{start:480,end:540,kind:'closed'},{start:540,end:600,kind:'free'},{start:600,end:720,kind:'busy'},{start:720,end:900,kind:'free'},{start:900,end:1020,kind:'busy'},{start:1020,end:1320,kind:'free'}]);
c.errorArr=[{start:120,end:240},{start:180,end:300}];assert.equal(ctx.segments(c).filter(x=>x.kind==='busy').length,1);assert.equal(ctx.segments(c).find(x=>x.kind==='busy').end,780);
c.resInfo.onlyView=true;assert(ctx.segments(c).every(x=>x.kind==='closed'));
console.log('PASS: whole-day timeline, exact occupied boundaries, overlapping block union, closed intervals and view-only rooms.');
