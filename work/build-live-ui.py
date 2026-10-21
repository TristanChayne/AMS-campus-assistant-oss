from pathlib import Path
import re, json, base64
root = Path('outputs/ams-android/app/src/main/assets')
preview = Path('outputs/timetable-preview/index.html').read_text(encoding='utf-8-sig')
style = re.search(r'<style>(.*?)</style>', preview, re.S).group(1)
style += '''
button,summary{-webkit-tap-highlight-color:transparent;touch-action:manipulation;position:relative;isolation:isolate;overflow:hidden}
button:focus-visible,summary:focus-visible{outline:2px solid #537cb8;outline-offset:-3px}
button:focus:not(:focus-visible),summary:focus:not(:focus-visible){outline:none}
button{transition:transform 100ms ease,background 150ms ease}
button:active{transform:scale(.98)}
.tap-ripple{position:absolute;border-radius:50%;background:currentColor;pointer-events:none;opacity:0;transform:scale(0);animation:tap-spread 380ms ease-out;z-index:0}
@keyframes tap-spread{0%{opacity:.16;transform:scale(0)}70%{opacity:.09}100%{opacity:0;transform:scale(1)}}
@media(prefers-reduced-motion:reduce){button{transition:none}button:active{transform:none}.tap-ripple{animation:none}}
.record-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 18px}.record-filters label{font-size:11px;color:var(--pencil)}.record-filters select,.record-filters input{display:block;width:100%;min-width:0;margin-top:6px;border:1px solid var(--line);border-radius:10px;background:#fafbfd;padding:10px;font:inherit;color:var(--ink);font-size:13px}.record-filters .date-filter{grid-column:1/-1}.session{background:#fafbfd;border:1px solid var(--line);border-radius:16px;padding:17px;margin-bottom:10px}.session-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.session h3{font-size:14px;line-height:1.45;overflow-wrap:anywhere;margin:0;max-width:72%}.badge{white-space:nowrap;font-size:11px;padding:5px 8px;border-radius:7px;background:#edf0f5;color:#526079}.badge.present{background:#e6f2ed;color:#287053}.badge.absent{background:#faece9;color:#9a463b}.session-date{font-size:14px;margin:13px 0 8px;font-variant-numeric:tabular-nums}.session-foot{font-size:11px;color:var(--pencil);display:flex;justify-content:space-between;gap:8px;line-height:1.6}.empty-state{margin-top:32px;text-align:center;padding:32px 16px;color:var(--pencil)}.empty-state .empty-symbol{width:64px;height:64px;border-radius:20px;background:#e8edf5;display:grid;place-items:center;margin:0 auto 20px;color:#627da8}.empty-state svg{width:29px;height:29px}.empty-state h2{font-size:16px;font-weight:600;color:var(--ink);margin:0 0 9px}.empty-state p{font-size:12px;line-height:1.7;margin:0}.load-note{font-size:12px;color:var(--pencil);text-align:center;padding:14px}.session-title{font-size:13px;color:var(--pencil);margin:12px 0}
'''
style += Path('work/managed-ui-polish.css').read_text(encoding='utf-8')
body = preview[preview.index('<svg style='):preview.index('<script>')]
body = re.sub(r'<aside class="demo">.*?</aside>', '', body, flags=re.S)
body = body.replace('</defs></svg>', '<symbol id="seat" viewBox="0 0 24 24"><path d="M6 11V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5M4 11h16v4H4zM6 15v5m12-5v5"/></symbol><symbol id="room" viewBox="0 0 24 24"><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M15 12h.01"/></symbol><symbol id="sports" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3.5 3 3.5 9.8 0 12.8M18.4 5.6c-3.5 3-3.5 9.8 0 12.8"/></symbol><symbol id="bus" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3m8 3v-3M8 7h8M8 14.5h.01M16 14.5h.01"/></symbol><symbol id="bookings" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 1.5 1.5L12 8m-4 7 1.5 1.5L12 14m2-4.5h3m-3 6h3"/></symbol></defs></svg>', 1)
body = body.replace('今天，去哪上课', '今日课表').replace('<span class="preview-tag">界面预览</span>', '').replace('回到今天 ↗','回到今天')
body=body.replace('</header>', '<button id="xjCodeBtn" class="settings-button xj-code-button" aria-label="我的西浦码"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/></svg><span>西浦码</span></button><button id="hhtCodeBtn" class="settings-button hht-code-button" aria-label="宿舍通行码"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/></svg><span>宿舍码</span></button><button id="settingsBtn" class="settings-button" aria-label="设置"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/></svg></button></header>')
body=body.replace('<div id="completed"></div></section>', '<div id="completed"></div></section><p id="dailyLine" class="daily-line" hidden></p>')
body=body.replace('<div class="date-head">','<div id="homeScreen"><div class="date-head">').replace('<nav aria-label=', '</div><section id="otherScreen" hidden></section><nav aria-label=')
script = r'''
const icon=id=>`<svg aria-hidden="true"><use href="#${id}"/></svg>`;
let days=[], selected=0, ready=false,page={route:'/home'},draft='',busy=false,lastRenderedRoute='',nativeNavState='',followToday=true;
let reservationsOpen=false,settingsOpen=false,settingsData={account:'待读取',theme:'blue',appearance:'system',keepAlive:{available:false,enabled:false,days:3}};
const themes={blue:['校园蓝','#172e61','#254e9b','#eaf0fa'],green:['青绿','#205c52','#327e70','#e8f3ef'],dusk:['暮蓝','#405D7A','#405D7A','#EAF0F6'],teal:['松石青','#356B68','#356B68','#E9F2F0'],sage:['鼠尾草绿','#526B58','#526B58','#EDF2ED'],smoke:['烟紫','#655F7C','#655F7C','#F0EDF5'],graphite:['石墨灰','#555E6A','#555E6A','#EDF0F3'],rose:['玫瑰粉','#956174','#805064','#F5EBEF'],wheat:['麦穗金','#806A28','#756020','#F5F0DF']};
function applyTheme(key){if(key==='orange')key='smoke';const t=themes[key]||themes.blue;settingsData.theme=themes[key]?key:'blue';for(const [i,name] of ['--campus-blue','--room-blue','--lecture-wash'].entries())document.documentElement.style.setProperty(name,t[i+1]);}
const appearanceNames={system:'跟随系统',light:'浅色',dark:'深色'};
function applyAppearance(mode,dark){
 settingsData.appearance=['system','light','dark'].includes(mode)?mode:'system';
 document.documentElement.classList.toggle('ams-dark',!!dark);
 const label=document.getElementById('appearanceLabel');if(label)label.textContent=appearanceNames[settingsData.appearance];document.querySelectorAll('[data-appearance]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.appearance===settingsData.appearance)));
}
function scan(){settingsOpen=false;send('scan');}
function renderSettings(screen){screen.innerHTML=`<section class="form-section"><h2>当前账号</h2><p class="account-name">${escape(settingsData.account)}</p><button class="logout-button" id="logoutBtn">退出登录</button></section><details class="appearance-dropdown" id="appearanceDropdown"><summary class="settings-row"><span>外观</span><span><span id="appearanceLabel">${appearanceNames[settingsData.appearance]}</span><span class="appearance-chevron" aria-hidden="true">›</span></span></summary><div class="appearance-menu" role="group" aria-label="外观模式">${Object.entries(appearanceNames).map(([key,label])=>`<button data-appearance="${key}" aria-pressed="${settingsData.appearance===key}"><span>${label}</span><span class="appearance-check" aria-hidden="true">✓</span></button>`).join('')}</div></details><section class="form-section"><h2>主题色</h2><div class="theme-options">${Object.entries(themes).map(([key,t])=>`<button data-theme="${key}" aria-pressed="${settingsData.theme===key}"><span style="background:${t[1]}">${settingsData.theme===key?'✓':''}</span>${t[0]}</button>`).join('')}</div></section><button class="settings-row" id="campusMapsBtn"><span>校园地图</span><span aria-hidden="true">›</span></button><section class="form-section keepalive-section" id="keepAliveSection" hidden></section><button class="settings-row" id="checkUpdateBtn"><span>检查更新</span><span aria-hidden="true">›</span></button><div class="about-app">AMS 校园助手 · 0.15.1<br>由 Tristan Chayne 制作<br><a id="creatorEmail" href="mailto:linlantc@gmail.com">linlantc@gmail.com</a><br><a id="creatorSupport" href="https://afdian.com/a/tristanchayne">在爱发电支持创作者 ↗</a></div>`;screen.querySelectorAll('[data-appearance]').forEach(b=>b.onclick=()=>{document.getElementById('appearanceDropdown').open=false;send('appearance',{appearance:b.dataset.appearance});});document.getElementById('campusMapsBtn').onclick=()=>{mapsOpen=true;render();};screen.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{applyTheme(b.dataset.theme);send('theme',{theme:b.dataset.theme});render();});document.getElementById('creatorSupport').onclick=e=>{e.preventDefault();send('supportCreator');};document.getElementById('checkUpdateBtn').onclick=()=>send('checkUpdate');renderKeepAlive();document.getElementById('creatorEmail').onclick=e=>{e.preventDefault();send('contact');};document.getElementById('logoutBtn').onclick=()=>{show('<h2>退出登录？</h2><p>退出后将清除本账号的课程与签到缓存，需要重新登录。</p><button class="form-submit" id="confirmLogout">退出登录</button>');document.getElementById('confirmLogout').onclick=()=>send('logout');};}
// Android-only: the native app announces availability; iOS never does, so the section stays hidden there.
function renderKeepAlive(){const box=document.getElementById('keepAliveSection');if(!box)return;const k=settingsData.keepAlive||(settingsData.keepAlive={available:false,enabled:false,days:3});box.hidden=!k.available;if(!k.available){box.innerHTML='';return;}
 box.innerHTML=`<div class="keepalive-head"><div><h2>体育馆保持登录</h2><p class="form-help">离开体育馆后约每 10 分钟向体育中心确认一次登录，避免闲置约 30 分钟后退出。</p></div><button class="keepalive-switch" id="keepAliveSwitch" role="switch" aria-checked="${k.enabled}" aria-label="体育馆保持登录"><span></span></button></div>${k.enabled?`<div class="keepalive-days" role="group" aria-label="连续多少天未打开体育馆后自动停止">${[3,5,7].map(n=>`<button data-keep-days="${n}" aria-pressed="${k.days===n}">${n} 天</button>`).join('')}</div>`:''}<p class="form-help">${k.enabled?`连续 ${k.days} 天未打开体育馆后自动停止；不保存密码或验证码，手机深度休眠时仍可能退出。`:'已关闭，离开体育馆后不再保持登录。'}</p>${k.enabled&&k.last?`<p class="form-help keepalive-last">${escape(k.last)}</p>`:''}`;
 document.getElementById('keepAliveSwitch').onclick=()=>{k.enabled=!k.enabled;send('keepAlive',{enabled:k.enabled,days:k.days});renderKeepAlive();};
 box.querySelectorAll('[data-keep-days]').forEach(b=>b.onclick=()=>{k.days=Number(b.dataset.keepDays);send('keepAlive',{enabled:k.enabled,days:k.days});renderKeepAlive();});}
const scrollPositions={};
const screens={};
function navigate(route,action){reservationsOpen=false;mapsOpen=false;settingsOpen=false;if(screens[route]){page=screens[route];render();}send(action);}
const mins=t=>Number(t.split(':')[0])*60+Number(t.split(':')[1]);
const escape=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const send=(action,extra={})=>parent.postMessage(Object.assign({amsUiAction:action},extra),'*');
document.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;
 const button=e.target.closest&&e.target.closest('button,summary');if(!button)return;
 if(button.closest('nav')){button.classList.remove('nav-press');void button.offsetWidth;button.classList.add('nav-press');setTimeout(()=>button.classList.remove('nav-press'),400);return;}
 const rect=button.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
 const radius=Math.hypot(Math.max(x,rect.width-x),Math.max(y,rect.height-y));
 const ripple=document.createElement('span');ripple.className='tap-ripple';ripple.setAttribute('aria-hidden','true');
 ripple.style.cssText=`width:${radius*2}px;height:${radius*2}px;left:${x-radius}px;top:${y-radius}px`;
 button.appendChild(ripple);setTimeout(()=>ripple.remove(),400);
});
const rows=()=>days[selected]&&Array.isArray(days[selected].timetableVoList)?days[selected].timetableVoList:[];
function times(c){const matches=String(c.moduleTime||'').match(/\d{1,2}:\d{2}/g);if(!matches||matches.length<2)return null;const start=mins(matches[0]),end=mins(matches[1])-10;if(end<=start)return null;return [matches[0],String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0')];}
function displayTime(c){const t=times(c);return t?t[0]+' — '+t[1]:'时间待确认';}
let sheetCloseTimer;
function closeSheet(){
 const sheet=document.getElementById('sheet');if(!sheet.open||sheet.onanimationend)return;
 clearTimeout(sheetCloseTimer);
 if(window.matchMedia('(prefers-reduced-motion:reduce)').matches){sheet.close();return;}
 const finish=()=>{clearTimeout(sheetCloseTimer);sheet.onanimationend=null;sheet.close();sheet.classList.remove('closing');};
 sheet.onanimationend=e=>{if(e.target===sheet&&e.animationName==='sheet-dismiss')finish();};
 sheet.classList.add('closing');
 sheetCloseTimer=setTimeout(finish,450);
}
function show(content,hideClose=false){clearTimeout(sheetCloseTimer);document.getElementById('sheet').onanimationend=null;document.getElementById('sheet').classList.remove('closing');document.getElementById('sheetContent').innerHTML=content;document.getElementById('close').hidden=hideClose;document.getElementById('sheet').showModal();}
function detail(i){const c=rows()[i];show(`<h2${latin(c.moduleTitle)}>${escape(c.moduleTitle)}</h2><dl><dt>实际上课时间</dt><dd>${escape(displayTime(c))}</dd><dt>AMS 原始时间</dt><dd>${escape(c.moduleTime||'未提供')}</dd><dt>教室</dt><dd>${escape(c.room||'学校暂未提供')}</dd><dt>课程编号</dt><dd>${escape(c.moduleCode||'—')}</dd><dt>教学组</dt><dd>${escape(c.moduleTypeGroup||'—')}</dd></dl>`);}
function dayOffset(day,now=new Date()){
 const text=String(day&&day.date||'').trim();
 const full=text.match(/(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/),short=text.match(/(\d{1,2})[-\/.月](\d{1,2})/);
 if(!full&&!short)return null;
 const month=Number((full||short)[full?2:1]),date=Number((full||short)[full?3:2]);
 let year=full?Number(full[1]):now.getFullYear();
 const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
 if(!full){year=[year-1,year,year+1].sort((a,b)=>Math.abs(Date.UTC(a,month-1,date)-today)-Math.abs(Date.UTC(b,month-1,date)-today))[0];}
 const value=new Date(year,month-1,date);if(value.getMonth()!==month-1||value.getDate()!==date)return null;
 return Math.round((Date.UTC(year,month-1,date)-today)/86400000);
}
function dayLabel(day,now,index){const offset=dayOffset(day,now);if(offset===null)return day&&day.date&&day.date!=='-'?day.date:'待读取';const names=['昨天','今天','明天','后天'];if(offset>=-1&&offset<=2)return names[offset+1];
 // Further days: weekday this week, "下周X" next week, otherwise the month and day (e.g. across a holiday).
 const target=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset),week=['周日','周一','周二','周三','周四','周五','周六'];
 const monday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x.getTime();};
 const weeks=Math.round((monday(target)-monday(now))/604800000);
 if(offset>0&&weeks===0)return week[target.getDay()];if(offset>0&&weeks===1)return '下'+week[target.getDay()];return (target.getMonth()+1)+'月'+target.getDate()+'日';}
function dayTitle(day,now){const offset=dayOffset(day,now);return offset===null?'课表':offset===0?'今日课表':offset===1?'明日课表':offset===-1?'昨日课表':dayLabel(day,now)+'课表';}
// Latin-only titles (most course names) render with Latin punctuation instead of full-width CJK quotes.
function latin(text){return /^[\x00-\x7F\u2010-\u2027\u00A0-\u00FF]*$/.test(String(text||''))?' lang="en"':'';}
function card(c,i,ended=false){const t=times(c);const now=new Date();const n=now.getHours()*60+now.getMinutes(),isToday=dayOffset(days[selected],now)===0;const state=ended?'已结束':isToday&&t&&mins(t[0])<=n&&n<mins(t[1])?'进行中':'待上课';return `<article class="lesson"><div class="times">${escape(t?t[0]:'—')}<small>${escape(t?t[1]:'')}</small></div><button class="card" data-detail="${i}" aria-label="查看课程详情"><div class="card-top"><span>${escape(c.moduleCode||'')}</span><span class="state">${ended?state:t?state:'时间待确认'}</span></div><h3${latin(c.moduleTitle)}>${escape(c.moduleTitle||'未命名课程')}</h3><div class="room">${icon('pin')}${escape(c.room||'地点待确认')}<span class="arrow">›</span></div></button></article>`;}
let calendarDay='';
function renderHome(){const now=new Date(),n=now.getHours()*60+now.getMinutes();const chosen=days[selected];days=days.filter(d=>!d.__amsEmptyToday);if(ready&&days.length&&days.every(d=>dayOffset(d,now)!==null&&dayOffset(d,now)>0)){days.unshift({date:String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0'),timetableVoList:[],__amsEmptyToday:true});}if(!followToday&&chosen){const index=days.indexOf(chosen);if(index>=0)selected=index;}const todayKey=[now.getFullYear(),now.getMonth(),now.getDate()].join('-');if(calendarDay!==todayKey){calendarDay=todayKey;followToday=true;}if(followToday){const todayIndex=days.findIndex(d=>dayOffset(d,now)===0);if(todayIndex>=0)selected=todayIndex;}const offset=dayOffset(days[selected],now),isToday=offset===0,isPast=offset!==null&&offset<0;document.querySelector('h1').textContent=ready&&days[selected]?dayTitle(days[selected],now):'今日课表';const todayButton=document.getElementById('today');if(todayButton)todayButton.hidden=isToday||!days.some(d=>dayOffset(d,now)===0);document.getElementById('month').textContent=now.getFullYear()+' 年 '+(now.getMonth()+1)+' 月';document.getElementById('week').style.gridTemplateColumns='repeat('+Math.max(3,days.length)+',minmax(0,1fr))';document.getElementById('week').innerHTML=Array.from({length:Math.max(3,days.length)},(_,i)=>i).map(i=>`<button class="day ${selected===i?'selected':''}" data-date="${i}" aria-pressed="${selected===i}"><small>${dayLabel(days[i],now,i)}</small><b>${escape(days[i]&&days[i].date&&days[i].date.trim()!=='-'?days[i].date:'待读取')}</b></button>`).join('');let all=rows().map((c,i)=>({c,i}));all.sort((a,b)=>{const x=times(a.c),y=times(b.c);return (x?mins(x[0]):Infinity)-(y?mins(y[0]):Infinity);});const valid=ready&&days[selected]&&days[selected].date&&days[selected].date.trim()!=='-'&&Array.isArray(days[selected].timetableVoList);const ended=isPast?all:isToday?all.filter(x=>times(x.c)&&mins(times(x.c)[1])<=n):[];const remaining=all.filter(x=>!ended.includes(x));const next=remaining.find(x=>times(x.c));const t=next&&times(next.c);const active=isToday&&t&&mins(t[0])<=n&&n<mins(t[1]);document.getElementById('focus').innerHTML=next?`<div class="hero"><div class="hero-top"><span>${active?'正在上课':isToday?'下一节课':'当天第一节课'}${next.c.moduleCode?'&nbsp;&nbsp;'+escape(next.c.moduleCode):''}</span><span>${isToday?(active?'还有 '+(mins(t[1])-n)+' 分钟结束':(mins(t[0])-n)+' 分钟后开始'):escape(days[selected].date)}</span></div><h2${latin(next.c.moduleTitle)}>${escape(next.c.moduleTitle)}</h2><div class="hero-time">${escape(t[0])} — ${escape(t[1])}</div><div class="destination">${icon('pin')}<b>${escape(next.c.room||'地点待确认')}</b><span>上课地点</span></div>${active?`<div class="bar"><i style="width:${(n-mins(t[0]))/(mins(t[1])-mins(t[0]))*100}%"></i></div>`:''}</div>`:'';document.getElementById('listTitle').textContent=isToday?(active?'之后的课':'接下来的课'):dayLabel(days[selected],now,selected)+'课程';document.getElementById('count').textContent=valid?all.length+' 节课'+(isToday?' · 剩余 '+remaining.length+' 节':''):'尚未读取';const following=remaining.filter(x=>!(active&&x===next));document.getElementById('lessons').innerHTML=following.length?remaining.filter(x=>!(active&&x===next)).map(x=>card(x.c,x.i)).join(''):`<div class="empty">${icon('calendar')}<h2>${!valid?'正在读取学校课表':active?'当前课程见上方':all.length?dayLabel(days[selected],now,selected)+'的课都结束了':'当天没有课程'}</h2><p>${!valid?'稍等片刻，课表正在加载。':active?'之后没有其他课程了。':all.length?'今天辛苦了。':'享受自由安排的一天。'}</p></div>`;document.getElementById('completed').innerHTML=ended.length?`<details class="completed" ${isPast?'open':''}><summary>${dayLabel(days[selected],now,selected)}已结束 · ${ended.length} 节课</summary>${ended.map(x=>card(x.c,x.i,true)).join('')}</details>`:'';document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{followToday=false;selected=Number(b.dataset.date);render();});document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>detail(Number(b.dataset.detail)));}

function render(){
 const route=reservationsOpen?'/reservations':mapsOpen?'/campusMaps':settingsOpen?'/settings':page.route||'/home',home=route==='/home';
 document.querySelector('.app').classList.toggle('home-layout',home);document.querySelector('.app').classList.toggle('settings-layout',route==='/settings');
 const changed=lastRenderedRoute!==route;if(changed){if(lastRenderedRoute)scrollPositions[lastRenderedRoute]=window.scrollY;lastRenderedRoute=route;if(document.getElementById('sheet').open)document.getElementById('sheet').close();}
 document.getElementById('dailyLine').hidden=!home||!document.getElementById('dailyLine').textContent;document.querySelector('nav').hidden=!['/home','/course','/leave','/reservations'].includes(route);document.getElementById('xjCodeBtn').hidden=!home;document.getElementById('hhtCodeBtn').hidden=!home;document.getElementById('settingsBtn').hidden=!['/home','/course','/leave'].includes(route);document.querySelector('.app').classList.toggle('focused-flow',!['/home','/course','/leave','/reservations'].includes(route));document.getElementById('homeScreen').hidden=!home;
 document.getElementById('otherScreen').hidden=home;
 document.querySelector('h1').textContent=home?'今日课表':route==='/settings'?'设置':route==='/campusMaps'?'校园地图':route.startsWith('/course')?'签到记录':route==='/leaveApplication'?'请假申请':route==='/leaveCourse'?'选择课程':route==='/leave'?'请假':route==='/signCode'?'Code 签到':'签到结果';
 document.querySelectorAll('nav button').forEach((b,i)=>b.classList.toggle('active',i===(route==='/reservations'?3:route.startsWith('/course')?1:route.startsWith('/leave')?2:0)));
 if(changed){requestAnimationFrame(()=>window.scrollTo(0,scrollPositions[route]||0));const panel=document.getElementById(home?'homeScreen':'otherScreen');panel.classList.remove('screen-enter');void panel.offsetWidth;panel.classList.add('screen-enter');panel.onanimationend=()=>panel.classList.remove('screen-enter');}
 document.querySelectorAll('nav button').forEach(b=>{if(b.classList.contains('active'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 const navState=JSON.stringify({visible:!document.querySelector('nav').hidden&&!document.querySelector('dialog[open]'),index:route==='/reservations'?3:route.startsWith('/course')?1:route.startsWith('/leave')?2:0});if(navState!==nativeNavState){nativeNavState=navState;send('nativeNavigation',JSON.parse(navState));}
 if(home){renderHome();return;}
 const list=page.list||[],screen=document.getElementById('otherScreen');
 const back='<button class="return" id="backHome">‹ 返回课表</button>';
 if(route==='/reservations'){document.querySelector('h1').textContent='预约';screen.innerHTML='<div class="reservation-services">'+[['seat','图书馆座位','选择座位 · 查看真实位置'],['room','讨论室','选择房间 · 查看空闲时段'],['fb','FB 讨论室（SIP）','进入「静音仓」板块选择 FB 座位'],['sports','体育馆预约','场馆与运动票 · 订单与预约码'],['bus','区间车','预约班次 · 出示乘车码'],['records','我的预约','座位 / 讨论室 · 查看与管理']].map(([key,title,desc])=>`<button class="reservation-service" data-reservation="${key}"><span class="reservation-symbol">${icon((key==='fb'?'room':{seat:'seat',room:'room',sports:'sports',bus:'bus',records:'bookings'}[key])||'calendar')}</span><span><b>${title}</b><small>${desc}</small></span><span class="arrow">›</span></button>`).join('')+'</div>';screen.querySelectorAll('[data-reservation]').forEach(b=>b.onclick=()=>send('reservationService',{service:b.dataset.reservation}));}
 else if(route==='/settings')renderSettings(screen);
 else if(route==='/campusMaps')renderCampusMaps(screen);
 else if(route==='/signCode')screen.innerHTML=back+`<form id="codeForm"><label for="codeValue">签到码</label><input id="codeValue" autocomplete="off" maxlength="20" required value="${escape(draft)}" placeholder="请输入签到码" style="margin:12px 0"><button class="close" ${busy?'disabled':''}>${busy?'正在提交…':'提交签到'}</button></form>`;
 else if(route==='/course')screen.innerHTML=(page.loading?'<p class="load-note">正在加载…</p>':'')+attendanceOverview(page)+list.map(attendanceCard).join('')+(!page.loading&&!list.length?'<div class="empty-state"><h2>暂无签到记录</h2><p>暂时没有课程记录</p></div>':'');
 else if(route==='/leaveApplication')renderLeaveForm(screen);
 else if(route==='/leaveCourse')renderLeaveCourses(screen);
 else if(route==='/course/sessions'){
  const q=page.query||{},names=['待确认','已出勤','缺勤','已批准请假','不计入'];
  screen.innerHTML='<button class="return" id="backRecords">‹ 全部课程</button>'+`<p class="session-title">${escape(q.moduleCode||'课程')} · 出勤明细</p>${page.courseTitle?`<h2 style="font-size:16px;font-weight:500;line-height:1.5;margin:0 0 18px">${escape(page.courseTitle)}</h2>`:''}<div class="record-filters"><label>教学组<select id="groupFilter"><option value="">全部教学组</option>${(page.groups||[]).map(g=>`<option value="${escape(g.name)}" ${q.moduleTypeGroup===g.name?'selected':''}>${escape(g.name)}</option>`).join('')}</select></label><label>出勤状态<select id="statusFilter"><option value="">全部状态</option>${names.map((n,i)=>`<option value="${i}" ${String(q.status)===String(i)?'selected':''}>${n}</option>`).join('')}</select></label><label class="date-filter">上课日期<input type="date" id="dateFilter" value="${escape(q.date==='Time'?'':q.date||'')}"></label></div>`+list.map(c=>`<article class="session"><div class="session-head"><h3>${escape(c.moduleTypeGroup||q.moduleCode)}</h3><span class="badge ${Number(c.status)===1?'present':Number(c.status)===2?'absent':''}">${escape(names[Number(c.status)]||c.statusName||'待确认')}</span></div><p class="session-date">${escape(c.date)}</p><div class="session-foot"><span>${Number(c.status)===1?'签到于 '+escape(c.signTime||'—'):''}</span><span>${escape(({1:'扫码签到',2:'Code 签到',3:'教师确认',6:'未签到',7:'未签到'})[c.signWay]||'')}</span></div></article>`).join('')+(page.loading?'<p class="load-note">正在读取明细…</p>':!list.length?'<div class="empty-state"><h2>没有匹配的记录</h2><p>试试调整筛选条件</p></div>':!page.finished?'<button class="action" id="moreSessions" style="width:100%">加载更多</button>':'<p class="load-note">已显示全部记录</p>');
 }
 else if(route==='/leave')screen.innerHTML='<button class="action" id="applyLeave" style="width:100%;margin-bottom:20px">＋ 新建请假申请</button>'+(page.loading?'<p class="load-note">正在读取请假记录…</p>':'')+list.map((c,i)=>`<button class="card" data-leave="${i}" style="margin-bottom:12px"><div class="card-top"><span>${escape(c.leaveOdd)}</span><span>${Number(c.status)===2?'已完成':'待处理'}</span></div><h3>${escape(c.startDate)} 至 ${escape(c.endDate)}</h3><p>创建于 ${escape(c.createTime)}</p></button>`).join('')+(!page.loading&&!list.length?`<div class="empty-state"><div class="empty-symbol">${icon('leave')}</div><h2>暂无请假申请</h2><p>提交的申请会显示在这里</p></div>`:'');
 else if(route==='/signCodeSuccess')renderSignResult(screen,true);
 else if(route==='/signCodeFail')renderSignResult(screen,false);
 else screen.innerHTML=back+'<p>正在加载…</p>';
 const backButton=document.getElementById('backHome');if(backButton)backButton.onclick=()=>{settingsOpen=false;navigate('/home','home');};
 const form=document.getElementById('codeForm');if(form){document.getElementById('codeValue').oninput=e=>draft=e.target.value;form.onsubmit=e=>{e.preventDefault();if(busy||!draft.trim())return;busy=true;send('submitCode',{code:draft.trim()});render();};}
 document.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>send('recordDetail',{index:Number(b.dataset.record)}));
 document.querySelectorAll('[data-leave]').forEach(b=>b.onclick=()=>send('leaveDetail',{index:Number(b.dataset.leave)}));
 const apply=document.getElementById('applyLeave');if(apply)apply.onclick=()=>send('applyLeave');
 const retry=document.getElementById('retryCode');if(retry)retry.onclick=()=>{if(page.signMethod==='scan')send('retryScan');else send('code');};
 const recordsBack=document.getElementById('backRecords');if(recordsBack)recordsBack.onclick=()=>navigate('/course','records');
 const more=document.getElementById('moreSessions');if(more)more.onclick=()=>send('moreSessions');
 for(const [id,field] of [['groupFilter','group'],['statusFilter','status'],['dateFilter','date']]){const input=document.getElementById(id);if(input)input.onchange=()=>send('filterSessions',{field,value:input.value});}
}
window.addEventListener('message',e=>{if(e.source===parent&&e.data&&Number.isInteger(e.data.navIndex)&&e.data.navIndex>=0&&e.data.navIndex<4){document.querySelectorAll('nav button')[e.data.navIndex].click();return;}if(e.source!==parent||!e.data||!e.data.amsUiData)return;const data=e.data.amsUiData;if(data.refreshClock){clockMinute='';refreshClock();return;}if(data.insets){for(const key of ['top','bottom'])document.documentElement.style.setProperty('--system-'+key,Math.max(0,Number(data.insets[key])||0)+'px');if(!data.route)return;}if(data.appearance){applyAppearance(data.appearance,data.dark);if(!data.route)return;}if(data.keepAlive){settingsData.keepAlive=Object.assign({},settingsData.keepAlive,data.keepAlive);renderKeepAlive();if(!data.route)return;}if(data.account!==undefined)settingsData.account=data.account;if(data.theme)applyTheme(data.theme);
 if(data.notification){if(data.codeUnavailable){busy=false;render();}toast(data.notification);return;}
 if(data.resetCache){for(const key of Object.keys(screens))delete screens[key];days=[];ready=false;return;}
 if(data.prefetched){for(const [route,snapshot] of Object.entries(data.prefetched))screens[route]=snapshot;return;}
 if(page.route!==data.route)busy=false;page=data;screens[data.route]=data;if(data.days){days=data.days;ready=data.ready;}
 document.getElementById('leaveBtn').hidden=!data.leave;
 const focused=document.activeElement;
 if(focused&&['INPUT','TEXTAREA','SELECT'].includes(focused.tagName)&&['/leaveApplication','/signCode'].includes(data.route)&&!data.submitting){focused.addEventListener('blur',()=>render(),{once:true});return;}
 render();});
document.getElementById('scanBtn').onclick=scan;
document.getElementById('xjCodeBtn').onclick=()=>send('xjCode');
document.getElementById('hhtCodeBtn').onclick=()=>send('hhtCode');
document.getElementById('settingsBtn').onclick=()=>{settingsOpen=true;render();};
document.getElementById('codeBtn').onclick=()=>send('code');document.getElementById('records').onclick=()=>navigate('/course','records');document.getElementById('leaveBtn').onclick=()=>navigate('/leave','leave');
document.querySelector('nav button').onclick=()=>navigate('/home','home');document.getElementById('today').onclick=()=>{followToday=true;render();};document.getElementById('close').onclick=closeSheet;document.getElementById('sheet').addEventListener('cancel',e=>{e.preventDefault();closeSheet();});let clockMinute='';const refreshClock=()=>{const now=new Date(),key=[now.getFullYear(),now.getMonth(),now.getDate(),now.getHours(),now.getMinutes()].join('-');if(key!==clockMinute&&page.route==='/home'&&!document.getElementById('sheet').open){render();clockMinute=key;}};setInterval(refreshClock,1000);window.addEventListener('pageshow',()=>{clockMinute='';refreshClock();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){clockMinute='';refreshClock();}});render();send('ready');
'''

