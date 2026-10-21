const fs=require('fs'),vm=require('vm'),assert=require('assert');
const script=fs.readFileSync('work/live-ui.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes={};let timestamp='2026-10-06T23:59:00';
class Clock extends Date{constructor(...args){super(...(args.length?args:[timestamp]));}}
const ctx={Date:Clock,document:{getElementById:id=>nodes[id]||(nodes[id]={style:{}}),querySelector:sel=>nodes[sel]||(nodes[sel]={style:{}}),querySelectorAll:()=>[]},escape:s=>String(s||''),icon:()=>'',render:()=>{},detail:()=>{}};
vm.createContext(ctx);
vm.runInContext("let days=[],selected=0,ready=true,followToday=true;const mins=t=>Number(t.split(':')[0])*60+Number(t.split(':')[1]);const rows=()=>days[selected].timetableVoList;"+script.slice(script.indexOf('function times(c)'),script.indexOf('function show('))+script.slice(script.indexOf('function dayOffset('),script.indexOf('const campusMapImages=',script.indexOf('function dayOffset('))),ctx);
function run(s){return vm.runInContext(s,ctx);}
run("days=['10-06','10-07','10-08'].map(date=>({date,timetableVoList:[{moduleTime:'09:00~10:00',moduleTitle:'Morning'},{moduleTime:'16:00~17:00',moduleTitle:'Afternoon'}]}));renderHome()");
assert.equal(run('selected'),0);
// Same unchanged AMS snapshot after midnight; prior manual choice must reset.
run('followToday=false;selected=0');timestamp='2026-10-07T00:01:00';run('renderHome()');assert.equal(run('selected'),1);
assert(nodes.week.innerHTML.includes('昨天'));assert(nodes.week.innerHTML.includes('今天'));assert(nodes.week.innerHTML.includes('明天'));
run('followToday=false;selected=0;renderHome()');assert(nodes.completed.innerHTML.includes('昨天已结束 · 2'));assert(!nodes.lessons.innerHTML.includes('待上课'));assert.equal(nodes.focus.innerHTML,'');
// First paint in afternoon, with today at first position as in refreshed AMS.
timestamp='2026-10-07T15:00:00';run("days=['10-07','10-08','10-09'].map(date=>({date,timetableVoList:[{moduleTime:'16:00~17:00',moduleTitle:'Afternoon'},{moduleTime:'09:00~10:00',moduleTitle:'Morning'}]}));followToday=true;renderHome()");assert.equal(run('selected'),0);assert(nodes.completed.innerHTML.includes('Morning'));assert(nodes.focus.innerHTML.includes('Afternoon'));assert(!nodes.focus.innerHTML.includes('Morning'));assert(nodes.focus.innerHTML.includes('60 分钟后开始'));
timestamp='2026-10-07T16:10:00';run('renderHome()');assert(nodes.focus.innerHTML.includes('正在上课'));
timestamp='2026-10-07T16:50:00';run('renderHome()');assert.equal(nodes.focus.innerHTML,'');assert(nodes.completed.innerHTML.includes('2 节课'));
// AMS omits today entirely when there are no classes: preserve all future dates.
 timestamp='2026-10-08T15:17:00';run("days=['10-09','10-11','10-12'].map(date=>({date,timetableVoList:[{moduleTime:'14:00~16:00',moduleTitle:'Future English'}]}));followToday=true;renderHome()");
 assert.equal(run('selected'),0);assert.equal(run('days.length'),4);assert(nodes.week.innerHTML.includes('10-08'));assert(!nodes.week.innerHTML.includes('2026-10-08'));assert(nodes.week.innerHTML.includes('10-12'));assert(!nodes.week.innerHTML.includes('<small>后天</small>'));assert(nodes.lessons.innerHTML.includes('当天没有课程'));assert.equal(nodes.focus.innerHTML,'');assert(!nodes.completed.innerHTML);assert(nodes.count.textContent.includes('0 节课'));
 run('renderHome();renderHome()');assert.equal(run('days.length'),4);
 run('followToday=false;selected=1;renderHome()');assert(nodes.focus.innerHTML.includes('Future English'));assert(!nodes.focus.innerHTML.includes('正在上课'));assert.equal(nodes.completed.innerHTML,'');run('renderHome()');assert.equal(run('selected'),1);
 timestamp='2026-10-09T15:17:00';run('renderHome()');assert.equal(run('days.length'),3);assert.equal(run('selected'),0);assert(nodes.focus.innerHTML.includes('正在上课'));
 run("days=[{date:'-',timetableVoList:[]}];ready=false;followToday=true;renderHome()");assert(!nodes.lessons.innerHTML.includes('当天没有课程'));assert(nodes.lessons.innerHTML.includes('正在读取学校课表'));
assert.equal(run("dayOffset({date:'12-31'},new Date(2027,0,1))"),-1);assert.equal(run("dayOffset({date:'01-01'},new Date(2026,11,31))"),1);assert.equal(run("dayOffset({date:'2026-10-07'},new Date(2026,9,7))"),0);assert.equal(run("dayOffset({date:'-'})"),null);
assert(script.includes("setInterval(refreshClock,1000)"));assert(script.includes("visibilitychange"));assert(fs.readFileSync('outputs/ams-android/app/src/main/java/cn/local/ams/MainActivity.java','utf8').includes('window.__amsRefreshClock && window.__amsRefreshClock();'));
// Labels beyond 后天: weekday this week, 下周X next week, month/day further out; title follows the selected day; 回到今天 only off today.
timestamp='2026-10-12T09:00:00';run("days=['10-13','10-15','10-19','10-27'].map(date=>({date,timetableVoList:[{moduleTime:'14:00~15:00',moduleTitle:'Later'}]}));ready=true;followToday=true;renderHome()");
assert(nodes.week.innerHTML.includes('<small>今天</small>')&&nodes.week.innerHTML.includes('<small>明天</small>')&&nodes.week.innerHTML.includes('<small>周四</small>')&&nodes.week.innerHTML.includes('<small>下周一</small>')&&nodes.week.innerHTML.includes('<small>10月27日</small>'));
assert.equal(nodes.h1.textContent,'今日课表');assert.equal(nodes.today.hidden,true);
run('followToday=false;selected=1;renderHome()');assert.equal(nodes.h1.textContent,'明日课表');assert.equal(nodes.today.hidden,false);
run('selected=3;renderHome()');assert.equal(nodes.h1.textContent,'下周一课表');assert(nodes.listTitle.textContent.includes('下周一'));
run('selected=4;renderHome()');assert.equal(nodes.h1.textContent,'10月27日课表');
assert.equal(run("latin('Creative Innovator\u2019s Toolkit')"),' lang="en"');assert.equal(run("latin('中文课程')"),'');
console.log('PASS: unchanged midnight data, today selection, yesterday completion, afternoon first paint, active/end boundaries, year crossover, foreground refresh, weekday / next-week / date labels, day-following title, today button and Latin title language');

