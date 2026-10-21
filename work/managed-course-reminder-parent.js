 // REMIND-001: normalized 3-day timetable for native reminders. School times are China Standard Time.
 // Native sets window.__amsCourseReminderBridge=true; it is pinged with ams-local://schedule and reads window.__amsSchedule.
 window.__amsSetCourseReminder=state=>{window.__amsCourseReminder=state;if(frame)frame.contentWindow.postMessage({amsUiData:{courseReminder:state}},'*');};
 let lastSchedule='';
 function cstToday(){const d=new Date(Date.now()+8*3600e3);return [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()];}
 function scheduleDate(text){
  const s=String(text||'').trim(),full=s.match(/(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/),short=s.match(/(\d{1,2})[-\/.月](\d{1,2})/);
  if(!full&&!short)return null;
  const [ty,tm,td]=cstToday(),month=Number((full||short)[full?2:1]),date=Number((full||short)[full?3:2]),today=Date.UTC(ty,tm-1,td);
  let year=full?Number(full[1]):[ty-1,ty,ty+1].sort((a,b)=>Math.abs(Date.UTC(a,month-1,date)-today)-Math.abs(Date.UTC(b,month-1,date)-today))[0];
  const v=new Date(Date.UTC(year,month-1,date));if(v.getUTCMonth()!==month-1||v.getUTCDate()!==date)return null;
  return year+'-'+String(month).padStart(2,'0')+'-'+String(date).padStart(2,'0');
 }
 // Same rule as the timetable display: shown end time is 10 minutes before the school end time.
 function scheduleTimes(c){const m=String(c.moduleTime||'').match(/\d{1,2}:\d{2}/g);if(!m||m.length<2)return null;const v=t=>Number(t.split(':')[0])*60+Number(t.split(':')[1]),f=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');const start=v(m[0]),end=v(m[1])-10;if(end<=start||start<0||v(m[1])>24*60)return null;return {start:f(start),end:f(end),rawEnd:f(v(m[1]))};}
 function buildSchedule(days){
  const dates=[],courses=[];
  for(const day of days){const date=scheduleDate(day&&day.date);if(!date||!Array.isArray(day.timetableVoList))continue;dates.push(date);
   for(const c of day.timetableVoList){const t=scheduleTimes(c);if(!t)continue;const code=String(c.moduleCode||'').trim();
    courses.push({key:(date+'|'+t.start+'|'+(c.id!=null?c.id:code||c.moduleTitle||'')).slice(0,120),date,start:t.start,end:t.end,rawEnd:t.rawEnd,title:String(c.moduleTitle||'课程').trim().slice(0,80),code:code.slice(0,40),room:String(c.room||'').trim().slice(0,60),location:String(c.location||'').trim().slice(0,80)});}}
  return {version:1,dates,courses};
 }
 function publishSchedule(){
  if(!window.__amsCourseReminderBridge||!cachedDays.length)return;
  // Cached days can reach beyond the latest 3-day fetch (managed-timetable-cache.js).
  const cached=typeof cachedReminderDays==='function'?cachedReminderDays():[];
  const snapshot=buildSchedule(cached.length?cached:cachedDays),json=JSON.stringify(snapshot);
  if(json===lastSchedule||!snapshot.dates.length)return;
  lastSchedule=json;window.__amsSchedule=snapshot;location.href='ams-local://schedule';
 }
