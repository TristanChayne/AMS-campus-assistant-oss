import {iso,newId} from './registry.mjs';
import {ApiError,Messages,announcementFields,announcementView,messageFields} from './messages.mjs';

// Admin console API added by ADMIN-BE-001 (same origin, /api/admin/*). Login, profile, logout, codes, update,
// settings and credentials stay in the activation worker unchanged; this module serves the rest after the
// same ams_admin cookie check. Responses never include device secrets, push tokens, passwords or cookies.
const DAY=86400e3;
const notFound=()=>new ApiError(404,'NOT_FOUND','记录不存在');
const conflict=m=>new ApiError(409,'CONFLICT',m);

function maskId(v){return v?`••••${String(v).slice(-4)}`:null;}
function chinaMidnight(now){const d=new Date(now+8*3600e3);d.setUTCHours(0,0,0,0);return d.getTime()-8*3600e3;}
function pushStatus(status,sent){
 if(!status)return {status:'queued'};
 if(status==='sent')return {status:'accepted_by_apns'};
 if(status==='wait-token')return {status:'queued',reason:'等待设备上报推送凭证'};
 if(status.startsWith('retry:'))return {status:sent?'failed':'queued',reason:`重试中（${status.slice(6)}）`,retryable:true};
 if(status==='no-token')return {status:'failed',reason:'设备没有上报推送凭证',retryable:false};
 if(status==='no-key')return {status:'failed',reason:'Apple 推送密钥未配置',retryable:false};
 if(status==='disabled')return {status:'failed',reason:'设备已停用',retryable:false};
 if(status==='expired')return {status:'expired',reason:'超过发送时限'};
 if(status==='superseded')return {status:'expired',reason:'已被更新的状态取代'};
 if(status.startsWith('fail:'))return {status:'failed',reason:`Apple 未接收（${status.slice(5)}）`,retryable:false};
 return {status:'failed',reason:status};
}

