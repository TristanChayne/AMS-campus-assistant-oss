 // Timetable cache: per account, per China-time date. A school fetch replaces only the dates it returns (an empty
 // list included); other dates stay. Dates older than 3 days are dropped (margin for phones in other time zones).
 // The cache only fills the home screen until the school's answer arrives; it never replaces that answer.
 const TIMETABLE_CACHE_PREFIX='amsTimetableCache:v1:';
 let timetableFromCache=false,lastTimetableCache='';
 function timetableCacheKey(){
  let user=null;try{user=JSON.parse(sessionStorage.getItem('amsuserInfo')||'null');}catch(e){}
  const id=user&&(user.account||user.userName||user.username||user.studentCode||user.name);
  if(!id)return '';
  let h=5381;for(const ch of String(id))h=((h*33)^ch.charCodeAt(0))>>>0;
  return TIMETABLE_CACHE_PREFIX+h.toString(36);
 }
 function cstOffsetDate(days){const [y,m,d]=cstToday(),v=new Date(Date.UTC(y,m-1,d+days));return v.getUTCFullYear()+'-'+String(v.getUTCMonth()+1).padStart(2,'0')+'-'+String(v.getUTCDate()).padStart(2,'0');}
 function readTimetableCache(){
  const key=timetableCacheKey();if(!key)return null;
  try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&v.version===1&&v.days&&typeof v.days==='object'?v:{version:1,days:{}};}catch(e){return {version:1,days:{}};}
 }
 const keepLesson=c=>({id:c.id,moduleTitle:c.moduleTitle,moduleCode:c.moduleCode,moduleTime:c.moduleTime,room:c.room,location:c.location,moduleTypeGroup:c.moduleTypeGroup});
 function storeTimetable(days){
  const key=timetableCacheKey(),cache=readTimetableCache();if(!key||!cache)return;
  for(const day of days){const iso=scheduleDate(day&&day.date);if(iso&&Array.isArray(day.timetableVoList))cache.days[iso]={date:String(day.date).trim(),timetableVoList:day.timetableVoList.map(keepLesson)};}
  const oldest=cstOffsetDate(-3);
  for(const iso of Object.keys(cache.days))if(iso<oldest)delete cache.days[iso];
  const json=JSON.stringify(cache);
  if(json===lastTimetableCache)return;
  lastTimetableCache=json;
  try{localStorage.setItem(key,json);}catch(e){}
 }
 // Up to three cached days from today (China time), in the school's own date text, for the home screen.
 function cachedHomeDays(){
  const cache=readTimetableCache();if(!cache)return [];
  const today=cstOffsetDate(0);
  return Object.keys(cache.days).filter(iso=>iso>=today).sort().slice(0,3).map(iso=>cache.days[iso]);
 }
 // Every cached day from yesterday on, with ISO dates, for native reminders (can reach beyond the latest 3-day fetch).
 function cachedReminderDays(){
  const cache=readTimetableCache();if(!cache)return [];
  const from=cstOffsetDate(-1);
  return Object.keys(cache.days).filter(iso=>iso>=from).sort().map(iso=>({date:iso,timetableVoList:cache.days[iso].timetableVoList}));
 }
 function clearTimetableCaches(){try{for(const key of Object.keys(localStorage))if(key.startsWith(TIMETABLE_CACHE_PREFIX))localStorage.removeItem(key);}catch(e){}lastTimetableCache='';}
