function renderReviewReminderScreen(screen){
 const r=page.demo.reviewReminder||{},p=r.prefs||{},phase={before:'课前',during:'课中',after:'已下课'}[r.state?.phase]||'尚未加载';
 const status=r.pending?'已安排服务器切换，请返回桌面或锁屏等待约 15–30 秒。':r.pushStatus==='apns-accepted'?'Apple 推送服务已接受更新；请在手机上查看实际显示。':r.pushReady?'云端灵动岛推送已就绪。':'尚未就绪：先在课程提醒设置中开启灵动岛与云端处理，并允许系统实时活动。';
 screen.innerHTML+=`<section class="form-section"><h2>灵动岛与锁屏演示</h2><p>SOE106TC · Programming with C++<br>DE-2001</p><p class="form-help">这是演示课程，使用正式提醒布局与系统实时活动，不会提交学校。服务器会根据当前时间调整课程起止时间。</p><button class="form-submit" id="reviewReminderSettings">打开课程提醒设置</button><p role="status" aria-live="polite">当前：${escape(phase)}<br>${escape(status)}${r.error?'<br>'+escape(r.error):''}</p><div class="theme-options">${[['before','课前'],['during','课中'],['after','下课']].map(([value,label])=>`<button data-review-phase="${value}" aria-pressed="${r.state?.phase===value}">${label}</button>`).join('')}</div><button class="form-submit" id="reviewReminderDelayed"${!r.pushReady||!p.enabled||!p.island?' disabled':''}>服务器延迟切到课中</button><p class="form-help">点上方按钮后返回桌面或锁屏，观察服务器推送更新。推送被接受不代表手机已收到；请以实际显示为准。</p><button class="reminder-secondary" id="reviewNotification">测试课前通知（5 秒）</button><button class="reminder-secondary" id="reviewReminderRefresh">刷新服务器状态</button></section>`;
 screen.querySelector('#reviewReminderSettings').onclick=()=>send('reviewReminderSettings');
 screen.querySelectorAll('[data-review-phase]').forEach(b=>b.onclick=()=>send('reviewReminderPhase',{phase:b.dataset.reviewPhase,delaySeconds:0}));
 screen.querySelector('#reviewReminderDelayed').onclick=()=>send('reviewReminderPhase',{phase:'during',delaySeconds:15});
 screen.querySelector('#reviewNotification').onclick=()=>send('reviewNotification');
 screen.querySelector('#reviewReminderRefresh').onclick=()=>send('reviewReminderRefresh');
}
function renderReviewSportsScreen(screen){
 const rows=page.demo.state.sports||[];document.querySelector('h1').textContent='体育馆演示';
 screen.innerHTML+=`<section class="form-section"><h2>场馆预约</h2><p class="form-help">以下场馆、订单及支付均为演示，不会预约真实场馆或产生扣款。</p><form id="reviewSportsBook"><label class="field">场馆<select name="venue"><option value="badminton">羽毛球馆</option><option value="basketball">篮球馆</option><option value="fitness">健身房</option></select></label><label class="field">日期<input type="date" name="date" value="${escape(page.demo.today)}" required></label><div class="date-pair"><label class="field">开始<input type="time" name="start" value="10:00" required></label><label class="field">结束<input type="time" name="end" value="11:00" required></label></div><button class="form-submit">创建演示订单</button></form></section><h3>演示订单与票券</h3>${rows.map(r=>`<section class="form-section"><h2>${escape(r.name)}</h2><p>${escape(r.date)} ${escape(r.start)}–${escape(r.end)}</p><p>${r.cancelled?'已取消':r.paid?'演示支付完成':'待演示支付'}</p>${r.cancelled?'':r.paid?`<button class="form-submit" data-sports-ticket="${escape(r.id)}">查看演示票券</button>`:`<button class="form-submit" data-sports-pay="${escape(r.id)}">完成演示支付（不扣款）</button>`}${r.cancelled?'':`<button class="logout-button" data-sports-cancel="${escape(r.id)}">取消演示订单</button>`}</section>`).join('')||'<p class="empty-state">暂无演示订单</p>'}`;
 screen.querySelector('form').onsubmit=e=>{e.preventDefault();send('reviewSportsBook',Object.fromEntries(new FormData(e.target)));};
 screen.querySelectorAll('[data-sports-pay]').forEach(b=>b.onclick=()=>send('reviewSportsPay',{id:b.dataset.sportsPay}));
 screen.querySelectorAll('[data-sports-cancel]').forEach(b=>b.onclick=()=>send('reviewSportsCancel',{id:b.dataset.sportsCancel}));
 screen.querySelectorAll('[data-sports-ticket]').forEach(b=>b.onclick=()=>send('ticket',{payload:rows.find(r=>r.id===b.dataset.sportsTicket).ticket}));
}
const reviewOriginalRender=render;
render=function(){
 reviewOriginalRender();
 if(page.route==='/home'&&!settingsOpen&&!reservationsOpen&&!mapsOpen&&!reminderOpen){
  const home=document.getElementById('homeScreen');if(home&&!home.querySelector('#reviewReminderOpen')){
   home.insertAdjacentHTML('beforeend','<section class="form-section"><button class="form-submit" id="reviewReminderOpen">课程提醒与灵动岛演示</button></section>');
   home.querySelector('#reviewReminderOpen').onclick=()=>send('reviewReminderOpen');
  }
 }
};
window.addEventListener('message',e=>{
 if(e.source!==parent||!e.data?.amsUiData?.reviewReminderSettings)return;
 requestAnimationFrame(()=>{settingsOpen=true;reservationsOpen=false;reminderOpen=true;reminderView='main';render();});
});
