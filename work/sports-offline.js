/* Offline-only simulator. Never contains production requests or payment deep links. */
(()=>{
  const data=JSON.parse(document.getElementById('demo-data').textContent),screen=document.getElementById('screen');
  const fresh=()=>JSON.parse(JSON.stringify(data.orders));
  const state={route:'court',project:0,date:0,type:0,mode:'field',selected:[],agree:false,quantity:1,ticketType:0,venue:'TC',logged:true,scenario:'normal',filter:'全部',ticketFilter:'全部',orders:fresh(),active:'DEMO-1001',payment:'',next:2000,club:{room:'活动室 A',start:'18:00',end:'19:00',name:''},history:[]};
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const price=n=>'¥'+Number(n).toFixed(2),project=()=>data.projects[state.project],day=()=>data.days[state.date];
  const button=(label,action,extra='',disabled=false)=>`<button class="btn btn-sm btn-default" data-action="${action}" ${extra} ${disabled?'disabled':''}>${esc(label)}</button>`;
  const modal=(title,html)=>{document.getElementById('modal-title').textContent=title;document.getElementById('modal-body').innerHTML=html;document.getElementById('modal').showModal()};
  let toastTimer;const toast=text=>{const e=document.getElementById('toast');e.textContent=text;e.className='show';clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.className='',2200)};
  const active=()=>state.orders.find(o=>o.id===state.active);
  function slot(c,t){return {key:`${c}-${t}`,court:`${c+1}号场`,time:data.times[t],price:project().price+(t>=8?5:0),disabled:(c*7+t+state.date*3+state.project+state.type+(state.venue==='SIP'?2:0))%6===0}}
  const chosen=()=>state.selected.map(k=>{const [c,t]=k.split('-').map(Number);return slot(c,t)});
  const total=()=>state.mode==='field'?chosen().reduce((v,s)=>v+s.price,0):state.mode==='ticket'?data.ticketProducts[state.ticketType].price*state.quantity:80;
  const canSubmit=()=>state.agree&&(state.mode==='field'?state.selected.length>0:state.mode==='ticket'?state.quantity>=1:state.club.name.trim()&&state.club.end>state.club.start);
  function resetSelection(){state.selected=[];state.agree=false}
  function navigate(route,remember=true){
    if(state.route==='pay'&&route!=='pay'&&!confirm('离开演示支付页？不会发生真实付款。'))return;
    if(remember&&route!==state.route)state.history.push(state.route);
    state.route=route;render();window.scrollTo(0,0);
  }
  const footer=()=>'<footer class="footer">AMS 学生独立开发 · 非学校官方应用<br>仅供布局评审，演示数据不能用于预约或入场</footer>';
  function review(){return `<div class="order-wrapper"><div class="order-outer"><h2 class="order-title">订单信息</h2><div class="order-info"><span class="order-info-left">运动项目</span><span class="order-info-right">${esc(project().name)}</span></div><div class="order-info"><span class="order-info-left">选择日期</span><span class="order-info-right">${day().full} · ${state.venue}</span></div><div class="order-choose"><div class="order-choose-title">${state.mode==='field'?'场次选择':state.mode==='ticket'?'票种选择':'包场申请'}</div>${state.mode==='field'?(chosen().length?chosen().map(s=>`<div class="item"><span class="field-name">${s.court}</span><span class="field-time">${s.time}—${String(Number(s.time.slice(0,2))+1).padStart(2,'0')}:00</span><span class="field-price">${price(s.price)}</span></div>`).join(''):'<p class="ams-sports-hint">请选择可用场地与时段</p>'):state.mode==='ticket'?`<div class="item">${esc(data.ticketProducts[state.ticketType].name)} × ${state.quantity}</div>`:`<div class="item">${esc(state.club.room)} · ${esc(state.club.start)}—${esc(state.club.end)}</div>`}<div class="price-info"><span class="price-info-left">演示合计</span><span class="price-info-right">${price(total())}</span></div></div><div class="order-protocol"><label><input type="checkbox" id="agreement" ${state.agree?'checked':''}> 我已阅读演示说明</label> <button class="protocol-title" data-action="protocol">《离线演示说明》</button></div><div class="btn-box"><button class="btn btn-primary btn-xlarge" data-action="submit" ${canSubmit()?'':'disabled'}>${state.mode==='club'?'生成演示申请':'生成演示订单'}</button></div><p class="ams-sports-hint">仅在当前页面内生成虚构记录，不向学校提交。</p></div></div>`}
  function field(){return `<div class="field-type-box">${['标准场地','其他场地'].map((n,i)=>`<button class="item ${i===state.type?'checked':''}" data-action="type" data-value="${i}">${n}</button>`).join('')}</div><div class="type-sign-box"><div class="item"><i class="list-style"></i><span class="name">可选</span></div><div class="item"><i class="list-style checked">✓</i><span class="name">已选</span></div><div class="item"><i class="list-style disabled"></i><span class="name">不可选</span></div></div><div class="field-wrapper"><div class="time-line">${data.times.map(t=>`<div class="item">${t}</div>`).join('')}</div><div class="field-outer">${Array.from({length:6},(_,c)=>`<div class="field-box"><div class="item-name">${c+1}号场</div>${data.times.map((_,t)=>{const s=slot(c,t);return `<button class="item ${s.disabled?'disabled':''} ${state.selected.includes(s.key)?'checked':''}" data-action="slot" data-value="${s.key}" ${s.disabled?'disabled':''}><span>${price(s.price)}</span><i class="iconzhengque" aria-hidden="true">✓</i></button>`}).join('')}</div>`).join('')}</div></div>`}
  function ticketsToBuy(){return `<div class="ticket-box">${data.ticketProducts.map((t,i)=>`<article class="item"><div class="ticket-info"><span class="ticket-name">${esc(t.name)}</span><span class="ticket-time">${esc(t.period)}</span></div><button class="ticket-tips">查看使用说明<span class="tips-detail">${esc(t.description)}（离线示例，不代表学校真实规则）</span></button><div class="buy-ticket"><span class="price">${price(t.price)}</span><button class="btn btn-sm ${state.ticketType===i?'btn-confirm':'btn-default'}" data-action="ticketType" data-value="${i}">${state.ticketType===i?'已选择':'选择票种'}</button></div></article>`).join('')}<div class="buy-ticket"><label for="quantity">购买数量</label><input id="quantity" type="number" min="1" max="5" value="${state.quantity}"></div></div>`}
  function club(){return `<div class="club-form"><h2>活动包场 · 演示表单</h2><label>活动室<select id="club-room">${['活动室 A','活动室 B'].map(n=>`<option ${state.club.room===n?'selected':''}>${n}</option>`).join('')}</select></label><label>开始时间<input id="club-start" type="time" value="${state.club.start}"></label><label>结束时间<input id="club-end" type="time" value="${state.club.end}"></label><label>活动名称<input id="club-name" maxlength="60" placeholder="例如：演示社团训练" value="${esc(state.club.name)}"></label><p class="ams-sports-hint">学校真实包场可能涉及社团身份、房间规则、审批及更多字段；此处只演示填写布局。</p></div>`}
  function court(){
    let status='',statusKind='',statusRole='status';
    if(state.scenario==='loading'){status='<h2>正在加载演示场地</h2><div class="skeleton" aria-hidden="true"></div><button data-action="normal">展示加载完成</button>';statusKind='loading';}
    else if(state.scenario==='error'){status='<h2>暂时无法连接</h2><p>这是人为设置的离线错误状态，当前数据不可用于预约。</p><button data-action="normal">重试演示</button>';statusKind='error';statusRole='alert';}
    else if(state.scenario==='empty'){status='<h2>当前没有可预约场地</h2><p>可尝试其他日期、项目或校区。</p>';statusKind='empty';}
    else if(!state.logged){status='<h2>请先登录体育中心</h2><p>离线版无需输入账号、密码或验证码。</p><button data-action="login">进入演示登录状态</button>';statusKind='login';}

    const venueHeader=`<div class="header"><div class="header-inner"><div class="head-left"><div class="logo"><span class="logo-en">XJTLU</span><div class="logo-zh"><select id="venue" aria-label="校区"><option value="TC" ${state.venue==='TC'?'selected':''}>Sports Centre(TC)</option><option value="SIP" ${state.venue==='SIP'?'selected':''}>Sports Centre(SIP)</option></select></div></div></div></div>`;
    if(status){
      const statePage=`<main class="main padding-top"><div class="el-row"><div class="el-col"><section class="status-firstscreen" data-state="${statusKind}" role="${statusRole}" aria-live="${statusRole==='alert'?'assertive':'polite'}" ${statusKind==='loading'?'aria-busy="true"':''}><div class="empty-state">${status}</div></section></div></div></main>`;
      return `<div class="court">${venueHeader}</div>${statePage}${footer()}</div>`;
    }

    const projects=`<div class="service-top"><div class="service-top-inner"><div class="service-top-box">${data.projects.map((p,i)=>`<button class="item ${state.project===i?'checked':''}" data-action="project" data-value="${i}"><span class="service-name">${esc(p.name)}</span></button>`).join('')}</div></div></div>`;
    const body=`${state.mode==='field'?field():state.mode==='ticket'?ticketsToBuy():club()}${review()}`;
    const controls=`<main class="main padding-top"><div class="el-row"><div class="el-col"><div class="date-box"><div class="radio-groups-box"><div class="el-radio-group">${[['field','订场'],['ticket','购票'],['club','活动包场']].map(([m,n])=>`<label class="el-radio-button"><input class="el-radio-button__orig-radio" type="radio" name="mode" value="${m}" ${m===state.mode?'checked':''}><span class="el-radio-button__inner">${n}</span></label>`).join('')}</div></div><div class="date-select-box"><div class="item-box">${data.days.map((d,i)=>`<button class="item ${i===state.date?'checked':''}" data-action="date" data-value="${i}"><span class="day">${d.week}</span><span class="date">${d.short}</span></button>`).join('')}</div></div></div>${body}</div></div></main>`;
    return `<div class="court">${venueHeader}${projects}</div>${controls}${footer()}</div>`;
  }
  function orders(){const items=state.orders.filter(o=>state.filter==='全部'||o.status===state.filter);return `<div class="list-page main-body"><div class="order-container"><h2 class="order-container-title">我的订单</h2><div class="order-tab-bar">${['全部','待支付','已支付','已取消','已退款'].map(f=>`<button class="order-tab-item ${state.filter===f?'active':''}" data-action="filter" data-value="${f}">${f}</button>`).join('')}</div>${items.length?items.map(o=>orderCard(o)).join(''):'<div class="empty-state">没有此状态的演示订单</div>'}</div></div>${footer()}`}
  function orderCard(o,detail=false){return `<article class="order-box"><div class="order-info-head"><span class="order-title">${esc(o.id)} · 演示订单</span><span class="order-state">${esc(o.status)}</span></div><div class="order-info-body"><div class="order-detail"><h3 class="order-name">${esc(o.project)}</h3><p class="order-time">${esc(o.date)} · ${esc(o.location)}</p><p class="order-time">${esc(o.description)}</p><p class="order-price">演示金额 <span class="price">${price(o.total)}</span></p></div><div class="order-operate">${o.status==='待支付'?button('前往演示支付','pay',`data-id="${o.id}"`)+button('取消演示订单','cancel',`data-id="${o.id}"`):o.status==='已支付'?button('查看演示凭证','code',`data-id="${o.id}"`)+button('模拟退款','refund',`data-id="${o.id}"`):''}${!detail?button('订单详情','detail',`data-id="${o.id}"`):''}</div></div></article>`}
  function detail(){const o=active();return `<div class="detail-page main-body"><div class="order-container"><div class="order-top-info"><h2 class="order-container-title">订单详情</h2></div>${orderCard(o,true)}<div class="order-bottom-info"><p class="order-info-line">全部内容为虚构示例，状态变化只发生在本地内存。</p><p class="order-info-line">退款资格、金额及入场凭证在正式服务中由体育中心服务器决定。</p></div></div></div>${footer()}`}
  function ticketPage(){const list=data.tickets.filter(t=>state.ticketFilter==='全部'||t.status===state.ticketFilter);return `<div class="main-body"><div class="ticket-page"><div class="top-page-info"><h2>我的票券</h2></div><div class="order-tab-bar">${['全部','可使用','已使用','已过期'].map(f=>`<button class="order-tab-item ${state.ticketFilter===f?'active':''}" data-action="ticketFilter" data-value="${f}">${f}</button>`).join('')}</div><div class="ticket-container">${list.map(t=>`<article class="ticket-box"><h3 class="ticket-title">${esc(t.name)} <span class="status-label">${t.status}</span></h3><div class="ticket-info"><p>${t.id}</p><p>${t.period} · ${t.venue}</p><button class="view-code" data-action="code" data-id="${t.id}">查看演示入馆码 →</button></div></article>`).join('')||'<div class="empty-state">没有此状态的演示票券</div>'}</div></div></div>${footer()}`}
  function pay(){const o=active();if(o.status!=='待支付')return detail();return `<div class="main"><div class="main-area"><div class="order-main-info"><h2 class="order-title">确认与支付</h2><div class="order-total">${esc(o.id)} · 虚构订单</div></div><table><tbody><tr><th>项目</th><td>${esc(o.project)}</td></tr><tr><th>预约内容</th><td>${esc(o.description)}</td></tr><tr><th>演示金额</th><td>${price(o.total)}</td></tr></tbody></table><div class="order-main-info pay-line-short"><h3 class="order-title">优惠券</h3></div><div class="coupon-box"><span class="ams-sports-hint">无可用演示优惠券。正式优惠由服务器计算。</span></div><div class="order-main-info pay-line"><h3 class="order-title">选择支付方式</h3></div><div class="coupon-box">${[['wechat','微信支付'],['alipay','支付宝支付']].map(([v,n])=>`<button class="select-item select-item-small select-item-pay ${state.payment===v?'checked':''}" data-action="method" data-value="${v}" aria-pressed="${state.payment===v}">${n}</button>`).join('')}</div><div class="submit-box"><div class="should-pay">应付演示金额 ${price(o.total)}</div><button class="btn btn-primary btn-xlarge" data-action="launch" ${state.payment?'':'disabled'}>演示支付应用跳转说明</button></div><p class="pay-disclaimer">此页面不会唤起微信、支付宝或进行付款。请使用下面的模拟状态按钮评审返回行为。</p><div class="pay-demo-controls">${button('模拟支付成功','success','',!state.payment)}${button('模拟取消 / 返回','pending')}${button('模拟状态查询失败','payError')}</div></div></div>${footer()}`}
  function render(){screen.innerHTML=state.route==='court'?court():state.route==='orders'?orders():state.route==='tickets'?ticketPage():state.route==='detail'?detail():pay();document.getElementById('page-title').textContent=({court:'体育馆预约',orders:'体育馆订单',tickets:'运动票券',detail:'订单详情',pay:'确认与支付'})[state.route];document.querySelectorAll('.native-tabs button').forEach(b=>{b.setAttribute('aria-current',(b.dataset.route===state.route||(state.route==='detail'&&b.dataset.route==='orders'))?'page':'false')});document.getElementById('scenario').value=state.scenario;}
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action],[data-route]');if(!b||b.disabled)return;
    if(b.dataset.route){navigate(b.dataset.route);return}
    const a=b.dataset.action,v=b.dataset.value,id=b.dataset.id;
    if(a==='dismiss'){document.getElementById('modal').close();return}
    if(a==='help'){modal('离线评审说明','<p>这是当前 Android 0.14.1(73) 体育馆布局的本地参考，使用生产 CSS 与辅助脚本，业务处理为独立演示模拟器。</p><p>所有价格、库存、用户、订单、票券、日期与支付状态均为虚构。没有真正的预约码，也没有网络请求；刷新后还原。</p>');return}
    if(a==='back'){const previous=state.history.pop();if(previous)navigate(previous,false);else toast('已在离线演示首页');return}
    if(a==='project'){state.project=Number(v);resetSelection()}
    else if(a==='date'){state.date=Number(v);resetSelection()}
    else if(a==='type'){state.type=Number(v);resetSelection()}
    else if(a==='slot'){state.selected=state.selected.includes(v)?state.selected.filter(k=>k!==v):[...state.selected,v]}
    else if(a==='ticketType'){state.ticketType=Number(v);state.agree=false}
    else if(a==='filter'){state.filter=v}
    else if(a==='ticketFilter'){state.ticketFilter=v}
    else if(a==='login'){state.logged=!state.logged;resetSelection();state.route='court';toast(state.logged?'已进入演示登录状态':'已退出演示登录状态')}
    else if(a==='reset'){state.orders=fresh();state.next=2000;state.route='court';state.scenario='normal';state.logged=true;resetSelection();toast('示例数据已恢复')}
    else if(a==='normal'){state.scenario='normal'}
    else if(a==='protocol'){modal('离线演示说明','<p>此处仅用于演示协议入口、弹窗排版与主动勾选。不是学校使用协议，不产生预约、支付或法律承诺。</p><p>正式版本必须展示体育中心返回的完整协议，并保持用户主动选择及服务端校验。</p>');return}
    else if(a==='detail'||a==='pay'){state.active=id;if(a==='pay')state.payment='';navigate(a==='detail'?'detail':'pay');return}
    else if(a==='code'){modal('演示凭证 · 不可入场',`<div class="demo-code">DEMO ONLY<small>INVALID · 非二维码 · 不能扫码入场</small></div><p>${esc(id)} 是虚构编号。此版没有任何可用的二维码载荷。</p>`);return}
    else if(a==='cancel'||a==='refund'){if(confirm('确认修改这条虚构演示记录？正式资格与金额需要服务器验证。'))state.orders.find(o=>o.id===id).status=a==='cancel'?'已取消':'已退款'}
    else if(a==='submit'){
      if(!canSubmit())return;
      const id='DEMO-'+state.next++;state.orders.unshift({id,project:project().name,date:day().full,location:state.venue,status:'待支付',total:total(),description:state.mode==='field'?chosen().map(s=>s.court+' '+s.time).join('；'):state.mode==='ticket'?data.ticketProducts[state.ticketType].name+' × '+state.quantity:'演示包场 '+state.club.room+' '+state.club.name});state.active=id;resetSelection();state.payment='';navigate('pay');return;
    }
    else if(a==='method'){state.payment=v}
    else if(a==='launch'){modal('演示支付跳转','<p>正式网页会根据移动浏览器环境生成微信 / 支付宝 H5 支付流程。Android 保留支付窗口和表单，通过限定应用打开支付链接。</p><p>离线版不生成支付参数，不打开真实应用。返回应用后也不能直接视为支付成功，需要查询订单状态。</p>');return}
    else if(a==='success'){if(!state.payment)return;active().status='已支付';state.route='detail';toast('本地演示状态已设为已支付；未发生付款')}
    else if(a==='pending'){toast('订单仍为待支付；未假定付款成功');return}
    else if(a==='payError'){modal('演示：状态查询失败','<p>保留原订单与待支付状态，允许返回“我的订单”继续查看。不重新创建订单，不自动重复付款。</p>');return}
    render();
  });
  document.addEventListener('change',e=>{
    const n=e.target;
    if(n.name==='mode'){state.mode=n.value;resetSelection();render()}
    else if(n.id==='venue'){state.venue=n.value;resetSelection();render()}
    else if(n.id==='agreement'){state.agree=n.checked;document.querySelector('[data-action=submit]').disabled=!canSubmit()}
    else if(n.id==='quantity'){state.quantity=Math.max(1,Math.min(5,Number(n.value)||1));render()}
    else if(n.id==='scenario'){state.scenario=n.value;resetSelection();state.route='court';render()}
    else if(n.id.startsWith('club-')){state.club[n.id.slice(5)]=n.value;const submit=document.querySelector('[data-action=submit]');if(submit)submit.disabled=!canSubmit()}
    else if(n.id==='palette'||n.id==='appearance')theme();
  });
  function mix(a,b,r){const pa=a.match(/\w\w/g).map(x=>parseInt(x,16)),pb=b.match(/\w\w/g).map(x=>parseInt(x,16));return pa.map((x,i)=>Math.round(x*(1-r)+pb[i]*r).toString(16).padStart(2,'0')).join('')}
  function luminance(hex){const [r,g,b]=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b}
  function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
  function accessibleAccent(accent,backgrounds){if(backgrounds.every(bg=>contrast(accent,bg)>=4.5))return accent;for(let step=1;step<=100;step++){const candidate=mix(accent,'000000',step/100);if(backgrounds.every(bg=>contrast(candidate,bg)>=4.5))return candidate}return '000000'}
  function theme(){const i=Number(document.getElementById('palette').value)||0,d=document.getElementById('appearance').value==='dark',p=data.palettes[i],surface=d?'202630':'fcfdfe';const colors={paper:d?'15191f':'f5f6f8',surface,input:d?'191f27':'f5f7fa',ink:d?'e7ecf4':'17233a',muted:d?'a4afbf':'596476',line:d?'343d49':'e2e8f0',primary:p.primary,accent:d?mix(p.accent,'ffffff',.55):p.accent,wash:d?mix(surface,p.primary,.3):p.wash};Object.entries(colors).forEach(([k,v])=>document.documentElement.style.setProperty('--campus-'+k,'#'+v));document.documentElement.style.setProperty('--sports-muted',d?'#a4afbf':'#596476');document.documentElement.style.setProperty('--sports-accent','#'+accessibleAccent(colors.accent,[colors.paper,surface,colors.input,colors.wash]))}
  document.getElementById('palette').innerHTML=data.palettes.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('');theme();render();
})();