script += """
new MutationObserver(()=>{
 const nav=document.querySelector('nav');
 const next=JSON.stringify({visible:!nav.hidden&&!document.querySelector('dialog[open]'),index:Array.from(nav.querySelectorAll('button')).findIndex(b=>b.classList.contains('active'))});
 if(next!==nativeNavState){nativeNavState=next;send('nativeNavigation',JSON.parse(next));}
}).observe(document.getElementById('sheet'),{attributes:true,attributeFilter:['open']});
"""
map_images = {key: 'data:'+mime+';base64,'+base64.b64encode((root/'maps'/file).read_bytes()).decode('ascii') for key,file,mime in [('tc','tc.jpg','image/jpeg'),('sip','sip.png','image/png')]}
map_script = Path('work/managed-campus-maps.js').read_text(encoding='utf-8').replace('const campusMapImages={};', 'const campusMapImages='+json.dumps(map_images)+';')
script = script.replace('function render(){', map_script+'\nfunction render(){')
script = script.replace('function render(){', Path('work/managed-leave-child.js').read_text(encoding='utf-8')+'\nfunction render(){')
# REMIND-001 course reminder: settings section, per-course mute in the detail sheet, native state messages.
def must_replace(text, old, new):
    assert text.count(old) == 1, old[:80]
    return text.replace(old, new)
