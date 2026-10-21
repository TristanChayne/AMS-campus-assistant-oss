// REMIND-001 / REMIND-SETTINGS-001 (D-021) course reminder settings. Settings shows one entry row; the reminder page
// opens from it with its own sub-pages (lead time, per-course mute). Native announces {available:true,...}; otherwise
// the entry stays hidden.
// State: {available, decided, enabled, channels:[{key,label,detail,on,blocked,blockedText}], leadMin, merge,
//         upload:{available,enabled}, status, settingsLink, mutedCodes:[], courses:[{code,title}]}
// Changes sent to native: {enabled}, {channel:{key,on}}, {leadMin}, {merge}, {upload}, {mute:{code,muted}},
//         {openSettings}, {decided,...} from the first choice.
let courseReminder={available:false},reminderOpen=false,reminderView='main';
const REMINDER_LEADS=[5,10,15,20,30];
function courseReminderSend(change){send('courseReminder',{change});}
function reminderChannels(){return Array.isArray(courseReminder.channels)?courseReminder.channels:[];}
function reminderSwitch(id,on,label,disabled){return `<button class="keepalive-switch" id="${id}" role="switch" aria-checked="${!!on}" aria-label="${escape(label)}"${disabled?' disabled':''}><span></span></button>`;}
function reminderSummary(){const r=courseReminder;if(r.decided===false)return '未开启';if(!r.enabled)return '已关闭';const on=reminderChannels().filter(c=>c.on).map(c=>c.short||c.label);return (on.length?on.join(' · ')+' · ':'')+'提前 '+r.leadMin+' 分钟';}
// Settings page entry: one row with the current state on the right.
function renderCourseReminderEntry(){const b=document.getElementById('courseReminderEntry');if(!b)return;const r=courseReminder;b.hidden=!r.available;if(!r.available)return;const warn=r.enabled&&r.settingsLink;
 b.innerHTML=`<span class="reminder-entry-title">课程提醒<small>${escape(reminderSummary())}</small></span><span class="reminder-entry-value${warn?' reminder-warn':''}">${warn?'需要授权':r.decided===false?'去开启':r.enabled?'已开启':'已关闭'}<span aria-hidden="true">›</span></span>`;
 b.onclick=()=>{reminderOpen=true;reminderView='main';render();};}
