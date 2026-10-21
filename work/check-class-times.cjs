const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('work/live-ui.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const a=script.indexOf('function times(c)'),b=script.indexOf('function show(',a);
const ctx={};vm.runInNewContext("const mins=t=>Number(t.split(':')[0])*60+Number(t.split(':')[1]);"+script.slice(a,b),ctx);
for(const [raw,expected] of [['14:00~15:00','14:00 — 14:50'],['15:00~17:00','15:00 — 16:50'],['11:00~13:00','11:00 — 12:50']]){
 const course={moduleTime:raw};assert.equal(ctx.displayTime(course),expected);assert.equal(course.moduleTime,raw);
}
assert.equal(ctx.times({moduleTime:'未提供'}),null);
const end=ctx.times({moduleTime:'14:00~15:00'})[1];
const minutes=s=>Number(s.split(':')[0])*60+Number(s.split(':')[1]);
assert(minutes('14:49')<minutes(end));assert(minutes('14:50')>=minutes(end));
assert(script.includes('mins(times(x.c)[1])<=n'));assert(script.includes('mins(t[1])-n'));
console.log('PASS: one/two-hour classes end 10 minutes early; 14:50 boundary; unchanged source data; shared countdown/state helper');