script = must_replace(script, '\nconst scrollPositions={};', '\n'+Path('work/managed-course-reminder-child.js').read_text(encoding='utf-8')+'const scrollPositions={};')
script = must_replace(script, '<section class="form-section keepalive-section" id="keepAliveSection" hidden></section>', '<button class="settings-row reminder-entry" id="courseReminderEntry" hidden></button><section class="form-section keepalive-section" id="keepAliveSection" hidden></section>')
# REMIND-SETTINGS-001 (D-021): the reminder page is a sub-route of settings (like campus maps) with its own back steps.
script = must_replace(script, "const route=reservationsOpen?'/reservations':mapsOpen?'/campusMaps':", "const route=reservationsOpen?'/reservations':reminderOpen?'/courseReminder':mapsOpen?'/campusMaps':")
script = must_replace(script, "classList.toggle('settings-layout',route==='/settings')", "classList.toggle('settings-layout',route==='/settings'||route==='/courseReminder')")
script = must_replace(script, "route==='/campusMaps'?'校园地图':", "route==='/courseReminder'?'课程提醒':route==='/campusMaps'?'校园地图':")
script = must_replace(script, "else if(route==='/campusMaps')renderCampusMaps(screen);", "else if(route==='/courseReminder')renderCourseReminderPage(screen);\n else if(route==='/campusMaps')renderCampusMaps(screen);")
script = must_replace(script, "if(mapsOpen){mapsOpen=false;render();return true;}", "if(reminderOpen){reminderBack();return true;}if(mapsOpen){mapsOpen=false;render();return true;}")
script = must_replace(script, "function navigate(route,action){reservationsOpen=false;mapsOpen=false;settingsOpen=false;", "function navigate(route,action){reservationsOpen=false;mapsOpen=false;settingsOpen=false;reminderOpen=false;")
script = must_replace(script, "document.getElementById('settingsBtn').onclick=()=>{settingsOpen=true;render();};", "document.getElementById('settingsBtn').onclick=()=>{settingsOpen=true;reminderOpen=false;render();};")
script = must_replace(script, "renderKeepAlive();document.getElementById('creatorEmail')", "renderKeepAlive();renderCourseReminder();document.getElementById('creatorEmail')")
script = must_replace(script, "<dt>教学组</dt><dd>${escape(c.moduleTypeGroup||'—')}</dd></dl>`);}", "<dt>教学组</dt><dd>${escape(c.moduleTypeGroup||'—')}</dd></dl>${courseReminderDetail(c)}`);bindCourseReminderDetail();}")
script = must_replace(script, ":'尚未读取';", ":'尚未读取';if(valid&&typeof page==='object'&&page&&page.fromCache)document.getElementById('count').textContent+=' · 正在更新';")
script = must_replace(script, "renderKeepAlive();if(!data.route)return;}", "renderKeepAlive();if(!data.route)return;}if(data.courseReminder){courseReminder=Object.assign({},courseReminder,data.courseReminder);renderCourseReminder();maybeAskCourseReminder();if(!data.route)return;}")
script = must_replace(script, "if(data.days){days=data.days;ready=data.ready;}", "if(data.days){days=data.days;ready=data.ready;}setTimeout(maybeAskCourseReminder,0);")
body = body.replace('</nav>', '<button id="reservationsBtn"><svg><use href="#calendar"/></svg>预约</button></nav>')
script += "\ndocument.getElementById('reservationsBtn').onclick=()=>{reservationsOpen=true;settingsOpen=false;mapsOpen=false;reminderOpen=false;render();};"
style += 'header{align-items:center!important}.settings-button{display:grid;place-items:center;flex:none;padding:0;line-height:1;align-self:center}.xj-code-button{margin-left:auto;margin-right:8px}.xj-code-button svg{display:block}.xj-code-button svg{width:22px;height:22px}.reservation-services{display:grid;gap:12px;padding-top:8px}.reservation-service{display:flex;align-items:center;gap:14px;width:100%;padding:20px 16px;text-align:left;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:18px}.reservation-service>span:nth-child(2){flex:1}.reservation-service b{display:block;font-size:17px;font-weight:500}.reservation-service small{display:block;margin-top:6px;font-size:12px;color:var(--pencil)}.reservation-symbol svg{width:28px;height:28px}'
html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'body{background:var(--paper)}.week{grid-template-columns:repeat(3,1fr)}.day b{font-size:16px}.app{max-width:none}.destination b{overflow-wrap:anywhere}nav{max-width:none;width:min(calc(100% - 48px),400px);grid-template-columns:repeat(4,1fr)}</style>'+body+'<script>'+script+'</script></html>'
installer = r'''
(function(){
 if(location.protocol!=='https:'||location.hostname!=='ams.xjtlu.edu.cn'||location.pathname.indexOf('/studenth5/')!==0||window.__amsModernInstalled)return;
 window.__amsModernInstalled=true;

 let frame=null,last='',router=null,leaveEnabled=false,cachedDays=[],header=null,account='',preloadAt=0,preloading=false,previousRoute='',codeSubmitting=false,codeTimer=null;
 window.__amsRefreshClock=()=>{if(frame)frame.contentWindow.postMessage({amsUiData:{refreshClock:true}},'*');};
 window.__amsSetInsets=insets=>{window.__amsInsets=insets;if(frame)frame.contentWindow.postMessage({amsUiData:{insets}},'*');};
 window.__amsSetKeepAlive=state=>{window.__amsKeepAlive=state;if(frame)frame.contentWindow.postMessage({amsUiData:{keepAlive:state}},'*');};
 window.__amsSetAppearance=(mode,dark)=>{window.__amsAppearance={appearance:mode,dark:!!dark};document.documentElement.classList.toggle('ams-dark',!!dark);if(frame)frame.contentWindow.postMessage({amsUiData:window.__amsAppearance},'*');};
 const cache={},seenLists=new WeakMap();let lastPrefetched='';
 const owned=new Set(['/home','/course','/course/sessions','/leaveApplication','/leaveCourse','/leave','/signCode','/signCodeSuccess','/signCodeFail']);
 function publishCache(){const json=JSON.stringify(cache);if(frame&&json!==lastPrefetched){frame.contentWindow.postMessage({amsUiData:{prefetched:cache}},'*');lastPrefetched=json;}}
 function resetCache(){for(const key of Object.keys(cache))delete cache[key];cachedDays=[];lastPrefetched='';last='';preloadAt=0;if(frame)frame.contentWindow.postMessage({amsUiData:{resetCache:true}},'*');}
 function prefetch(){
  let user;try{user=JSON.parse(sessionStorage.getItem('amsuserInfo')||'null');}catch(e){return;}
  if(!user||!user.token)return;
  if(account!==user.token){account=user.token;resetCache();}
  if(preloading||Date.now()-preloadAt<60000)return;preloading=true;preloadAt=Date.now();
  const query=new URLSearchParams({academicYear:user.academicYear||'',semester:user.semester||'',moudleTitle:'',type:'1'});
  const token=account;
  const read=(route,url,pick)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);return fetch('https://ams.xjtlu.edu.cn/xjtlu'+url,{credentials:'same-origin',headers:{'X-Token':token},signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('read failed');return r.json();}).then(result=>{if(account!==token)return;if(result.code===401){resetCache();preloadAt=Date.now();return;}if(result.code!==0)throw new Error('school rejected read');cache[route]={route,list:pick(result.data),overallAttendance:route==='/course'?result.data.comprehensiveAttendance:undefined,overallWarning:route==='/course'?result.data.thresholdFlag:undefined,loading:false,leave:leaveEnabled,days:cachedDays,ready:cachedDays.length>0};publishCache();refresh();}).catch(()=>{}).finally(()=>clearTimeout(timer));};
  const requests=[read('/course','/stuapi/my-module/list?'+query,d=>d.vos||[])];
  if(leaveEnabled)requests.push(read('/leave','/stuapi/xjtlu-leave/getLeaveList',d=>d.leaveList||[]));
  Promise.all(requests).finally(()=>{preloading=false;});
 }
 const skin=document.createElement('style');skin.textContent='html.ams-owned body>*:not(#ams-managed-ui):not(style):not(script){visibility:hidden!important}html.ams-skin body{background:#f5f6f8!important;color:#18233a!important;font-family:system-ui!important}html.ams-skin main{background:#f5f6f8!important;padding:18px!important;padding-top:60px!important}html.ams-skin .van-cell,html.ams-skin .item-box{border-radius:12px!important;margin-bottom:8px!important}html.ams-skin .van-button--info,html.ams-skin .van-button--primary{background:#172e61!important;border-color:#172e61!important;border-radius:12px!important}html.ams-skin .van-field__control{font-size:16px!important}html.ams-skin .tabBar{display:none!important}#ams-secondary-head{position:fixed;top:0;left:0;right:0;z-index:2000;background:#f5f6f8;padding:14px;color:#172e61;border:0;text-align:left;font-size:16px}';skin.textContent+='html.ams-dark.ams-owned,html.ams-dark.ams-owned body,html.ams-dark.ams-skin body,html.ams-dark.ams-skin main,html.ams-dark #ams-secondary-head{background:#15191f!important;color:#e4e9f0!important}';document.head.appendChild(skin);
 window.__amsHandleBack=()=>!!(frame&&frame.style.display!=='none'&&frame.contentWindow.__amsHandleBack&&frame.contentWindow.__amsHandleBack());
 let vueRoot=null;
 function components(){const seen=new Set(),queue=[],all=[];if(vueRoot&&!vueRoot._isDestroyed)queue.push(vueRoot);else for(const el of document.querySelectorAll('*'))if(el.__vue__)queue.push(el.__vue__);while(queue.length){const vm=queue.pop();if(!vm||seen.has(vm)||vm._isDestroyed)continue;seen.add(vm);all.push(vm);if(vm.$parent)queue.push(vm.$parent);if(vm.$children)queue.push(...vm.$children);}const found=all.find(v=>v.$router&&v.$route);if(found)vueRoot=found.$root||found;return all;}
 function refresh(){const all=components();const root=all.find(v=>v.$router&&v.$route);if(!root)return;const route=root.$route.path;
  if(route!==previousRoute){if(previousRoute==='/signCode'){codeSubmitting=false;if(codeTimer!==null){clearTimeout(codeTimer);codeTimer=null;}}if(route==='/signCodeSuccess'||(route==='/leave'&&previousRoute.startsWith('/leaveApplication')))preloadAt=0;previousRoute=route;}
  let currentUser=null;try{currentUser=JSON.parse(sessionStorage.getItem('amsuserInfo')||'null');}catch(e){}
  if((currentUser&&currentUser.token||'')!==account){account=currentUser&&currentUser.token||'';resetCache();}
  if(root.$router!==router){router=root.$router;if(typeof router.afterEach==='function')router.afterEach(()=>{refresh();requestAnimationFrame(refresh);});}
  const active=all.find(v=>v._inactive!==true&&v.$options&&v.$options.name===({'/home':'home','/course':'course','/course/sessions':'courseSessions','/leave':'leave','/leaveApplication':'leaveApplication','/leaveCourse':'leaveCourse','/signCode':'signCode','/signCodeSuccess':'signCodeSuccess','/signCodeFail':'signCodeFail'}[route]));
  if(route==='/course'&&active&&cache[route]&&!active.loading&&!active.finished&&!active.list.length){active.list=cache[route].list;active.finished=true;}
  if(route==='/leave'&&active&&cache[route]&&!active.leaveDatas)active.leaveDatas={leaveList:cache[route].list};
  if(route==='/course'&&active&&!active.loading&&!active.finished&&Array.isArray(active.list)&&!active.list.length&&typeof active.onLoad==='function'){active.loading=true;active.onLoad();}
  if(route==='/course/sessions'&&active&&!active.loading&&!active.finished&&!active.list.length&&typeof active.onLoad==='function'){active.loading=true;active.onLoad();}
  if(!owned.has(route)){document.documentElement.classList.remove('ams-owned');if(frame)frame.style.display='none';last='';if(route.startsWith('/leave')||route.startsWith('/course')){document.documentElement.classList.add('ams-skin');if(!header){header=document.createElement('button');header.id='ams-secondary-head';header.textContent='‹ 返回';header.onclick=()=>router.back();document.body.appendChild(header);}}else{document.documentElement.classList.remove('ams-skin');if(header){header.remove();header=null;}}return;}
  document.documentElement.classList.add('ams-owned');document.documentElement.classList.remove('ams-skin');if(header){header.remove();header=null;}
  if(!frame){frame=document.createElement('iframe');frame.id='ams-managed-ui';frame.title='AMS 校园助手';frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:3000;background:transparent';frame.srcdoc=(window.__amsNativeNavigation?HTML.replace('</style>','nav{display:none!important}</style>'):HTML).replace('<html lang="zh-CN">','<html lang="zh-CN"'+(window.__amsAppearance&&window.__amsAppearance.dark?' class="ams-dark"':'')+'>');document.body.appendChild(frame);}frame.style.display='block';
  const tab=all.find(v=>Array.isArray(v.tabDatas));if(tab)leaveEnabled=tab.tabDatas.some(t=>t.path==='/leave');const schedule=all.find(v=>Array.isArray(v.scheduleList)&&typeof v.getStudentTimetable==='function');if(route==='/home'&&schedule&&schedule.scheduleList.some(d=>d.date&&d.date.trim()!=='-'&&Array.isArray(d.timetableVoList)))cachedDays=schedule.scheduleList.slice(0,3);
  const data={route,overallAttendance:cache['/course']&&cache['/course'].overallAttendance,overallWarning:cache['/course']&&cache['/course'].overallWarning,signMethod:window.__amsSignMethod||'code',account:currentUser&&(currentUser.account||currentUser.userName||currentUser.username||currentUser.studentCode||currentUser.name)||'账号信息暂不可用',theme:localStorage.getItem('amsTheme')||'blue',days:cachedDays,ready:cachedDays.length>0,leave:leaveEnabled,list:route.startsWith('/course')?(active&&active.list||[]):route==='/leave'?(active&&active.leaveDatas&&active.leaveDatas.leaveList||[]):[],loading:!active||(route.startsWith('/course')&&!!active.loading)||(route==='/leave'&&!active.leaveDatas),reason:active&&active.reason,signInfo:route==='/signCodeSuccess'&&active?active.signInfo:null,query:active&&active.queryForm,groups:route==='/course/sessions'&&active?active.grouplist:[],finished:active&&active.finished,courseTitle:route==='/course/sessions'&&active?((cache['/course']&&cache['/course'].list||[]).find(c=>c.moduleCode===active.queryForm.moduleCode)||{}).moudleTitle:''};
  if(route==='/course'||route==='/leave'){
   if(!data.loading&&active){const signature=JSON.stringify(data.list);if(seenLists.get(active)!==signature){seenLists.set(active,signature);cache[route]=Object.assign({},data);publishCache();}}
   if(cache[route]){data.list=cache[route].list;data.loading=false;}
  }
  Object.assign(data,leaveSnapshot(active,route));
  const json=JSON.stringify(data);if(json!==last){frame.contentWindow.postMessage({amsUiData:data},'*');last=json;}
  prefetch();
 }
 window.addEventListener('message',e=>{if(!frame||e.source!==frame.contentWindow||!e.data||!router)return;const action=e.data.amsUiAction;const all=components(),path=router.currentRoute.path;const active=all.find(v=>v._inactive!==true&&v.$options&&v.$options.name===({'/course':'course','/course/sessions':'courseSessions','/leave':'leave','/leaveApplication':'leaveApplication','/leaveCourse':'leaveCourse','/signCode':'signCode'}[path]));
 if(handleLeave(action,e.data,active,path)){refresh();return;}
 switch(action){case 'ready':if(window.__amsInsets)window.__amsSetInsets(window.__amsInsets);if(window.__amsAppearance)window.__amsSetAppearance(window.__amsAppearance.appearance,window.__amsAppearance.dark);if(window.__amsKeepAlive)window.__amsSetKeepAlive(window.__amsKeepAlive);last='';lastPrefetched='';publishCache();refresh();break;case 'supportCreator':if(path==='/home'||owned.has(path))location.href='ams-local://supportcreator';break;case 'checkUpdate':if(path==='/home'||owned.has(path))location.href='ams-local://checkupdate';break;case 'contact':if(path==='/home'||owned.has(path))location.href='ams-local://email';break;case 'appearance':if(['system','light','dark'].includes(e.data.appearance))location.href='ams-local://appearance?mode='+e.data.appearance;break;case 'theme':if(['blue','green','dusk','teal','sage','smoke','graphite','rose','wheat'].includes(e.data.theme)){localStorage.setItem('amsTheme',e.data.theme);location.href='ams-local://theme?key='+e.data.theme;}break;case 'logout':resetCache();sessionStorage.clear();localStorage.removeItem('amsuserInfo');location.href='ams-local://logout';break;case 'retryScan':window.__amsSignMethod='scan';router.push('/home');setTimeout(()=>{if(router.currentRoute.path==='/home')location.href='ams-local://scan';},150);break;case 'scan':if(path==='/home'){window.__amsSignMethod='scan';location.href='ams-local://scan';}break;case 'home':router.push('/home');break;case 'code':window.__amsSignMethod='code';router.push('/signCode');break;case 'records':router.push('/course');break;case 'leave':if(leaveEnabled)router.push('/leave');break;case 'submitCode':if(path==='/signCode'&&!codeSubmitting&&typeof e.data.code==='string'&&e.data.code.trim().length>0&&e.data.code.length<=20){if(!active||typeof active.onSubmit!=='function'){frame.contentWindow.postMessage({amsUiData:{codeUnavailable:true,notification:'签到页面尚未就绪，请稍后重试'}},'*');break;}active.code=e.data.code;codeSubmitting=true;try{active.onSubmit();}catch(error){notify('提交发生异常，请先查看签到记录，避免重复提交');}if(codeSubmitting)codeTimer=setTimeout(()=>{if(codeSubmitting&&router.currentRoute.path==='/signCode')notify('暂未收到签到结果，请先查看签到记录，避免重复提交');},20000);}break;case 'recordDetail':if(path==='/course'&&active){const item=(cache[path]?cache[path].list:active.list)[e.data.index];if(item)active.goDetail(item);}break;case 'leaveDetail':if(path==='/leave'&&active){const item=(cache[path]?cache[path].list:active.leaveDatas&&active.leaveDatas.leaveList||[])[e.data.index];if(item)active.goDetail(item);}break;case 'applyLeave':if(path==='/leave'&&leaveEnabled)router.push('/leaveApplication');break;
 case 'moreSessions':if(path==='/course/sessions'&&active&&!active.loading&&!active.finished){active.loading=true;active.onLoad();}break;
 case 'filterSessions':if(path==='/course/sessions'&&active&&!active.loading&&typeof e.data.value==='string'){
  if(e.data.field==='group'){const group=active.grouplist.find(g=>g.name===e.data.value);if(group||e.data.value===''){active.loading=true;if(group)active.onChangegroup(group);else active.onGroupCancel();}}
  else if(e.data.field==='status'){const status=active.statuslist.find(s=>String(s.value)===e.data.value);if(status||e.data.value===''){active.loading=true;if(status)active.onChangestatus(status);else active.onStatusCancel();}}
  else if(e.data.field==='date'){if(!e.data.value){active.loading=true;active.cancelDate();}else if(/^\d{4}-\d{2}-\d{2}$/.test(e.data.value)){active.loading=true;active.confirmDate(new Date(e.data.value+'T12:00:00'));}}
 }break;}refresh();});
 setInterval(refresh,200);refresh();

})();
'''
installer = installer.replace(' let vueRoot=null;', Path('work/managed-leave-parent.js').read_text(encoding='utf-8')+'\n let vueRoot=null;').replace('HTML',json.dumps(html,ensure_ascii=False))
installer = installer.replace("switch(action){", "switch(action){case 'nativeNavigation':if(window.__amsNativeNavigation)location.href='ams-local://navstate?visible='+e.data.visible+'&index='+e.data.index;break;case 'xjCode':if(path==='/home')location.href='ams-local://xjcode';break;case 'hhtCode':if(path==='/home')location.href='ams-local://hhtcode';break;case 'keepAlive':if(window.__amsNativeNavigation&&typeof e.data.enabled==='boolean'&&[3,5,7].includes(e.data.days))location.href='ams-local://keepalive?enabled='+e.data.enabled+'&days='+e.data.days;break;case 'reservationService':if(['seat','room','sports','bus','records','seatRecords','roomRecords'].includes(e.data.service))location.href='ams-local://reservations?service='+e.data.service;break;")
# REMIND-001: export the normalized timetable to native and relay reminder settings.
installer = must_replace(installer, ' let vueRoot=null;', Path('work/managed-course-reminder-parent.js').read_text(encoding='utf-8')+'\n let vueRoot=null;')
# Timetable cache: show the account's cached days until the school answers, then store that answer per date.
installer = must_replace(installer, ' let vueRoot=null;', Path('work/managed-timetable-cache.js').read_text(encoding='utf-8')+'\n let vueRoot=null;')
installer = must_replace(installer, 'cachedDays=schedule.scheduleList.slice(0,3);', "{cachedDays=schedule.scheduleList.slice(0,3);timetableFromCache=false;storeTimetable(cachedDays);}else if(route==='/home'&&!cachedDays.length){const c=cachedHomeDays();if(c.length){cachedDays=c;timetableFromCache=true;}}publishSchedule();")
installer = must_replace(installer, 'days:cachedDays,ready:cachedDays.length>0,leave:leaveEnabled', 'days:cachedDays,ready:cachedDays.length>0,fromCache:timetableFromCache,leave:leaveEnabled')
installer = must_replace(installer, "cachedDays=[];lastPrefetched='';", "cachedDays=[];timetableFromCache=false;lastSchedule='';lastPrefetched='';")
installer = must_replace(installer, "case 'logout':resetCache();", "case 'logout':clearTimetableCaches();resetCache();")
installer = must_replace(installer, "if(window.__amsKeepAlive)window.__amsSetKeepAlive(window.__amsKeepAlive);", "if(window.__amsKeepAlive)window.__amsSetKeepAlive(window.__amsKeepAlive);if(window.__amsCourseReminder)window.__amsSetCourseReminder(window.__amsCourseReminder);")
installer = must_replace(installer, "switch(action){", "switch(action){case 'courseReminder':if(window.__amsCourseReminderBridge&&e.data.change&&typeof e.data.change==='object'){const change=JSON.stringify(e.data.change);if(change.length<=2000)location.href='ams-local://coursereminder?change='+encodeURIComponent(change);}break;")
(root/'ams-modern-ui.js').write_text(installer,encoding='utf-8')
Path('work/live-ui.html').write_text(html,encoding='utf-8')



