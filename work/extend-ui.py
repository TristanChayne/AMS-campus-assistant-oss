from pathlib import Path
p=Path('work/build-live-ui.py')
s=p.read_text(encoding='utf-8-sig')
s=s.replace(".replace('<span class=\"preview-tag\">界面预览</span>', '<button class=\"preview-tag\" id=\"original\">原版</button>')", ".replace('<span class=\"preview-tag\">界面预览</span>', '')")
s=s.replace("script = r'''", "body=body.replace('<div class=\"date-head\">','<div id=\"homeScreen\"><div class=\"date-head\">').replace('<nav aria-label=', '</div><section id=\"otherScreen\" hidden></section><nav aria-label=')\nscript = r'''",1)
s=s.replace('let days=[], selected=0, ready=false;', "let days=[], selected=0, ready=false,page={route:'/home'},draft='',busy=false;")
s=s.replace("const send=action=>parent.postMessage({amsUiAction:action},'*');", "const send=(action,extra={})=>parent.postMessage(Object.assign({amsUiAction:action},extra),'*');")
s=s.replace('function render(){const now=', 'function renderHome(){const now=',1)
a=s.index("window.addEventListener('message',e=>")
b=s.index("'''\nhtml =",a)
s=s[:a]+r'''
function render(){
 const route=page.route||'/home',home=route==='/home';
 document.getElementById('homeScreen').hidden=!home;
 document.getElementById('otherScreen').hidden=home;
 document.querySelector('h1').textContent=home?'今日课表':route==='/course'?'签到记录':route==='/leave'?'请假':route==='/signCode'?'Code 签到':'签到结果';
 document.querySelectorAll('nav button').forEach((b,i)=>b.classList.toggle('active',i===(route==='/course'?1:route==='/leave'?2:0)));
 if(home){renderHome();return;}
 const list=page.list||[],screen=document.getElementById('otherScreen');
 const back='<button class="return" id="backHome">‹ 返回课表</button>';
 if(route==='/signCode')screen.innerHTML=back+`<div class="hero"><h2>输入课堂签到码</h2><p>提交后由学校验证，以返回结果为准。</p></div><form id="codeForm"><label for="codeValue">签到码</label><input id="codeValue" autocomplete="off" maxlength="20" required value="${escape(draft)}" placeholder="输入老师提供的 code" style="margin:12px 0"><button class="close" ${busy?'disabled':''}>${busy?'正在提交…':'提交签到'}</button></form>`;
 else if(route==='/course')screen.innerHTML=(page.loading?'<p>正在读取学校记录…</p>':'')+list.map((c,i)=>`<button class="card" data-record="${i}" style="margin-bottom:12px"><div class="card-top">${escape(c.moduleCode)}</div><h3>${escape(c.moudleTitle||c.moduleTitle)}</h3><div class="room">${escape(c.courseAttendance==null?'—':c.courseAttendance+'%')} <small>出勤率</small></div><p>总课时 ${escape(c.classHour)} · 已出勤 ${escape(c.signClassHour)}<br>缺勤 ${escape(c.absences)} · 请假 ${escape(c.leaveClassHour)}</p></button>`).join('')+(!page.loading&&!list.length?'<p>学校暂未返回记录，请稍后查看。</p>':'');
 else if(route==='/leave')screen.innerHTML='<button class="action" id="applyLeave" style="width:100%;margin-bottom:20px">＋ 新建请假申请</button>'+(page.loading?'<p>正在读取请假记录…</p>':'')+list.map((c,i)=>`<button class="card" data-leave="${i}" style="margin-bottom:12px"><div class="card-top"><span>${escape(c.leaveOdd)}</span><span>${Number(c.status)===2?'已完成':'待处理'}</span></div><h3>${escape(c.startDate)} 至 ${escape(c.endDate)}</h3><p>创建于 ${escape(c.createTime)}</p></button>`).join('')+(!page.loading&&!list.length?'<p>学校暂无请假记录。</p>':'');
 else if(route==='/signCodeSuccess')screen.innerHTML=back+`<div class="hero"><div class="hero-top">学校已返回签到成功</div><h2>签到成功</h2><p>${escape(page.signInfo&&page.signInfo.signTime||'')}</p></div>`;
 else if(route==='/signCodeFail')screen.innerHTML=back+`<div class="card"><h3>签到未成功</h3><p>${escape(page.reason||'请检查学校返回的信息')}</p><button class="close" id="retryCode">重新输入 code</button></div>`;
 else screen.innerHTML=back+'<p>正在加载…</p>';
 const backButton=document.getElementById('backHome');if(backButton)backButton.onclick=()=>send('home');
 const form=document.getElementById('codeForm');if(form){document.getElementById('codeValue').oninput=e=>draft=e.target.value;form.onsubmit=e=>{e.preventDefault();if(busy||!draft.trim())return;busy=true;send('submitCode',{code:draft.trim()});render();};}
 document.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>send('recordDetail',{index:Number(b.dataset.record)}));
 document.querySelectorAll('[data-leave]').forEach(b=>b.onclick=()=>send('leaveDetail',{index:Number(b.dataset.leave)}));
 const apply=document.getElementById('applyLeave');if(apply)apply.onclick=()=>send('applyLeave');
 const retry=document.getElementById('retryCode');if(retry)retry.onclick=()=>send('code');
}
window.addEventListener('message',e=>{if(e.source!==parent||!e.data||!e.data.amsUiData)return;const data=e.data.amsUiData;
 if(page.route!==data.route)busy=false;page=data;if(data.days){days=data.days;ready=data.ready;}
 document.getElementById('leaveBtn').hidden=!data.leave;render();});
document.getElementById('scanBtn').onclick=()=>{
 const bridge=window.AmsCamera;if(bridge&&typeof bridge.open==='function')bridge.open();else send('scan');
};
document.getElementById('codeBtn').onclick=()=>send('code');document.getElementById('records').onclick=()=>send('records');document.getElementById('leaveBtn').onclick=()=>send('leave');
document.querySelector('nav button').onclick=()=>send('home');document.getElementById('today').onclick=()=>{selected=0;render();};document.getElementById('close').onclick=()=>document.getElementById('sheet').close();setInterval(()=>{if(page.route==='/home'&&!document.getElementById('sheet').open)render();},60000);render();send('ready');
''' +s[b:]
a=s.index(' let frame=null,home=null,disabled=false')
b=s.index(" setInterval(refresh,500);refresh();",a)+len(" setInterval(refresh,500);refresh();")
s=s[:a]+r'''
 let frame=null,last='',router=null,leaveEnabled=false,cachedDays=[],header=null;
 const owned=new Set(['/home','/course','/leave','/signCode','/signCodeSuccess','/signCodeFail']);
 const skin=document.createElement('style');skin.textContent='html.ams-owned body>*:not(#ams-managed-ui):not(style):not(script){visibility:hidden!important}html.ams-skin body{background:#f5f6f8!important;color:#18233a!important;font-family:system-ui!important}html.ams-skin main{background:#f5f6f8!important;padding:18px!important;padding-top:60px!important}html.ams-skin .van-cell,html.ams-skin .item-box{border-radius:12px!important;margin-bottom:8px!important}html.ams-skin .van-button--info,html.ams-skin .van-button--primary{background:#172e61!important;border-color:#172e61!important;border-radius:12px!important}html.ams-skin .van-field__control{font-size:16px!important}html.ams-skin .tabBar{display:none!important}#ams-secondary-head{position:fixed;top:0;left:0;right:0;z-index:2000;background:#f5f6f8;padding:14px;color:#172e61;border:0;text-align:left;font-size:16px}';document.head.appendChild(skin);
 function components(){const seen=new Set(),queue=[],all=[];for(const el of document.querySelectorAll('*'))if(el.__vue__)queue.push(el.__vue__);while(queue.length){const vm=queue.pop();if(!vm||seen.has(vm))continue;seen.add(vm);all.push(vm);if(vm.$parent)queue.push(vm.$parent);if(vm.$children)queue.push(...vm.$children);}return all;}
 function refresh(){const all=components();const root=all.find(v=>v.$router&&v.$route);if(!root)return;const route=root.$route.path;
  if(root.$router!==router){router=root.$router;if(typeof router.afterEach==='function')router.afterEach(()=>{refresh();requestAnimationFrame(refresh);});}
  const active=all.find(v=>v.$options&&v.$options.name===({'/home':'home','/course':'course','/leave':'leave','/signCode':'signCode','/signCodeSuccess':'signCodeSuccess','/signCodeFail':'signCodeFail'}[route]));
  if(!owned.has(route)){document.documentElement.classList.remove('ams-owned');if(frame)frame.style.display='none';last='';if(route.startsWith('/leave')||route.startsWith('/course')){document.documentElement.classList.add('ams-skin');if(!header){header=document.createElement('button');header.id='ams-secondary-head';header.textContent='‹ 返回';header.onclick=()=>router.back();document.body.appendChild(header);}}else{document.documentElement.classList.remove('ams-skin');if(header){header.remove();header=null;}}return;}
  document.documentElement.classList.add('ams-owned');document.documentElement.classList.remove('ams-skin');if(header){header.remove();header=null;}
  if(!frame){frame=document.createElement('iframe');frame.id='ams-managed-ui';frame.title='AMS 校园助手';frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:3000;background:#f5f6f8';frame.srcdoc=HTML;document.body.appendChild(frame);}frame.style.display='block';
  const tab=all.find(v=>Array.isArray(v.tabDatas));if(tab)leaveEnabled=tab.tabDatas.some(t=>t.path==='/leave');const schedule=all.find(v=>Array.isArray(v.scheduleList)&&typeof v.getStudentTimetable==='function');if(route==='/home'&&schedule)cachedDays=schedule.scheduleList.slice(0,3);
  const data={route,days:cachedDays,ready:cachedDays.length>0,leave:leaveEnabled,list:route==='/course'?(active&&active.list||[]):route==='/leave'?(active&&active.leaveDatas&&active.leaveDatas.leaveList||[]):[],loading:!active||(route==='/course'&&!!active.loading)||(route==='/leave'&&!active.leaveDatas),reason:active&&active.reason,signInfo:route==='/signCodeSuccess'&&active?active.signInfo:null};const json=JSON.stringify(data);if(json!==last){frame.contentWindow.postMessage({amsUiData:data},'*');last=json;}
 }
 window.addEventListener('message',e=>{if(!frame||e.source!==frame.contentWindow||!e.data||!router)return;const action=e.data.amsUiAction;const all=components(),path=router.currentRoute.path;const active=all.find(v=>v.$options&&v.$options.name===({'/course':'course','/leave':'leave','/signCode':'signCode'}[path]));
 switch(action){case 'ready':last='';refresh();break;case 'scan':if(path==='/home')location.href='ams-local://scan';break;case 'home':router.push('/home');break;case 'code':router.push('/signCode');break;case 'records':router.push('/course');break;case 'leave':if(leaveEnabled)router.push('/leave');break;case 'submitCode':if(path==='/signCode'&&active&&typeof e.data.code==='string'&&e.data.code.length>0&&e.data.code.length<=20){active.code=e.data.code;active.onSubmit();}break;case 'recordDetail':if(path==='/course'&&active&&active.list[e.data.index])active.goDetail(active.list[e.data.index]);break;case 'leaveDetail':if(path==='/leave'&&active&&active.leaveDatas&&active.leaveDatas.leaveList[e.data.index])active.goDetail(active.leaveDatas.leaveList[e.data.index]);break;case 'applyLeave':if(path==='/leave'&&leaveEnabled)router.push('/leaveApplication');break;}refresh();});
 setInterval(refresh,200);refresh();
''' +s[b:]
p.write_text(s,encoding='utf-8')
