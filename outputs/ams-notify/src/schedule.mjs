// Pure course-reminder planning: courses + prefs + now -> Live Activity push events.
// School times are China Standard Time regardless of the server or phone time zone.
export const CST_OFFSET_MS=8*3600e3;
export const MERGE_GAP_MS=30*60e3;
export const MAX_ACTIVITY_MS=8*3600e3;
export const LINGER_MS=5*60e3;
export const LEAD_CHOICES=[5,10,15,20,30];
export const DEFAULT_PREFS={enabled:true,leadMin:15,merge:true,mutedCodes:[],skipKeys:[]};

const DATE=/^(\d{4})-(\d{2})-(\d{2})$/,TIME=/^([01]\d|2[0-3]):([0-5]\d)$/;

export function cstMillis(date,time){
 const d=DATE.exec(date),t=TIME.exec(time);
 if(!d||!t)return NaN;
 return Date.UTC(+d[1],+d[2]-1,+d[3],+t[1],+t[2])-CST_OFFSET_MS;
}

const text=(value,max)=>typeof value==='string'&&value.length<=max;
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';

// Validates one uploaded course; returns null when unusable.
export function normalizeCourse(input){
 if(!input||typeof input!=='object')return null;
 if(!text(input.key,120)||!input.key||!text(input.date,10))return null;
 const startMs=cstMillis(input.date,input.start),endMs=cstMillis(input.date,input.end);
 if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)return null;
 return {key:input.key,date:input.date,startMs,endMs,title:clean(input.title,80)||'课程',code:clean(input.code,40),room:clean(input.room,60),location:clean(input.location,80)};
}

export function normalizePrefs(input){
 const p={...DEFAULT_PREFS};
 if(!input||typeof input!=='object')return p;
 if(typeof input.enabled==='boolean')p.enabled=input.enabled;
 if(LEAD_CHOICES.includes(input.leadMin))p.leadMin=input.leadMin;
 if(typeof input.merge==='boolean')p.merge=input.merge;
 const list=(value,max)=>Array.isArray(value)?[...new Set(value.filter(v=>text(v,120)&&v))].slice(0,max):[];
 p.mutedCodes=list(input.mutedCodes,100);
 p.skipKeys=list(input.skipKeys,100);
 return p;
}

const sec=ms=>Math.round(ms/1000);
const brief=c=>({title:c.title,code:c.code,room:c.room,start:sec(c.startMs),end:sec(c.endMs)});

// Content state shared with the iOS ActivityAttributes.ContentState (epoch seconds, not Date).
// left: classes later the same day, not counting this one (muted ones included: they still take place).
export function contentState(phase,course,next,left=0){
 return {phase,...brief(course),location:course.location,next:next?brief(next):null,left};
}
const laterToday=(all,course)=>all.filter(c=>c.date===course.date&&c.startMs>course.startMs).length;

export function chains(courses,prefs){
 const list=courses.filter(c=>!prefs.mutedCodes.includes(c.code)&&!prefs.skipKeys.includes(c.key)).sort((a,b)=>a.startMs-b.startMs);
 const out=[];
 for(const c of list){
  const last=out.at(-1),tail=last?.at(-1),lead=prefs.leadMin*60e3;
  if(prefs.merge&&tail&&c.startMs>=tail.endMs&&c.startMs-tail.endMs<=MERGE_GAP_MS&&c.endMs+LINGER_MS-(last[0].startMs-lead)<=MAX_ACTIVITY_MS)last.push(c);
  else out.push([c]);
 }
 return out;
}

// Which course of a chain is current at t, and whether class has started; null after the chain.
function stateAt(chain,t){
 for(let i=0;i<chain.length;i++){
  const c=chain[i];
  if(t<c.startMs)return {i,phase:'before'};
  if(t<c.endMs)return {i,phase:'during'};
 }
 return null;
}
const staleFor=(chain,i,phase)=>sec((phase==='before'?chain[i].startMs:chain[i].endMs)+LINGER_MS);
const stateFor=(chain,i,phase,all=chain)=>contentState(phase,chain[i],chain[i+1]||null,laterToday(all,chain[i]));

// Immediate update carrying the chain's state at `now`, e.g. when an update token arrives late.
export function syncEvent(courses,prefs,chainKey,now){
 const chain=chains(courses,prefs).find(c=>c[0].key===chainKey);
 const at=chain&&stateAt(chain,now);
 if(!at)return null;
 return {key:`${chainKey}:sync:${now}`,chain:chainKey,kind:'update',due:now,state:stateFor(chain,at.i,at.phase,courses),stale:staleFor(chain,at.i,at.phase)};
}

// Events for one device. endedChains: chain keys the person ended; localChains: started on the phone.
// Chains are formed from the whole timetable so a chain keeps its key after its first class ends.
export function planEvents(courses,prefs,now,{endedChains=[],localChains=[]}={}){
 if(!prefs.enabled)return [];
 const events=[];
 for(const chain of chains(courses,prefs)){
  const key=chain[0].key,first=chain[0],last=chain.at(-1);
  if(last.endMs<=now||endedChains.includes(key))continue;
  const lead=prefs.leadMin*60e3,startDue=Math.max(first.startMs-lead,now);
  const initial=stateAt(chain,startDue);
  if(!initial)continue;
  const stale=(i,phase)=>staleFor(chain,i,phase);
  const state=(i,phase)=>stateFor(chain,i,phase,courses);
  if(!localChains.includes(key))events.push({key:`${key}:start`,chain:key,kind:'start',due:startDue,state:state(initial.i,initial.phase),stale:stale(initial.i,initial.phase)});
  for(let i=initial.i;i<chain.length;i++){
   const c=chain[i];
   if(c.startMs>startDue)events.push({key:`${key}:during:${i}`,chain:key,kind:'update',due:c.startMs,state:state(i,'during'),stale:stale(i,'during')});
   if(i+1<chain.length&&c.endMs>startDue)events.push({key:`${key}:before:${i+1}`,chain:key,kind:'update',due:c.endMs,state:state(i+1,'before'),stale:stale(i+1,'before')});
  }
  events.push({key:`${key}:end`,chain:key,kind:'end',due:Math.max(last.endMs,startDue),state:contentState('after',last,null,laterToday(courses,last)),dismissal:sec(Math.max(last.endMs,startDue)+LINGER_MS)});
 }
 return events.sort((a,b)=>a.due-b.due);
}

export function startAlert(state){
 const hm=s=>new Date(s*1000+CST_OFFSET_MS).toISOString().slice(11,16);
 const where=state.room?` · ${state.room}`:'';
 return state.phase==='during'?{title:'正在上课',body:`${state.title}${where} · ${hm(state.end)} 下课`}:{title:'即将上课',body:`${state.title}${where} · ${hm(state.start)} 开始`};
}
