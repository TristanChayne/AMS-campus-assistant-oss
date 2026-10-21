import {iso,newId} from './registry.mjs';

// Ordinary iOS APNs notifications and Android foreground inbox messages sent from the admin console; app announcements
// clients pull on their per-open check. Announcements never need a push; pushing one is an explicit choice.
export class ApiError extends Error{
 constructor(status,code,message,fields){super(message);this.status=status;this.code=code;this.fields=fields;}
}
const bad=(message,fields)=>new ApiError(422,'INVALID',message,fields);
const str=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
function httpsUrl(v){
 if(v==null||v==='')return null;
 let u;try{u=new URL(v);}catch{}
 if(!u||u.protocol!=='https:'||u.username||u.password||v.length>500)throw bad('链接需为 https 地址',{url:'链接需为不含用户名密码的 https 地址'});
 return u.href;
}
function time(v,field){
 if(v==null||v==='')return null;
 const t=typeof v==='string'?Date.parse(v):NaN;
 if(!Number.isFinite(t))throw bad('时间格式不正确',{[field]:'时间格式不正确'});
 return t;
}

// ---- announcements
const PLATFORMS=['all','ios','android'];
export function announcementFields(b,{partial=false}={}){
 const f={};
 if(!partial||b.title!==undefined){if(!str(b.title,120))throw bad('请填写公告标题（120 字以内）',{title:'请填写公告标题（120 字以内）'});f.title=b.title.trim();}
 if(!partial||b.body!==undefined){if(!str(b.body,4000))throw bad('请填写公告正文（4000 字以内）',{body:'请填写公告正文（4000 字以内）'});f.body=b.body.trim();}
 if(!partial||b.platform!==undefined){if(!PLATFORMS.includes(b.platform))throw bad('请选择平台',{platform:'请选择平台'});f.platform=b.platform;}
 if(!partial||b.publishAt!==undefined)f.publish_at=time(b.publishAt,'publishAt');
 if(!partial||b.expiresAt!==undefined)f.expires_at=time(b.expiresAt,'expiresAt');
 if(b.important!==undefined){if(typeof b.important!=='boolean')throw bad('重要标记不正确');f.important=b.important?1:0;}
 if(b.url!==undefined)f.url=httpsUrl(b.url);
 return f;
}
export function announcementView(a){
 return {id:a.id,revision:a.revision,title:a.title,body:a.body,platform:a.platform,status:a.status,publishAt:iso(a.publish_at),expiresAt:iso(a.expires_at),important:!!a.important,url:a.url??null,createdAt:iso(a.created_at),updatedAt:iso(a.updated_at),publishedAt:iso(a.published_at),withdrawnAt:iso(a.withdrawn_at)};
}

// ---- notifications
const MAX_ATTEMPTS=5,BATCH=100;
const backoff=n=>Math.min(30e3*2**n,10*60e3);
export function messageFields(b,{partial=false}={}){
 const f={};
 if(b.channel!==undefined&&b.channel!=='notification')throw new ApiError(422,'UNSUPPORTED_CHANNEL','公告请在“应用公告”中发布');
 if(!partial||b.title!==undefined){if(!str(b.title,120))throw bad('请填写消息标题（120 字以内）',{title:'请填写消息标题（120 字以内）'});f.title=b.title.trim();}
 if(!partial||b.body!==undefined){if(!str(b.body,1000))throw bad('请填写消息正文（1000 字以内）',{body:'请填写消息正文（1000 字以内）'});f.body=b.body.trim();}
 if(!partial||b.platform!==undefined){
  if(!['ios','android'].includes(b.platform))throw new ApiError(422,'UNSUPPORTED_PLATFORM','请选择 Apple 通知或 Android App 内消息',{platform:'请选择一个平台'});
  f.platform=b.platform;
 }
 if(!partial||b.audience!==undefined){if(!['all','test'].includes(b.audience))throw bad('请选择接收范围',{audience:'请选择接收范围'});f.audience=b.audience;}
 if(!partial||b.scheduleAt!==undefined)f.schedule_at=time(b.scheduleAt,'scheduleAt');
 if(b.expiresAt!==undefined)f.expires_at=time(b.expiresAt,'expiresAt');
 if(b.url!==undefined)f.url=httpsUrl(b.url);
 const size=Buffer.byteLength(JSON.stringify(alertPayload({title:f.title||'',body:f.body||'',url:f.url})));
 if(size>3800)throw bad('消息内容过长',{body:'消息内容过长'});
 return f;
}
export function alertPayload(m){return {aps:{alert:{title:m.title,body:m.body},sound:'default'},...(m.url?{url:m.url}:{})};}