export function createAdmin({registry,store,apns,validateIosRelease,now=()=>Date.now()}){
 const messages=new Messages(registry);
 const q=sql=>registry.q(sql);

 function requireRevision(row,b){if(!Number.isInteger(b.revision))throw new ApiError(422,'INVALID','缺少记录版本');if(b.revision!==row.revision)throw conflict('记录已被修改，请刷新后再试');}
 // Idempotent final actions: a repeated key returns the first result before any revision check.
 function idempotent(b,target,run){
  if(typeof b.idempotencyKey!=='string'||b.idempotencyKey.length<8||b.idempotencyKey.length>100)throw new ApiError(422,'INVALID','缺少提交编号');
  if(b.confirmed!==true)throw new ApiError(422,'INVALID','请先完成确认');
  const key=`${target}:${b.idempotencyKey}`,prev=registry.submission(key);
  if(prev)return {status:prev.status,body:JSON.parse(prev.body)};
  const out=registry.tx(()=>{const r=run();registry.saveSubmission(key,target,r.status,r.body,now());return r;});
  return out;
 }
 function apnsReady(){if(!apns.configured)throw new ApiError(503,'APNS_NOT_CONFIGURED','Apple 推送密钥尚未配置，暂不能发送普通通知');}

 const devicePublic=d=>{const {_seen,_notify,_install,...rest}=d;return rest;};
 function courseList(notifyId){
  if(!notifyId)return [];
  return store.courses(notifyId).map(c=>({key:c.key,date:c.date,start:new Date(c.startMs+8*3600e3).toISOString().slice(11,16),end:new Date(c.endMs+8*3600e3).toISOString().slice(11,16),title:c.title,code:c.code,room:c.room,location:c.location,startAt:iso(c.startMs),endAt:iso(c.endMs)})).sort((a,b)=>a.startAt<b.startAt?-1:1);
 }
 function eventRecords(where,args,limit=100){
  return q(`SELECT e.device_id,e.key,e.kind,e.due,e.sent_at,e.status,e.attempts,e.next_try,e.account_name,d.apns_env FROM events e JOIN devices d ON d.id=e.device_id ${where} ORDER BY COALESCE(e.sent_at,e.next_try,e.due) DESC LIMIT ${limit}`).all(...args)
   .map(r=>{const s=pushStatus(r.status,r.sent_at!=null);return {id:`${r.device_id}:${r.key}`,deviceId:r.device_id,accountName:r.account_name??null,kind:r.kind,...s,at:iso(r.sent_at??r.next_try??r.due),environment:r.apns_env,scheduledAt:iso(r.due),attemptedAt:iso(r.sent_at),acceptedAt:r.status==='sent'?iso(r.sent_at):null,attempts:null,nextRetryAt:r.sent_at==null?iso(r.next_try):null};});
 }
 function deliveryRecords(limit=100){
  return q(`SELECT dl.*,i.apns_env FROM message_deliveries dl JOIN installations i ON i.id=dl.installation_id WHERE i.platform='ios' ORDER BY dl.at DESC LIMIT ${limit}`).all()
   .map(r=>({id:`${r.message_id}:${r.installation_id}`,deviceId:r.installation_id,messageId:r.message_id,accountName:r.account_name??null,kind:'notification',status:r.status==='accepted'?'accepted_by_apns':r.status==='queued'?'queued':r.status==='expired'?'expired':'failed',...(r.reason?{reason:r.reason}:{}),retryable:!!r.retryable,at:iso(r.at),environment:r.apns_env,acceptedAt:r.status==='accepted'?iso(r.at):null,attempts:r.attempts,nextRetryAt:r.status==='queued'?iso(r.next_try):null}));
 }

 const routes=[
  ['GET',/^overview$/,()=>{
   const t=now(),rows=registry.deviceRows(t),midnight=chinaMidnight(t);
   const pending=q('SELECT COUNT(*) AS n FROM events WHERE sent_at IS NULL').get().n+q("SELECT COUNT(*) AS n FROM message_deliveries WHERE status='queued'").get().n;
   const accepted=q("SELECT COUNT(*) AS n FROM events WHERE status='sent' AND sent_at>=?").get(t-2*DAY).n+q("SELECT COUNT(*) AS n FROM message_deliveries WHERE status='accepted' AND at>=?").get(t-2*DAY).n;
   return {asOf:iso(t),rangeStartAt:iso(t-2*DAY),
    activationCount:q('SELECT COUNT(*) AS n FROM activation_codes').get().n,
    deviceCount:rows.length,
    activeDeviceCount:rows.filter(r=>r.activation.state==='active').length,
    disabledDeviceCount:rows.filter(r=>r.activation.state==='disabled').length,
    legacyDeviceCount:rows.filter(r=>r.activation.state==='legacy_pending').length,
    connectedTodayCount:rows.filter(r=>(r._seen||0)>=midnight).length,
    pendingCount:pending,acceptedCount:accepted,
    activeAnnouncementCount:registry.activeAnnouncements('all',t).length+q("SELECT COUNT(*) AS n FROM announcements WHERE status='published' AND platform<>'all' AND (publish_at IS NULL OR publish_at<=?) AND (expires_at IS NULL OR expires_at>?)").get(t,t).n,
    services:{activation:{status:'ready',checkedAt:iso(t)},notify:{status:'ready',checkedAt:iso(t)},apns:{status:apns.configured?'ready':'not_configured',checkedAt:iso(t),...(apns.configured?{}:{message:'Apple 推送密钥尚未配置'})}}};
  }],
  ['GET',/^devices$/,(m,b,url)=>{
   const t=now(),p=url.searchParams,qs=(p.get('q')||'').trim().toLowerCase();
   let rows=registry.deviceRows(t);
   if(qs)rows=rows.filter(r=>[r.id,r.accountName,r.activation.codeId,r.activation.note,r.model].some(v=>v&&String(v).toLowerCase().includes(qs)));
   if(p.get('platform'))rows=rows.filter(r=>r.platform===p.get('platform'));
   if(p.get('apnsEnv'))rows=rows.filter(r=>r.apnsEnv===p.get('apnsEnv'));
   if(p.get('state')||p.get('status'))rows=rows.filter(r=>r.activation.state===(p.get('state')||p.get('status')));
   if(p.get('codeId'))rows=rows.filter(r=>r.activation.codeId===p.get('codeId'));
   const limit=Math.min(Math.max(parseInt(p.get('limit')||'100',10)||100,1),200),start=Math.max(parseInt(p.get('cursor')||'0',10)||0,0);
   return {items:rows.slice(start,start+limit).map(devicePublic),nextCursor:start+limit<rows.length?String(start+limit):null,total:rows.length};
  }],
  ['GET',/^devices\/([^/]+)$/,([id])=>{
   const d=registry.findDevice(id,now());if(!d)throw notFound();
   return {device:devicePublic(d),courses:courseList(d._notify),events:d._notify?eventRecords('WHERE e.device_id=?',[d._notify],50):[]};
  }],
  ['PATCH',/^devices\/([^/]+)$/,([id],b)=>{
   const inst=registry.installation(id);
   if(!inst)throw registry.findDevice(id,now())?new ApiError(409,'NOT_LINKED','该设备尚未关联激活安装，不能单独停用'):notFound();
   if(b.enabled!==undefined&&typeof b.enabled!=='boolean')throw new ApiError(422,'INVALID','参数不正确');
   if(b.enabled!==undefined&&b.confirmed!==true)throw new ApiError(422,'INVALID','请先完成确认');
   if(b.test!==undefined&&typeof b.test!=='boolean')throw new ApiError(422,'INVALID','参数不正确');
   registry.setInstallation(id,{enabled:b.enabled,test:b.test},now());
   return {device:devicePublic(registry.findDevice(id,now()))};
  }],
  ['DELETE',/^devices\/([^/]+)$/,([id])=>{
   const d=registry.findDevice(id,now());if(!d)throw notFound();
   // Removes the uploaded timetable, reminder settings, tokens, activities and pending pushes; the installation,
   // its authorization link and any disable stay, so registering again cannot lift a disable.
   if(d._notify)store.deleteDevice(d._notify);
   return {ok:true};
  }],

  ['GET',/^announcements$/,()=>{registry.announcementsDue(now());return {items:registry.announcements().map(announcementView)};}],
  ['POST',/^announcements$/,(m,b)=>{
   const key=typeof b.clientRequestId==='string'&&b.clientRequestId.length>=8&&b.clientRequestId.length<=100?b.clientRequestId:null;
   if(key){const prev=q('SELECT * FROM announcements WHERE client_request_id=?').get(key);if(prev)return [201,{announcement:announcementView(prev)}];}
   const f=announcementFields(b),t=now(),id=newId('ann');
   if(f.publish_at&&f.expires_at&&f.expires_at<=f.publish_at)throw new ApiError(422,'INVALID','结束时间需晚于发布时间',{expiresAt:'结束时间需晚于发布时间'});
   q("INSERT INTO announcements(id,title,body,platform,status,publish_at,expires_at,important,url,client_request_id,created_at,updated_at) VALUES(?,?,?,?,'draft',?,?,?,?,?,?,?)").run(id,f.title,f.body,f.platform,f.publish_at,f.expires_at,f.important??0,f.url??null,key,t,t);
   return [201,{announcement:announcementView(registry.announcement(id))}];
  }],
  ['PATCH',/^announcements\/([^/]+)$/,([id],b)=>{
   const a=registry.announcement(id);if(!a)throw notFound();requireRevision(a,b);
   // Saving never changes what clients see: a published or scheduled announcement is withdrawn first.
   if(!['draft','withdrawn'].includes(a.status))throw conflict('请先下架公告再编辑');
   const f=announcementFields(b,{partial:true}),pub=f.publish_at!==undefined?f.publish_at:a.publish_at,exp=f.expires_at!==undefined?f.expires_at:a.expires_at;
   if(pub&&exp&&exp<=pub)throw new ApiError(422,'INVALID','结束时间需晚于发布时间',{expiresAt:'结束时间需晚于发布时间'});
   const t=now();
   const keys=Object.keys(f);
   q(`UPDATE announcements SET ${[...keys.map(k=>`${k}=?`),'revision=revision+1','updated_at=?'].join(',')} WHERE id=?`).run(...keys.map(k=>f[k]),t,id);
   return {announcement:announcementView(registry.announcement(id))};
  }],
  ['POST',/^announcements\/([^/]+)\/publish$/,([id],b)=>{
   const a=registry.announcement(id);if(!a)throw notFound();
   const run=()=>{
    requireRevision(a,b);
    if(!['draft','withdrawn'].includes(a.status))throw conflict('公告已发布或已排期');
    const t=now(),publishAt=a.publish_at&&a.publish_at>t?a.publish_at:t;
    if(a.expires_at&&a.expires_at<=publishAt)throw new ApiError(422,'INVALID','结束时间需晚于实际发布时间',{expiresAt:'结束时间需晚于实际发布时间'});
    let message=null;
    if(b.push===true){
     // Optional push of the announcement text to iOS devices; never implied by publishing.
     if(a.platform==='android')throw new ApiError(422,'UNSUPPORTED_PLATFORM','Android 暂无远程推送');
     if(a.body.length>500)throw new ApiError(422,'INVALID','正文超过 500 字的公告不能额外推送',{body:'额外推送时正文需在 500 字以内'});
     if(!['test','all'].includes(b.audience))throw new ApiError(422,'INVALID','请选择推送范围',{audience:'请选择推送范围'});
     apnsReady();
     const draft=messages.create({title:a.title,body:a.body,platform:'ios',audience:b.audience,schedule_at:publishAt>t?publishAt:null,expires_at:a.expires_at,url:a.url},t,{announcementId:a.id});
     if(draft.schedule_at)messages.setStatus(draft.id,'scheduled',t);
     else{if(!messages.recipients(draft).length)throw new ApiError(422,'NO_RECIPIENTS','没有可接收普通通知的设备');messages.start(draft,t);}
     message=messages.view(messages.get(draft.id));
    }
    // Each publish is a new revision, so clients that confirmed an earlier version show this one again.
    const scheduled=publishAt>t;
    q('UPDATE announcements SET status=?,publish_at=?,published_at=?,withdrawn_at=NULL,revision=revision+1,updated_at=? WHERE id=?').run(scheduled?'scheduled':'published',publishAt,scheduled?null:t,t,id);
    return {status:200,body:{announcement:announcementView(registry.announcement(id)),...(message?{message}:{})}};
   };
   const r=idempotent(b,`ann:${id}`,run);
   return [r.status,r.body];
  }],
  ['POST',/^announcements\/([^/]+)\/withdraw$/,([id],b)=>{
   const a=registry.announcement(id);if(!a)throw notFound();
   const r=idempotent(b,`withdraw:${id}`,()=>{
    requireRevision(a,b);
    if(!['published','scheduled'].includes(a.status))throw conflict('公告未发布');
    const t=now();q("UPDATE announcements SET status='withdrawn',withdrawn_at=?,revision=revision+1,updated_at=? WHERE id=?").run(t,t,id);
    return {status:200,body:{announcement:announcementView(registry.announcement(id))}};
   });
   return [r.status,r.body];
  }],
  ['DELETE',/^announcements\/([^/]+)$/,([id])=>{
   const a=registry.announcement(id);if(!a)throw notFound();
   if(!['draft','withdrawn'].includes(a.status))throw conflict('请先下架公告再删除');
   q('DELETE FROM announcements WHERE id=?').run(id);return {ok:true};
  }],

  ['GET',/^messages$/,()=>({items:messages.list().map(m=>messages.view(m)),nextCursor:null})],
  ['POST',/^messages$/,(m,b)=>{
   const key=typeof b.clientRequestId==='string'&&b.clientRequestId.length>=8&&b.clientRequestId.length<=100?b.clientRequestId:null;
   return [201,{message:messages.view(messages.create(messageFields(b),now(),{clientRequestId:key}))}];
  }],
  ['GET',/^messages\/([^/]+)$/,([id])=>{const msg=messages.get(id);if(!msg)throw notFound();return {message:messages.view(msg)};}],
  ['PATCH',/^messages\/([^/]+)$/,([id],b)=>{
   const msg=messages.get(id);if(!msg)throw notFound();requireRevision(msg,b);
   if(msg.status!=='draft')throw conflict('已提交的消息不能修改');
   const {revision,id:_i,status,createdAt,channel,clientRequestId,...fields}=b;
   if(channel!==undefined&&channel!=='notification')throw new ApiError(422,'UNSUPPORTED_CHANNEL','公告请在“应用公告”中发布');
   return {message:messages.view(messages.update(msg,messageFields(fields,{partial:true}),now()))};
  }],
  ['POST',/^messages\/([^/]+)\/submit$/,([id],b)=>{
   const msg=messages.get(id);if(!msg)throw notFound();
   const r=idempotent(b,`msg:${id}`,()=>{
    requireRevision(msg,b);
    if(msg.status!=='draft')throw conflict('消息已提交');
    if(msg.platform==='ios')apnsReady();
    const t=now();
    if(msg.expires_at&&msg.expires_at<=t)throw new ApiError(422,'INVALID','消息已过有效期');
    if(msg.schedule_at&&msg.schedule_at>t){messages.setStatus(id,'scheduled',t);q('UPDATE messages SET submitted_at=? WHERE id=?').run(t,id);}
    else{if(!messages.recipients(msg).length)throw new ApiError(422,'NO_RECIPIENTS',msg.platform==='android'?'没有登记收件能力的已启用 Android 设备，请先打开新版 App':'没有可接收普通通知的设备');messages.start(msg,t);}
    return {status:202,body:{message:messages.view(messages.get(id))}};
   });
   return [r.status,r.body];
  }],
  ['POST',/^messages\/([^/]+)\/retry$/,([id],b)=>{
   const msg=messages.get(id);if(!msg)throw notFound();
   const r=idempotent(b,`retry:${id}`,()=>{
    requireRevision(msg,b);
    if(!['failed','partial'].includes(msg.status))throw conflict('当前状态不能重试');
    if(msg.platform==='ios')apnsReady();
    if(!messages.retry(msg,now()))throw conflict('没有可重试的对象');
    return {status:202,body:{message:messages.view(messages.get(id))}};
   });
   return [r.status,r.body];
  }],

  ['GET',/^apns$/,(m,b,url)=>{
   const envs=[...new Set(q('SELECT DISTINCT apns_env FROM devices').all().map(r=>r.apns_env))];
   const records=[...eventRecords('',[],100),...deliveryRecords(100)].sort((x,y)=>(y.at||'')<(x.at||'')?-1:1).slice(0,150);
   const last=q("SELECT MAX(sent_at) AS a FROM events WHERE sent_at IS NOT NULL").get().a,lastOk=q("SELECT MAX(sent_at) AS a FROM events WHERE status='sent'").get().a;
   return {configured:apns.configured,status:apns.configured?'ready':'not_configured',environment:envs.length?envs.join(' / '):'sandbox / production',bundleId:(process.env.AMS_BUNDLE_IDS||'cn.xjtlu.ams.ios').split(',')[0],
    keyId:maskId(apns.keyId),teamId:maskId(apns.teamId),capabilities:{liveactivity:apns.configured,notification:apns.configured},
    records,nextCursor:null,asOf:iso(now()),lastAttemptAt:iso(last),lastAcceptedAt:iso(lastOk)};
  }],

  ['GET',/^ios-config$/,()=>registry.iosPublicConfig(now())],
  ...['PUT','POST'].map(method=>[method,/^ios-config$/,(m,b)=>{
   if(b.release!==null&&(typeof b.release!=='object'||Array.isArray(b.release)))throw new ApiError(422,'INVALID','请检查版本信息');
   let release=null;
   if(b.release){
    try{release=validateIosRelease({version:b.release.version,build:b.release.build,url:b.release.url,notes:b.release.notes??''});}
    catch{throw new ApiError(422,'INVALID','请检查版本、构建号与 App Store / TestFlight 链接');}
   }
   registry.setKv('ios_release',release);
   return {ok:true,...registry.iosPublicConfig(now())};
  }])
 ];

 return {
  messages,
  // Returns [status, body]. Throws ApiError for client errors.
  handle(method,path,body,url){
   let pathMatched=false;
   for(const [m,re,fn] of routes){
    const match=re.exec(path);if(!match)continue;pathMatched=true;
    if(m!==method)continue;
    const out=fn(match.slice(1).map(decodeURIComponent),body||{},url);
    return Array.isArray(out)?out:[200,out];
   }
   throw pathMatched?new ApiError(405,'METHOD_NOT_ALLOWED','不支持的操作'):notFound();
  }
 };
}
