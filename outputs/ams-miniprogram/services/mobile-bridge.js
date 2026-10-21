const amsLogin=require('./ams-login'),portalSso=require('./portal-sso'),diag=require('./diagnostics');const tests=[{id:'A14'},{id:'A04'}];module.exports={
 async amsRequest(url,method,data){
  if(!amsLogin.allowed(url))throw Error('ADDRESS');
  const header={'Content-Type':'application/json; charset=utf-8'},cookie=amsLogin.jarHeader(this.amsJar,url);if(cookie)header.Cookie=cookie;
  const r=await new Promise((resolve,reject)=>{try{this.task=this.request({url,method:method||'GET',data,header,redirect:'manual',timeout:15000,success:resolve,fail:reject});if(this.task&&this.task.onHeadersReceived)this.task.onHeadersReceived(h=>{const location=h.header&&(h.header.Location||h.header.location);if(typeof location==='string'&&(!h.statusCode||(h.statusCode>=300&&h.statusCode<400)))resolve({statusCode:h.statusCode||302,header:h.header,cookies:h.cookies||[],data:''})})}catch(e){reject(e)}});this.task=null;amsLogin.saveCookies(this.amsJar,url,r);return r;
 },
 async portalAmsFlow(){
  if(this.data.busy)return;const t=tests.find(x=>x.id==='A14');
  if(!this.credentials.portal||!this.credentials.portalSso||!this.credentials.portalUserId){this.record(t,{label:'缺少前置条件',stage:'移动认证票据检查',hint:'先在本版完成西浦码OTP登录；手动Authorization不能补齐移动认证票据。'});return}
  this.setData({busy:true,group:'AMS'});let stage='学校应用列表';
  try{
   if(!(await this.confirm(t)))return;
   const request=async(url,method)=>{const r=await new Promise((resolve,reject)=>{this.task=this.request({url,method:method||'GET',header:{Authorization:this.credentials.portal,'Content-Type':'application/json;charset=utf-8'},timeout:15000,success:resolve,fail:reject})});this.task=null;return r};
   let target=null;const summaries=[];
   const lists=[{name:'本人应用',path:'/api/appConnection/getPhoUserAppTargets/'+encodeURIComponent(this.credentials.portalUserId)+'?languageType=CN'},{name:'应用中心',path:'/api/appConnection/getAppConnections/'+encodeURIComponent(this.credentials.portalUserId)+'?languageType=CN'},{name:'校园微服务',path:'/api/microserviceConnection/categoryMicroservice?languageType=CN',micro:true}];
   for(const list of lists){const r=await request(portalSso.PORTAL+list.path),b=diag.parse(r.data);if(r.statusCode!==200||!b||b.success!==true){this.record(t,{label:'应用列表未通过',http:r.statusCode,stage,hint:list.name+'未返回可用列表；没有申请授权码。',authProvided:true});return}const entries=list.micro?portalSso.microservices(b.data):b.data;summaries.push(list.name+'：'+portalSso.summary(entries));target=portalSso.amsTarget(entries);if(target)break}
   if(!target){this.record(t,{label:'AMS入口待确认',stage,hint:summaries.join('；')+'。没有唯一可确认的AMS入口，未申请授权码。',authProvided:true});return}
   stage='移动票据换授权码';const r=await request(portalSso.PORTAL+'/api/authentication/changeCode?accessToken='+encodeURIComponent(this.credentials.portalSso),'POST'),b=diag.parse(r.data);
   if(r.statusCode!==200||!b||b.success!==true||!b.data||typeof b.data.code!=='string'||!b.data.code){this.record(t,{label:'移动换码未通过',http:r.statusCode,stage,hint:'学校没有确认返回一次性授权码；不自动重试。'});return}
   stage='移动认证接续AMS';this.amsJar={};delete this.credentials.ams;let url=portalSso.appLogin(target,b.data.code),code='';
   const hops=[];let lastHttp=null,startedAms=false;
   for(let i=0;i<12&&typeof url==='string'&&url;i++){if(!amsLogin.allowed(url))break;code=amsLogin.mobileCode(url);if(code)break;const response=await this.amsRequest(url),body=diag.parse(response.data),h=response.header||{};lastHttp=response.statusCode;const location=h.Location||h.location||(body&&body.data&&body.data.redirect);hops.push((url.startsWith(amsLogin.ROOT)?'认证中心':'AMS')+' HTTP'+response.statusCode+' / '+(typeof response.data==='string'?(/<html|<!doctype/i.test(response.data)?'HTML':'文本'):'JSON')+' / 跳转地址'+(typeof location==='string'?'有':'无'));if(!location&&!startedAms&&/^https:\/\/ams\.xjtlu\.edu\.cn(?=\/|$)/.test(url)&&response.statusCode===200&&typeof response.data==='string'&&/<html|<!doctype/i.test(response.data)){startedAms=true;stage='启动AMS自身授权';const entry=await this.amsRequest('https://ams.xjtlu.edu.cn/xjtlu/sso/mobile/iam/login'),entryBody=diag.parse(entry.data);hops.push('AMS授权入口 HTTP'+entry.statusCode);if(entry.statusCode!==200||!entryBody||String(entryBody.code)!=='0'||typeof entryBody.data!=='string'||!entryBody.data.startsWith(amsLogin.ROOT+'/')||!amsLogin.allowed(entryBody.data))break;url=entryBody.data;stage='AMS自身授权回调'}else url=amsLogin.nextUrl(url,location)}
   if(!code){this.record(t,{label:'移动回调待适配',http:lastHttp,stage,authProvided:true,hint:hops.join('；')+'。AMS自身授权已启动：'+(startedAms?'是':'否')+'；未取得可交换登录码；不自动重试。'});return}
   stage='交换AMS令牌';const exchange=await this.amsRequest('https://ams.xjtlu.edu.cn/xjtlu/sso/mobile/login','GET',{code}),body=diag.parse(exchange.data);
   if(exchange.statusCode!==200||!body||String(body.code)!=='0'||!body.data||typeof body.data.token!=='string'||!body.data.token){this.record(t,{label:'令牌交换未通过',http:exchange.statusCode,stage,hint:'未取得AMS令牌。'});return}
   this.credentials.ams=body.data.token;for(const key of ['academicYear','semester']){const value=body.data[key];if(typeof value==='string'||typeof value==='number')this.setData({['fields.'+key]:String(value)})}this.setData({secretStatus:'移动认证取得AMS令牌，仅当前页面有效'});this.record(t,{label:'登录通过',http:exchange.statusCode,businessCode:0,stage,hint:'移动认证已取得AMS令牌，随后读取课表验证。'});await this.execute(tests.find(x=>x.id==='A04'));
  }catch(e){this.amsFailure(t,stage,e)}finally{this.task=null;this.setData({busy:false});this.sync()}
 },
};