export class Messages{
 constructor(registry){this.r=registry;}
 q(sql){return this.r.q(sql);}
 get(id){return this.q('SELECT * FROM messages WHERE id=?').get(id);}
 list(){return this.q('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200').all();}
 counts(id){
  const rows=this.q('SELECT status,retryable,COUNT(*) AS n FROM message_deliveries WHERE message_id=? GROUP BY status,retryable').all(id);
  const c={total:0,accepted:0,failed:0,queued:0,retryable:0,available:0,offered:0,read:0};
  for(const r of rows){c.total+=r.n;if(r.status==='accepted')c.accepted+=r.n;else if(r.status==='queued')c.queued+=r.n;else if(r.status==='available')c.available+=r.n;else if(['offered','read'].includes(r.status)){c.offered+=r.n;if(r.status==='read')c.read+=r.n;}else{c.failed+=r.n;if(r.retryable)c.retryable+=r.n;}}
  return c;
 }
 view(m){
  const c=this.counts(m.id),submitted=m.status!=='draft'&&m.status!=='scheduled';
  return {id:m.id,revision:m.revision,channel:'notification',title:m.title,body:m.body,platform:m.platform,audience:m.audience,scheduleAt:iso(m.schedule_at),expiresAt:iso(m.expires_at),url:m.url??null,status:m.status,createdAt:iso(m.created_at),updatedAt:iso(m.updated_at),submittedAt:iso(m.submitted_at),announcementId:m.announcement_id??null,
   ...(m.reason?{reason:m.reason}:{}),retryable:c.retryable>0||(m.status==='failed'&&c.total===0),
   recipientCount:submitted?c.total:null,acceptedCount:submitted&&m.platform==='ios'?c.accepted:null,failedCount:submitted?c.failed:null,
   ...(m.platform==='android'?{availableCount:submitted?c.available:null,offeredCount:submitted?c.offered:null,readCount:submitted?c.read:null}:{})};
 }
 create(f,now,extra={}){
  if(extra.clientRequestId){const prev=this.q('SELECT * FROM messages WHERE client_request_id=?').get(extra.clientRequestId);if(prev)return prev;}
  const id=newId('msg');
  this.q('INSERT INTO messages(id,title,body,platform,audience,status,schedule_at,expires_at,url,announcement_id,client_request_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
   .run(id,f.title,f.body,f.platform,f.audience,'draft',f.schedule_at??null,f.expires_at??null,f.url??null,extra.announcementId??null,extra.clientRequestId??null,now,now);
  return this.get(id);
 }
 update(m,f,now){
  const keys=Object.keys(f);
  this.q(`UPDATE messages SET ${[...keys.map(k=>`${k}=?`),'revision=revision+1','updated_at=?'].join(',')} WHERE id=?`).run(...keys.map(k=>f[k]),now,m.id);
  return this.get(m.id);
 }
 // App installations that can receive an ordinary notification right now (D-021: every enabled iPhone that
 // reported a push token with its per-open check, whatever its course reminder choice).
 recipients(m){
  const rows=m.platform==='android'
   ?this.q("SELECT * FROM installations WHERE platform='android' AND inbox_supported=1").all()
   :this.q("SELECT * FROM installations WHERE platform='ios' AND alert_token IS NOT NULL").all();
  return rows.filter(i=>this.r.effective(i).enabled&&(m.audience!=='test'||Number(i.test)===1));
 }
 materialize(m,now){
  const list=this.recipients(m);
  const ins=this.q('INSERT OR IGNORE INTO message_deliveries(message_id,installation_id,status,at,account_name) VALUES(?,?,?,?,?)');
  for(const i of list)ins.run(m.id,i.id,m.platform==='android'?'available':'queued',now,i.account_name??null);
  return list.length;
 }
 setStatus(id,status,now,reason=null){this.q('UPDATE messages SET status=?,reason=?,updated_at=? WHERE id=?').run(status,reason,now,id);}
 // Called on submit (after validation) and when a scheduled message becomes due.
 start(m,now){
  if(m.expires_at&&m.expires_at<=now){this.setStatus(m.id,'failed',now,'消息已过有效期');return;}
  const n=this.materialize(m,now);
  this.q('UPDATE messages SET submitted_at=COALESCE(submitted_at,?) WHERE id=?').run(now,m.id);
  if(n===0)this.setStatus(m.id,'failed',now,m.platform==='android'?'没有登记收件能力的已启用 Android 设备':'没有可接收普通通知的设备');
  else this.setStatus(m.id,m.platform==='android'?'available_in_app':'queued',now);
 }
 // Android D-023: installed-device recipients are fixed when published. Reading requires the signed install check.
 inbox(installationId,readIds,now){
  return this.r.tx(()=>{
   const ack=this.q("UPDATE message_deliveries SET status='read',at=? WHERE installation_id=? AND message_id=? AND status='offered'");
   for(const id of readIds)ack.run(now,installationId,id);
   const rows=this.q(`SELECT m.* FROM message_deliveries dl JOIN messages m ON m.id=dl.message_id
    WHERE dl.installation_id=? AND dl.status IN ('available','offered') AND m.platform='android' AND m.status='available_in_app'
    AND (m.expires_at IS NULL OR m.expires_at>?) ORDER BY m.submitted_at,m.id LIMIT 10`).all(installationId,now);
   const offered=this.q("UPDATE message_deliveries SET status='offered',at=? WHERE installation_id=? AND message_id=? AND status='available'");
   for(const m of rows)offered.run(now,installationId,m.id);
   return rows.map(m=>({id:m.id,title:m.title,body:m.body,url:m.url??null,publishedAt:iso(m.submitted_at),expiresAt:iso(m.expires_at)}));
  });
 }
 retry(m,now){
  const c=this.counts(m.id);
  if(c.total===0){this.start(m,now);return true;}
  const r=this.q("UPDATE message_deliveries SET status='queued',attempts=0,next_try=NULL,reason=NULL,retryable=0,at=? WHERE message_id=? AND status='failed' AND retryable=1").run(now,m.id);
  if(!r.changes)return false;
  this.setStatus(m.id,'queued',now);
  return true;
 }
 finish(id,now){
  const c=this.counts(id);
  if(c.queued)return;
  const status=c.accepted===c.total?'accepted_by_apns':c.accepted>0?'partial':'failed';
  this.setStatus(id,status,now,status==='accepted_by_apns'?null:c.accepted>0?`${c.failed} 个对象未被 Apple 接收`:'所有对象均未被 Apple 接收');
 }
 async tick({apns,now=Date.now(),log=console}){
  for(const m of this.q("SELECT * FROM messages WHERE status='scheduled' AND schedule_at<=?").all(now))this.start(m,now);
  const rows=this.q(`SELECT dl.*,m.title,m.body,m.url,m.expires_at,i.alert_token,i.apns_env,i.bundle_id FROM message_deliveries dl JOIN messages m ON m.id=dl.message_id JOIN installations i ON i.id=dl.installation_id
   WHERE dl.status='queued' AND (dl.next_try IS NULL OR dl.next_try<=?) ORDER BY dl.at LIMIT ${BATCH}`).all(now);
  const touched=new Set();
  for(const row of rows){
   touched.add(row.message_id);
   this.q("UPDATE messages SET status='sending' WHERE id=? AND status='queued'").run(row.message_id);
   const fail=(reason,retryable)=>this.q("UPDATE message_deliveries SET status='failed',reason=?,retryable=?,attempts=attempts+1,at=? WHERE message_id=? AND installation_id=?").run(reason,retryable?1:0,now,row.message_id,row.installation_id);
   if(row.expires_at&&row.expires_at<=now){this.q("UPDATE message_deliveries SET status='expired',reason='消息已过有效期',at=? WHERE message_id=? AND installation_id=?").run(now,row.message_id,row.installation_id);continue;}
   const inst=this.r.installation(row.installation_id);
   if(!inst||!this.r.effective(inst).enabled){fail('设备已停用',true);continue;}
   if(!row.alert_token){fail('设备没有普通通知凭证',false);continue;}
   const r=await apns.send({env:row.apns_env,deviceToken:row.alert_token,topic:row.bundle_id||'cn.xjtlu.ams.ios',pushType:'alert',priority:10,payload:alertPayload(row),expiration:Math.floor((row.expires_at||now+86400e3)/1000)});
   if(r.status===200){this.q("UPDATE message_deliveries SET status='accepted',reason=NULL,attempts=attempts+1,at=? WHERE message_id=? AND installation_id=?").run(now,row.message_id,row.installation_id);continue;}
   const permanentToken=r.status===410||r.reason==='BadDeviceToken'||r.reason==='Unregistered';
   if(permanentToken){this.q('UPDATE installations SET alert_token=NULL WHERE id=?').run(row.installation_id);fail(`推送凭证已失效（${r.reason||r.status}）`,false);continue;}
   if(r.reason==='no-key'){fail('Apple 推送密钥未配置',true);continue;}
   const transient=r.status===0||r.status===429||r.status>=500;
   if(transient&&row.attempts+1<MAX_ATTEMPTS){this.q('UPDATE message_deliveries SET attempts=attempts+1,next_try=?,reason=? WHERE message_id=? AND installation_id=?').run(now+backoff(row.attempts),`重试中（${r.reason||r.status}）`,row.message_id,row.installation_id);continue;}
   fail(`Apple 未接收（${r.status} ${r.reason||''}）`.trim(),transient);
   log.warn?.('apns alert',r.status,r.reason);
  }
  for(const id of touched)this.finish(id,now);
  return rows.length;
 }
}
