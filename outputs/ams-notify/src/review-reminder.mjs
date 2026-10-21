import {createHash,randomUUID} from 'node:crypto';
import {payloadFor} from './apns.mjs';
const COURSE={title:'Programming with C++',code:'SOE106TC',room:'DE-2001'};
const DEFAULTS={decided:false,enabled:false,island:true,notify:false,leadMin:15,merge:true,mutedCodes:[],upload:false};
const TOKEN=/^[a-f0-9]{64,256}$/;
const PHASES=new Set(['before','during','after']);
const fail=(status,message)=>{const e=new Error(message);e.status=status;throw e;};
const date=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
const clock=t=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(t);
export function reviewPhase(phase,now){
 if(!PHASES.has(phase))fail(400,'演示阶段不正确');
 const minute=Math.floor(now/60000)*60,start=phase==='before'?minute+8*60:minute-10*60,end=phase==='after'?minute-60:start+50*60;
 return {phase,...COURSE,location:'演示教室',start,end,next:null,left:2};
}
// Demo cookie identities only; no normal reminder devices, courses, or push targets are touched.
export class ReviewReminder{
 constructor({db,registry,apns,allowedBundles,now=()=>Date.now()}){
  Object.assign(this,{db,registry,apns,allowedBundles,now});this.inflight=new Map();
  db.exec('CREATE TABLE IF NOT EXISTS review_reminders(id TEXT PRIMARY KEY,grant_id TEXT NOT NULL,fingerprint TEXT NOT NULL,expires INTEGER NOT NULL,json TEXT NOT NULL)');
 }
 valid(auth){
  const code=this.db.prepare('SELECT a.enabled,a.bound_devices FROM activation_codes a JOIN demo_codes d ON d.code_id=a.id WHERE a.id=?').get(auth.grant),install=this.registry.installationByFingerprint(auth.device);
  return auth.mode==='demo'&&auth.exp*1000>this.now()&&Number(code?.enabled)===1&&code.bound_devices.includes('|'+auth.device+'|')&&(!install||this.registry.effective(install).enabled);
 }
 load(id){const row=this.db.prepare('SELECT * FROM review_reminders WHERE id=?').get(id);return row?{...row,value:JSON.parse(row.json)}:null;}
 save(row){this.db.prepare('INSERT INTO review_reminders VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET expires=excluded.expires,json=excluded.json').run(row.id,row.grant_id,row.fingerprint,row.expires,JSON.stringify(row.value));}
 response(row){
  const v=row.value,s=v.state;
  return {ok:true,chain:v.chain,state:s,prefs:v.prefs,pending:v.pending,pushStatus:v.pushStatus,pushReady:!!this.apns.configured&&!!v.updateToken&&v.prefs.upload,revision:v.revision,
   schedule:{version:1,dates:[date(s.start*1000)],courses:[{key:v.chain,date:date(s.start*1000),start:clock(s.start*1000),end:clock(s.end*1000),...COURSE,location:'演示教室'}]}};
 }
 async push(row,event='update'){
  const v=row.value;
  if(!v.prefs.upload){v.pushStatus='local-only';return;}
  if(!v.updateToken){v.pushStatus='no-token';return;}
  if(!this.apns.configured){v.pushStatus='no-key';return;}
  const result=await this.apns.send({env:v.apnsEnv,deviceToken:v.updateToken,topic:v.bundleId+'.push-type.liveactivity',payload:payloadFor({kind:event,chain:v.chain,state:v.state,stale:v.state.phase==='before'?v.state.start:v.state.end,dismissal:event==='end'?Math.floor(this.now()/1000):undefined},{now:this.now()})});
  v.pushStatus=result.status===200?'apns-accepted':'apns-failed';
 }
 enqueue(id,work){
  const previous=this.inflight.get(id)||Promise.resolve();
  const task=previous.catch(()=>{}).then(work);this.inflight.set(id,task);
  return task.finally(()=>{if(this.inflight.get(id)===task)this.inflight.delete(id);});
 }
 handle(auth,data){return this.enqueue(auth.id,()=>this.perform(auth,data));}
 async perform(auth,data){
  if(!this.valid(auth))fail(403,'审核演示授权已停用或过期');
  if(!data||typeof data!=='object'||JSON.stringify(data).length>5000)fail(400,'演示请求不正确');
  let row=this.load(auth.id);
  if(!row)row={id:auth.id,grant_id:auth.grant,fingerprint:auth.device,expires:auth.exp*1000,value:{chain:'review-'+auth.id+'-'+randomUUID(),generation:1,state:reviewPhase('before',this.now()),prefs:{...DEFAULTS},pending:null,updateToken:null,apnsEnv:'production',bundleId:'cn.xjtlu.ams.ios',revision:0,pushStatus:'not-requested'}};
  row.expires=auth.exp*1000;const v=row.value,op=data.op;
  if(!['state','prefs','phase','activity','delete'].includes(op))fail(400,'演示操作不正确');
  if(op==='delete'){
   v.state=reviewPhase('after',this.now());await this.push(row,'end');this.db.prepare('DELETE FROM review_reminders WHERE id=?').run(auth.id);return {ok:true,deleted:true};
  }
  if(op==='prefs'){
   const p=data.prefs;if(!p||typeof p!=='object')fail(400,'提醒设置不正确');
   for(const k of ['decided','enabled','island','notify','merge','upload'])if(typeof p[k]!=='boolean')fail(400,'提醒开关不正确');
   if(![5,10,15,20,30].includes(p.leadMin)||!Array.isArray(p.mutedCodes)||p.mutedCodes.some(k=>k!==COURSE.code))fail(400,'提醒选项不正确');
   if((!p.upload||!p.enabled||!p.island||p.mutedCodes.includes(COURSE.code))&&v.updateToken){await this.push(row,'end');v.updateToken=null;}
   v.prefs=Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,p[k]]));
   if(!v.prefs.island&&!v.prefs.notify)v.prefs.enabled=false;
   if(!v.prefs.upload||!v.prefs.enabled||!v.prefs.island||v.prefs.mutedCodes.includes(COURSE.code))v.pending=null;
  }
  if(op==='activity'){
   if(data.chain!==v.chain)fail(409,'演示课程已重置，请刷新');
   if(data.updateToken!==undefined){
    if(!TOKEN.test(data.updateToken)||!['production','sandbox'].includes(data.apnsEnv)||!this.allowedBundles.includes(data.bundleId)||data.bundleId!=='cn.xjtlu.ams.ios')fail(400,'演示推送凭证不正确');
    v.updateToken=data.updateToken;v.apnsEnv=data.apnsEnv;v.bundleId=data.bundleId;
   }
   if(data.ended===true){v.state=reviewPhase('after',this.now());v.pending=null;}
  }
  if(op==='phase'){
   if(!PHASES.has(data.phase)||![0,15].includes(data.delaySeconds)||typeof data.requestId!=='string'||! /^[a-zA-Z0-9_-]{8,80}$/.test(data.requestId))fail(400,'演示阶段或操作编号不正确');
   const digest=createHash('sha256').update(JSON.stringify([data.phase,data.delaySeconds])).digest('hex');
   if(v.receipt?.id===data.requestId){if(v.receipt.digest!==digest)fail(409,'操作编号重复');return this.response(row);}
   if(data.delaySeconds===15&&(!v.prefs.enabled||!v.prefs.island||!v.prefs.upload||!v.updateToken||!this.apns.configured))fail(409,'请先开启云端灵动岛，确认推送已就绪后再测试后台切换');
   if((v.state.phase==='after'&&data.phase!=='after')||data.phase==='before'){if(v.updateToken){const end={...row,value:{...v,state:{...v.state,phase:'after'}}};await this.push(end,'end');}v.generation++;v.chain='review-'+auth.id+'-'+randomUUID();v.updateToken=null;}
   v.receipt={id:data.requestId,digest};v.revision++;
   if(data.delaySeconds===15){v.pending={phase:data.phase,due:this.now()+15000};v.pushStatus='queued';}
   else {v.state=reviewPhase(data.phase,this.now());v.pending=null;this.save(row);await this.push(row,data.phase==='after'?'end':'update');}
  }
  this.save(row);return this.response(row);
 }
 async tick(){
  for(const raw of this.db.prepare('SELECT id FROM review_reminders').all())await this.enqueue(raw.id,()=>this.advance(raw.id));
 }
 async advance(id){
  const row=this.load(id);if(!row)return;
  const v=row.value,auth={id:row.id,grant:row.grant_id,device:row.fingerprint,mode:'demo',exp:row.expires/1000};
  if(!this.valid(auth)){this.db.prepare('DELETE FROM review_reminders WHERE id=?').run(row.id);return;}
  let natural=null;if(!v.pending&&v.prefs.enabled){if(v.state.phase==='before'&&v.state.start*1000<=this.now())natural='during';if(v.state.phase!=='after'&&v.state.end*1000<=this.now())natural='after';}
  if(natural){v.state={...v.state,phase:natural};v.revision++;this.save(row);await this.push(row,natural==='after'?'end':'update');this.save(row);}
  if(v.pending&&v.pending.due<=this.now()){
   v.state=reviewPhase(v.pending.phase,this.now());v.pending=null;v.revision++;this.save(row);await this.push(row,v.state.phase==='after'?'end':'update');this.save(row);
  }
 }
}
