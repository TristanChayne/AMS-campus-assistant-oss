const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('outputs/ams-android/app/src/main/assets/library-room-ui.js','utf8');
const available=source.slice(source.indexOf('function available('),source.indexOf('function ranges('));
const ctx={};vm.createContext(ctx);vm.runInContext("const minutes=t=>{const p=String(t).split(':').map(Number);return p[0]*60+p[1]};"+available,ctx);
const c={config:{openStart:'08:00',openEnd:'22:00',resvRule:{minResvTime:30,maxResvTime:180}},resInfo:{onlyView:false},isShowAll:false,isLatestResvTime:true,selectDay:'2099/01/01',boxWidth:840,errorArr:[{start:420,end:480}],disArr:[],$refs:{showLatestRT:{style:{left:'10%',width:'0%'}}}};
assert(!ctx.available(c,NaN,NaN));assert(ctx.available(c,9*60,10*60));assert(!ctx.available(c,8*60,8*60+10));assert(!ctx.available(c,9*60,13*60));assert(!ctx.available(c,14*60,16*60));assert(ctx.available(c,13*60,15*60));c.resInfo.onlyView=true;assert(!ctx.available(c,9*60,10*60));c.resInfo.onlyView=false;c.$refs.showLatestRT.style={left:'0%',width:'50%'};assert(!ctx.available(c,9*60,10*60));
assert(source.includes('c.up()'));assert(!source.includes('submitBtn('));assert(source.includes('overflow-wrap:anywhere'));
console.log('PASS: room intervals, boundary overlap, min/max duration, only-view, latest-time overlay, school confirmation delegation and wrapping policy title; no live submission.');