function renderCourseReminder(){renderCourseReminderEntry();if(reminderOpen&&!courseReminder.available)reminderOpen=false;if(reminderOpen&&typeof page==='object'){const screen=document.getElementById('otherScreen');if(screen&&lastRenderedRoute==='/courseReminder'){const y=window.scrollY;renderCourseReminderPage(screen);window.scrollTo(0,y);}}}
function reminderBack(){if(reminderView!=='main'){reminderView='main';render();return;}reminderOpen=false;render();}
function renderCourseReminderPage(screen){
 const r=courseReminder,locked=r.decided===false,muted=Array.isArray(r.mutedCodes)?r.mutedCodes:[];
 if(reminderView==='lead'){
  screen.innerHTML=`<button class="return" id="reminderBack">‹ 课程提醒</button><h3 class="reminder-group-title">上课前多久提醒</h3><section class="form-section reminder-group">${REMINDER_LEADS.map(n=>`<button class="reminder-option" data-reminder-lead="${n}" aria-pressed="${r.leadMin===n}"><span>${n} 分钟</span><span aria-hidden="true">${r.leadMin===n?'✓':''}</span></button>`).join('')}</section>`;
  screen.querySelectorAll('[data-reminder-lead]').forEach(b=>b.onclick=()=>{r.leadMin=Number(b.dataset.reminderLead);courseReminderSend({leadMin:r.leadMin});reminderView='main';render();});
 }else if(reminderView==='mute'){
  const seen=new Set(),list=[];
  for(const c of Array.isArray(r.courses)?r.courses:[])if(c&&c.code&&!seen.has(c.code)){seen.add(c.code);list.push(c);}
  for(const code of muted)if(!seen.has(code)){seen.add(code);list.push({code,title:''});}
  screen.innerHTML=`<button class="return" id="reminderBack">‹ 课程提醒</button><h3 class="reminder-group-title">按课程设置</h3><p class="form-help reminder-page-help">关掉的课程不再提醒，课表照常显示。</p><section class="form-section reminder-group">${list.length?list.map(c=>`<div class="keepalive-head reminder-item"><div><h2>${escape(c.code)}</h2>${c.title?`<p class="form-help">${escape(c.title)}</p>`:''}</div>${reminderSwitch('',!muted.includes(c.code),c.code+' 提醒').replace('id=""',`data-reminder-course="${escape(c.code)}"`)}</div>`).join(''):'<p class="form-help">打开课表后会列出最近的课程。</p>'}</section>`;
  screen.querySelectorAll('[data-reminder-course]').forEach(b=>b.onclick=()=>{const code=b.dataset.reminderCourse,mute=!muted.includes(code);r.mutedCodes=muted.filter(x=>x!==code).concat(mute?[code]:[]);courseReminderSend({mute:{code,muted:mute}});render();});
 }else{
  const off=locked||!r.enabled,channels=reminderChannels(),upload=r.upload||{};
  screen.innerHTML=`<button class="return" id="reminderBack">‹ 返回设置</button>${locked?`<section class="form-section reminder-intro"><h2>课程提醒未开启</h2><p class="form-help">开启后，上课前会提醒你，并显示倒计时与上课进度。</p><button class="form-submit" id="reminderStart">开启课程提醒</button></section>`:''}
<div class="reminder-page${locked?' reminder-locked':''}"${locked?' inert aria-disabled="true"':''}>
<section class="form-section reminder-group"><div class="keepalive-head"><div><h2>课程提醒</h2><p class="form-help">上课前提醒，并显示倒计时与上课进度。</p></div>${reminderSwitch('courseReminderSwitch',r.enabled&&!locked,'课程提醒')}</div>${r.status&&!locked?`<p class="form-help keepalive-last">${escape(r.status)}${r.settingsLink?' <button class="reminder-link" id="courseReminderSettings">去设置</button>':''}</p>`:''}</section>
<div class="${off&&!locked?'reminder-dim':''}">
<h3 class="reminder-group-title">提醒方式</h3><section class="form-section reminder-group">${channels.map(c=>`<div class="keepalive-head reminder-item${c.blocked?' reminder-blocked':''}"><div><h2>${escape(c.label)}</h2><p class="form-help">${escape(c.blocked&&c.on?c.blockedText||'系统设置中已关闭':c.detail||'')}${c.blocked&&c.on?' <button class="reminder-link" data-reminder-settings>去设置</button>':''}</p></div>${reminderSwitch('',c.on&&!off,c.label,off).replace('id=""',`data-reminder-channel="${escape(c.key)}"`)}</div>`).join('')}<p class="form-help reminder-note">可以同时开启；都关闭时课程提醒会自动关闭。</p></section>
<h3 class="reminder-group-title">时间</h3><section class="form-section reminder-group"><button class="reminder-option" id="reminderLead"${off?' disabled':''}><span>提前提醒</span><span>${r.leadMin} 分钟 ›</span></button><div class="keepalive-head reminder-item"><div><h2>连堂合并</h2><p class="form-help">相隔 30 分钟内的课合并为一次提醒，下课后直接显示下一节。</p></div>${reminderSwitch('courseReminderMerge',r.merge&&!off,'连堂合并',off)}</div></section>
<h3 class="reminder-group-title">更多</h3><section class="form-section reminder-group">${upload.available?`<div class="keepalive-head reminder-item"><div><h2>未打开 App 也提醒</h2><p class="form-help">${upload.enabled?'课表已同步到 AMS 提醒服务器，没打开 App 时也会按时显示、自动切换和收起。关闭后立即删除服务器上的数据。':'开启后会把未来 3 天的课表同步到 AMS 提醒服务器。'}</p></div>${reminderSwitch('courseReminderUpload',upload.enabled&&!off,'未打开 App 也提醒',off)}</div>`:''}<button class="reminder-option" id="reminderMuteList"${off?' disabled':''}><span>按课程设置</span><span>${muted.length?muted.length+' 门不提醒':'全部提醒'} ›</span></button></section>
</div></div>`;
  const start=document.getElementById('reminderStart');if(start)start.onclick=()=>maybeAskCourseReminder(true);
  const sw=document.getElementById('courseReminderSwitch');if(sw)sw.onclick=()=>{r.enabled=!r.enabled;if(r.enabled&&!channels.some(c=>c.on)&&channels[0])channels[0].on=true;courseReminderSend({enabled:r.enabled});render();};
  screen.querySelectorAll('[data-reminder-channel]').forEach(b=>b.onclick=()=>{const c=channels.find(x=>x.key===b.dataset.reminderChannel);if(!c)return;c.on=!c.on;courseReminderSend({channel:{key:c.key,on:c.on}});if(!channels.some(x=>x.on))r.enabled=false;render();});
  const merge=document.getElementById('courseReminderMerge');if(merge)merge.onclick=()=>{r.merge=!r.merge;courseReminderSend({merge:r.merge});render();};
  const up=document.getElementById('courseReminderUpload');if(up)up.onclick=()=>{if(upload.enabled){upload.enabled=false;courseReminderSend({upload:false});render();return;}
   show('<h2>开启云端提醒？</h2><p>开启后，未来 3 天的课表（日期、上下课时间、课程名、课程编号、教室）会同步到 AMS 提醒服务器，用于在你没有打开 App 时按时显示灵动岛、自动切换并在下课后收起。</p><p>不会上传密码、验证码、学校 Cookie 或登录令牌。随时可以在这里关闭，关闭后服务器上的数据会立即删除。</p><button class="form-submit" id="confirmReminderUpload">同意并开启</button>');
   document.getElementById('confirmReminderUpload').onclick=()=>{closeSheet();upload.enabled=true;courseReminderSend({upload:true});render();};};
  const lead=document.getElementById('reminderLead');if(lead)lead.onclick=()=>{reminderView='lead';render();};
  const list=document.getElementById('reminderMuteList');if(list)list.onclick=()=>{reminderView='mute';render();};
  screen.querySelectorAll('#courseReminderSettings,[data-reminder-settings]').forEach(b=>b.onclick=()=>courseReminderSend({openSettings:true}));
 }
 document.getElementById('reminderBack').onclick=reminderBack;
}
// First successful login (home with the timetable) asks once per device how reminders should work; the reminder page's
// "开启课程提醒" asks again on demand (force). Closing the sheet without a choice asks again next time.
let courseReminderAsked=false;
function maybeAskCourseReminder(force){
 const r=courseReminder;
 if(force!==true&&(courseReminderAsked||!r.available||r.decided!==false||!ready||page.route!=='/home'||settingsOpen||reservationsOpen))return;
 const sheet=document.getElementById('sheet');if(!sheet||sheet.open)return;
 courseReminderAsked=true;
 const cloud=!!(r.upload&&r.upload.available);
 const choose=change=>{courseReminder=Object.assign({},courseReminder,{decided:true},change.enabled===false?{enabled:false}:{enabled:true});courseReminderSend(Object.assign({decided:true},change));closeSheet();renderCourseReminder();};
 if(cloud){
  show(`<h2>课程提醒</h2><p>上课前提醒你，并在灵动岛和锁屏显示上课倒计时与进度。请选择课表的处理方式：</p>
<section class="form-section reminder-choice"><h3>云端处理</h3><p class="form-help">没打开 App 时也能按时启动灵动岛，上课时自动切换为“正在上课”，连堂自动切到下一节，下课后自动收起。为此会把未来 3 天的课表（日期、上下课时间、课程名、课程编号、教室）和提醒设置上传到 AMS 提醒服务器。</p><button class="form-submit" id="reminderCloud">云端处理</button></section>
<section class="form-section reminder-choice"><h3>仅本机处理</h3><p class="form-help">课表只保存在这台手机上，课前用普通通知提醒；灵动岛要在打开 App 后才会出现，下课后需要打开 App 才会收起。</p><button class="reminder-secondary" id="reminderLocal">仅本机处理</button></section>
<p class="form-help">无论选哪种，你的密码和学校登录凭证都不会上传云端。之后可以在“设置 → 课程提醒”里随时更改；关闭云端处理后，服务器上的数据会被删除。</p>
<button class="reminder-link reminder-skip" id="reminderSkip">暂不开启</button>`);
  document.getElementById('reminderCloud').onclick=()=>choose({enabled:true,upload:true});
  document.getElementById('reminderLocal').onclick=()=>choose({enabled:true,upload:false});
 }else{
  show(`<section class="reminder-first-choice"><h2>课程提醒</h2><p>上课前提醒你，并在通知栏显示上课倒计时与进度。课表只保存在这台手机上，不会上传；密码和学校登录凭证也不会上传。</p><p class="form-help">之后可以在“设置 → 课程提醒”里随时更改。</p><div class="reminder-first-actions"><button class="form-submit" id="reminderLocal">开启课程提醒</button><button class="form-submit" id="reminderSkip">暂不开启</button></div></section>`,true);
  document.getElementById('reminderLocal').onclick=()=>choose({enabled:true});
 }
 // "暂不开启" from the page itself keeps the page locked; from the first-login prompt it records the choice.
 document.getElementById('reminderSkip').onclick=()=>{if(force===true){closeSheet();return;}choose({enabled:false});};
}
// Course detail: per-course mute, only when reminders are on and the course has a code.
function courseReminderDetail(c){const r=courseReminder;if(!r.available||!r.enabled||!c||!c.moduleCode)return '';const muted=(r.mutedCodes||[]).includes(c.moduleCode);return `<button class="form-submit reminder-mute" id="reminderMute" data-code="${escape(c.moduleCode)}" data-muted="${muted}">${muted?'恢复这门课的提醒':'这门课不提醒'}</button>`;}
function bindCourseReminderDetail(){const b=document.getElementById('reminderMute');if(!b)return;b.onclick=()=>{const code=b.dataset.code,muted=b.dataset.muted!=='true',list=(courseReminder.mutedCodes||[]).filter(x=>x!==code);if(muted)list.push(code);courseReminder.mutedCodes=list;courseReminderSend({mute:{code,muted}});closeSheet();};}
