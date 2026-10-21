function parse(data){if(typeof data!=='string')return data;try{return JSON.parse(data)}catch(e){return null}}
function shape(value){if(value===null)return 'null';if(Array.isArray(value))return '数组('+value.length+')';if(typeof value==='object')return '对象';return typeof value==='string'?'文本('+value.length+')':typeof value}
const safeKeys=['code','status','success','data','message','msg','vos','leaveList','moduleList','comprehensiveAttendance','thresholdFlag','attendance','exceed','token','captchaKey','imageBase','otp','opt','sms','email','err','error','redirect'];
function structure(data){if(!data||typeof data!=='object')return shape(data);return Object.keys(data).filter(k=>safeKeys.indexOf(k)>=0).map(k=>k+':'+shape(data[k])).join(' / ')||'对象（字段名已省略）'}
function failure(err){const msg=String(err&&err.errMsg||'').toLowerCase();if(/header|invalid.*token|illegal.*token/.test(msg))return ['请求头被拒绝','请求头参数未被微信接受；检查令牌是否含换行或非法字符，不要发送令牌内容。'];if(/invalid.*data|invalid.*parameter|parameter.*error/.test(msg))return ['参数被拒绝','请求参数未被微信接受。'];if(/domain|url not in/.test(msg))return ['域名阻断','检查服务器合法域名；域名限制未通过。'];if(/ssl|tls|certificate/.test(msg))return ['证书阻断','HTTPS/TLS 校验未通过。'];if(/timeout|timed out/.test(msg))return ['请求超时','学校服务未在15秒内返回；有副作用的请求不要立即重试。'];return ['网络失败','未获得HTTP响应；检查网络、域名、证书。原错误文本不导出，避免带出请求参数。']}
function classify(test,response){
 const http=response.statusCode,d=parse(response.data),headers=response.header||{};
 const ct=String(headers['content-type']||headers['Content-Type']||'').split(';')[0];
 const result={http,format:d?'JSON':typeof response.data==='string'&&/<(?:!doctype|html|form)/i.test(response.data)?'HTML':shape(response.data),structure:structure(d),businessCode:d&&typeof d.code==='number'?d.code:d&&typeof d.status==='number'?d.status:null};
 let label='待判定',hint='已收到响应，仍需确认接口含义。';
 if(http===401||http===403||(d&&(Number(d.code)===401||Number(d.status)===401||Number(d.code)===403||Number(d.status)===403))){label='需要登录 / 被拒绝';hint='网络已通；检查学校令牌是否有效及权限。'}
 else if(http>=300&&http<400){label='登录跳转';hint='收到重定向；小程序尚未完成学校登录。'}
 else if(http<200||http>=300){label='HTTP失败';hint='学校返回非成功HTTP状态。'}
 else if(test.kind==='page'){label='入口可达';hint='只确认收到网页响应，不代表业务接口或网页登录可用。'}
 else if(test.kind==='authPage'){label='认证页面可达';hint='已到学校认证入口；仍需要适配网页脚本、登录会话及回调，不等于已经登录。'}
 else if(test.kind==='sso'){label='登录待适配';hint='收到登录入口响应，不能视为学校登录成功。'}
 else if(!d||typeof d!=='object'){label='格式不符';hint='预期JSON，可能跳到了登录网页或访问提示。'}
 else if((test.kind==='ams'&&d.code!==0)||(test.kind!=='ams'&&d.success===false)){label='学校未接受';hint='网络已通，业务返回未成功；可能是认证、参数或权限问题。'}
 else if(test.kind==='ams'&&d.code===0){label='业务通过';hint='学校返回code=0；空结果仍可能需要补齐日期或课程参数。'}
 else if(test.kind==='captcha'&&d.success===true&&d.data&&d.data.captchaKey&&d.data.imageBase){label='业务通过';hint='已取得验证码图片及临时标识。'}
 else if(test.kind==='login'&&d.success===true&&d.data&&typeof d.data.token==='string'&&d.data.token){label='业务通过';hint='取得学校令牌，仅保留在当前页面内存。'}
 else if(test.kind==='qrcode'&&d.success===true&&typeof d.data==='string'&&d.data.length>=16&&d.data.length<=4096&&!/placeholder|mock|undefined|^null$/i.test(d.data)){label='载荷通过';hint='取得符合当前App基本检查的动态码载荷；未验证实际通行。'}
 else if(test.kind==='timing'&&Number(d.data)>=10&&Number(d.data)<=3600){label='业务通过';hint='取得合理的刷新周期。'}
 else if(test.kind==='portal'&&d.success===true){label='业务通过';hint='学校返回success=true。'}
 return Object.assign(result,{label,hint,contentType:/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(ct)?ct:'未提供'});
}
function redact(text,secrets){let s=String(text||'');(secrets||[]).filter(Boolean).sort((a,b)=>b.length-a.length).forEach(v=>{s=s.split(String(v)).join('[已隐藏]')});return s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已隐藏]').replace(/\b1[3-9]\d{9}\b/g,'[手机号已隐藏]')}
function origin(text){const m=String(text).match(/https?:\/\/([a-z0-9.-]+\.xjtlu\.edu\.cn(?::\d+)?)(?=[/\s?]|$)/i);return m?'https://'+m[1]:''}
function authSummary(response){
 const d=parse(response.data),summary=classify({kind:'custom'},response),error=d&&(d.err||d.error);
 const value=d&&d.code!=null?d.code:error&&error.code;
 summary.businessCode=typeof value==='number'&&Number.isInteger(value)&&Math.abs(value)<=99999?value:typeof value==='string'&&/^(?:SSO\d{5}|-?\d{1,5})$/.test(value)?value:null;
 if(error&&typeof error==='object')summary.structure+=' / err:{'+structure(error)+'}';
 const text=d&&String(d.msg||d.message||error&&error.msg||error&&error.message||'');
 summary.authHint=!d?'学校返回的不是可识别JSON；可能是网页或访问校验。':/captcha|slider|图形|滑块|图像/i.test(text)?'学校提示需要图形或滑块验证。':/otp|动态|验证码|verification code/i.test(text)?'学校提示涉及验证码；具体原因需结合业务码确认。':/cookie|session|会话/i.test(text)?'学校提示涉及登录会话。':/account|username|用户|账号|账户/i.test(text)?'学校提示涉及账号或认证条件。':'学校尚未确认登录；本次报告包含安全业务码和响应结构，请反馈。';
 return summary;
}
module.exports={authSummary,origin,parse,structure,failure,classify,redact};
