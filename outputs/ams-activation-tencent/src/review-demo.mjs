import seed from './review-seed.mjs';
const enc=new TextEncoder(),rsa={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'};
const date=(offset=0)=>new Date(Date.now()+offset*86400000+8*3600000).toISOString().slice(0,10);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
async function input(request){const text=await request.text();if(text.length>1500000)fail('附件或请求过大',413);try{return JSON.parse(text);}catch{fail('请求格式不正确');}}
async function cookieToken(env,data,helpers){const p=helpers.b64(enc.encode(JSON.stringify(data))),key=await crypto.subtle.importKey('raw',enc.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return p+'.'+helpers.b64(await crypto.subtle.sign('HMAC',key,enc.encode(p)));}
async function validCode(env,grant){if(grant?.mode!=='demo')return false;const row=await env.DB.prepare('SELECT a.enabled,a.bound_devices FROM activation_codes a JOIN demo_codes d ON a.id=d.code_id WHERE a.id=?').bind(grant.grant).first();return Number(row?.enabled)===1&&row.bound_devices.includes('|'+grant.device+'|');}
const initial=()=>({anchor:date(),attendance:[],leaves:[],bookings:[],receipts:[]});
function courses(){return seed.courses.map(c=>({...c,moduleCode:'SOE106TC',moduleTitle:'Programming with C++',room:'DE-2001',location:'演示教室',date:new Date(Date.parse(date()+'T00:00:00Z')+c.dayOffset*86400000).toISOString().slice(0,10)}));}
function mutate(state,data){
 const available=courses(),now=new Date().toISOString(),id=crypto.randomUUID();
 if(data.action==='sign'){
  const c=available.find(c=>c.id===data.courseId);if(!c||!/^\d{6}$/.test(data.code||''))fail('请选择课程并输入六位演示签到码');
  if(!state.attendance.some(r=>r.courseId===c.id))state.attendance.push({id,courseId:c.id,date:c.date,moduleTypeGroup:c.moduleTypeGroup,status:1,signTime:now.slice(11,19),signWay:2});
 }else if(data.action==='leave'){
  const f=data.form;if(!f||!seed.leaveTypes.includes(f.leaveType)||typeof f.leaveReason!=='string'||!f.leaveReason.trim()||f.leaveReason.length>500)fail('请填写有效的请假类型和原因');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(f.startDate||'')||!/^\d{4}-\d{2}-\d{2}$/.test(f.endDate||'')||f.startDate>f.endDate)fail('请检查请假日期');
  if(!Array.isArray(data.selected))fail('请选择日期范围内的课程');const ids=[...new Set(data.selected)];if(!ids.length||ids.some(id=>!available.some(c=>c.id===id&&c.date>=f.startDate&&c.date<=f.endDate)))fail('请选择日期范围内的课程');
  if(!Array.isArray(f.fileList)||!f.fileList.length||f.fileList.length>3||f.fileList.some(f=>typeof f.originalFileName!=='string'||f.originalFileName.length>120||!/^data:(image\/(jpeg|png)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(f.content||'')))fail('请上传 JPG、PNG 或 PDF 证明附件');
  state.leaves.unshift({id,leaveOdd:'DEMO-'+id.slice(0,8),startDate:f.startDate,endDate:f.endDate,leaveType:f.leaveType,leaveReason:f.leaveReason.trim(),fileList:f.fileList,courseIds:ids,status:1,createTime:now.slice(0,10),timeline:[{time:now,text:'演示服务器已接收，等待处理'}]});
 }else if(data.action==='cancelLeave'){
  const row=state.leaves.find(r=>r.id===data.id);if(!row||row.cancelled)fail('申请不存在或已撤回',409);row.cancelled=true;row.timeline.push({time:now,text:'演示申请已撤回'});
 }else if(data.action==='book'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date||'')||data.date<date()||data.date>date(7))fail('请选择未来七天内的日期');
  const resource=seed.resources.find(r=>r.id===data.resourceId);
  if(data.kind==='bus'){
   if(!seed.busTimes.includes(data.start)||!['TC-SIP','SIP-TC'].includes(data.direction))fail('班次不正确');
  }else{
   if(!resource||resource.kind!==data.kind)fail('预约资源不存在');
   const minutes=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
   const a=minutes(data.start),b=minutes(data.end),people=Number(data.people);
   if(!Number.isFinite(a)||!Number.isFinite(b)||a<540||b>1320||b-a<resource.minMinutes||!Number.isInteger(people)||people<resource.minPeople||people>resource.maxPeople)fail('请检查开放时间、最短预约时长和人数');
  }
  if(state.bookings.some(r=>!r.cancelled&&r.kind===data.kind&&r.date===data.date&&(data.kind==='bus'?r.start===data.start&&r.direction===data.direction:r.resourceId===data.resourceId&&r.start<data.end&&r.end>data.start)))fail('已存在相同或冲突的预约',409);
  state.bookings.unshift({id,kind:data.kind,resourceId:resource?.id||null,name:resource?.name||'区间车',date:data.date,start:data.start,end:data.kind==='bus'?null:data.end,people:data.kind==='bus'?1:Number(data.people),direction:data.kind==='bus'?data.direction:null,created:now,cancelled:false,ticket:'AMS-DEMO-NOT-VALID:'+id});
 }else if(data.action==='sportsBook'){
  const venues={badminton:'羽毛球馆',basketball:'篮球馆',fitness:'健身房'},minutes=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
  const a=minutes(data.start),b=minutes(data.end),delta=(Date.parse(data.date+'T00:00:00Z')-Date.parse(date()+'T00:00:00Z'))/86400000;
  if(!venues[data.venue]||!/^\d{4}-\d{2}-\d{2}$/.test(data.date||'')||!Number.isInteger(delta)||delta<0||delta>30||!Number.isFinite(a)||!Number.isFinite(b)||a<540||b>1320||b-a<60)fail('请检查演示场馆、日期和预约时间');
  state.sports??=[];if(state.sports.length>=50)fail('演示订单已达上限');
  state.sports.unshift({id,name:venues[data.venue],venue:data.venue,date:data.date,start:data.start,end:data.end,paid:false,cancelled:false,ticket:'AMS-DEMO-NOT-VALID:sports:'+id});
 }else if(data.action==='sportsPay'||data.action==='sportsCancel'){
  const row=state.sports?.find(r=>r.id===data.id);if(!row||row.cancelled)fail('演示订单不存在或已取消',409);
  if(data.action==='sportsPay')row.paid=true;else row.cancelled=true;
 }else if(data.action==='cancelBooking'){
  const row=state.bookings.find(r=>r.id===data.id);if(!row||row.cancelled)fail('预约不存在或已取消',409);row.cancelled=true;
 }else fail('操作不支持');
 if(state.leaves.length>30||state.bookings.length>100||JSON.stringify(state).length>3000000)fail('演示记录已达上限，请联系开发者');
}
export async function demoRequest(request,env,h){
 const url=new URL(request.url),path=url.pathname,now=Math.floor(Date.now()/1000);
 try{
  if(path==='/api/demo/bootstrap'&&request.method==='POST'){
   const data=await input(request);let grant;
   if(typeof data.publicKey!=='string'||data.publicKey.length>500||typeof data.proof!=='string'||data.proof.length>400)fail('设备验证失败',401);
   try{grant=await h.checkedGrant(env,data.grant);const bytes=h.unb64(data.publicKey),key=await crypto.subtle.importKey('spki',bytes,rsa,false,['verify']);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
    if(key.algorithm.modulusLength!==2048||grant?.device!==digest||! /^\d{10}$/.test(data.timestamp)||Math.abs(now-Number(data.timestamp))>60||! /^[A-Za-z0-9_-]{32}$/.test(data.nonce)||!await crypto.subtle.verify(rsa,key,h.unb64(data.proof),enc.encode('AMS-DEMO-1\n'+data.grant+'\n'+data.timestamp+'\n'+data.nonce)))fail('设备验证失败',401);
   }catch{fail('设备验证失败',401);}
   if(!await validCode(env,grant))fail('演示激活已停用或未授权',403);
   await env.DB.prepare('DELETE FROM demo_nonces WHERE expires < ?').bind(now).run();
   const inserted=await env.DB.prepare('INSERT INTO demo_nonces(id,expires) VALUES (?,?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(grant.device+':'+data.nonce,now+120).first();if(!inserted)fail('验证已使用，请重试',409);
   const id=await h.hash(grant.grant+':'+grant.device);
   await env.DB.prepare('INSERT INTO demo_states(id,state) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind(id,JSON.stringify(initial())).run();
   const token=await cookieToken(env,{id,grant:grant.grant,device:grant.device,mode:'demo',exp:now+21600},h);
   const headers={'Set-Cookie':'ams_demo='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/api/demo; Max-Age=21600'};
   if(request.headers.get('accept')==='application/json')return h.json({ok:true},200,headers);
   return new Response('',{status:303,headers:{Location:'/api/demo/app',...headers,'Cache-Control':'no-store'}});
  }
  let auth;try{
   const token=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('ams_demo='))?.slice(9);const [p,s]=token.split('.'),key=await crypto.subtle.importKey('raw',enc.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
   if(!await crypto.subtle.verify('HMAC',key,h.unb64(s),enc.encode(p)))fail('请重新激活演示',401);auth=JSON.parse(new TextDecoder().decode(h.unb64(p)));if(auth.exp<=now||!await validCode(env,auth))fail('演示会话已失效',401);
  }catch{fail('请重新激活演示',401);}
  if(path==='/api/demo/reminder'&&request.method==='POST'){
   if(request.headers.get('origin')!==url.origin||request.headers.get('X-AMS-Demo')!=='1')fail('来源不正确',403);
   if(!env.REVIEW_REMINDER)fail('审核提醒服务尚未上线',503);
   return h.json(await env.REVIEW_REMINDER(auth,await input(request)));
  }
  if(path==='/api/demo/state'&&request.method==='GET'){const row=await env.DB.prepare('SELECT revision,state FROM demo_states WHERE id=?').bind(auth.id).first(),state={...JSON.parse(row.state),anchor:date()};return h.json({seed,courses:courses(),revision:row.revision,state,today:date()});}
  if(path==='/api/demo/action'&&request.method==='POST'){
   if(request.headers.get('origin')!==url.origin||request.headers.get('X-AMS-Demo')!=='1')fail('来源不正确',403);
   const data=await input(request);if(!/^[a-zA-Z0-9_-]{8,80}$/.test(data.requestId||''))fail('操作编号不正确');
   for(let attempt=0;attempt<3;attempt++){
    const row=await env.DB.prepare('SELECT revision,state FROM demo_states WHERE id=?').bind(auth.id).first(),state=JSON.parse(row.state);
    const receipt=state.receipts.find(r=>r.id===data.requestId);const digest=await h.hash(JSON.stringify({...data,requestId:undefined}));if(receipt){if(receipt.digest!==digest)fail('操作编号重复',409);return h.json({ok:true,revision:row.revision});}
    mutate(state,data);state.receipts.push({id:data.requestId,digest});state.receipts=state.receipts.slice(-200);
    const changed=await env.DB.prepare('UPDATE demo_states SET state=?,revision=revision+1 WHERE id=? AND revision=? RETURNING revision').bind(JSON.stringify(state),auth.id,row.revision).first();if(changed)return h.json({ok:true,revision:changed.revision});
   }fail('记录刚刚发生变化，请重试',409);
  }
  if(request.method==='GET'&&(path==='/api/demo/app'||path.startsWith('/api/demo/assets/'))){
   const asset=await env.ASSETS.fetch(new Request(new URL(path==='/api/demo/app'?'/api/demo/assets/index.html':path,url)));
   const headers=new Headers(asset.headers);headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; object-src 'none'");headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');return new Response(asset.body,{status:asset.status,headers});
  }
  return h.json({message:'接口不存在'},404);
 }catch(error){if(error.status)return h.json({message:error.message},error.status);throw error;}
}