nav_body=re.search(r'<nav.*?</nav>',body,re.S).group(0)
symbols=re.search(r'<svg style=.*?</svg>',body,re.S).group(0)
nav_script="document.querySelectorAll('nav button').forEach((b,i)=>b.onclick=()=>location.href='ams-nav://select?index='+i);"
(root/'navigation.html').write_text('<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>'+style+'html,body{margin:0;background:transparent!important;overflow:hidden}nav{width:min(calc(100% - 48px),400px);grid-template-columns:repeat(4,1fr);bottom:12px}nav,html.ams-dark nav{box-shadow:0 2px 8px var(--nav-shadow),inset 0 1px 0 var(--nav-edge)}</style>'+symbols+nav_body+'<script>'+nav_script+'</script>',encoding='utf-8')

(root/'sports-theme.css').write_text(Path('work/sports-theme.css').read_text(encoding='utf-8'),encoding='utf-8')
(root/'sports-ui.js').write_text(Path('work/sports-ui.js').read_text(encoding='utf-8'),encoding='utf-8')
(root/'school-session.js').write_text(Path('work/android-school-session.js').read_text(encoding='utf-8'),encoding='utf-8')
(root/'school-session-restore.html').write_text(Path('work/android-school-session-restore.html').read_text(encoding='utf-8'),encoding='utf-8')
