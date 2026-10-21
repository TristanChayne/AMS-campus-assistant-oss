(function () {
  'use strict';
  if (location.protocol !== 'https:' || location.hostname !== 'seatbookings.xjtlu.edu.cn' || window.__campusSeatInstalled) return;
  window.__campusSeatInstalled = true;
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) { viewport = document.createElement('meta'); viewport.name = 'viewport'; document.head.appendChild(viewport); }
  viewport.content = 'width=device-width,initial-scale=1';
  const style = document.createElement('style');
  style.textContent = `
    #campus-seat-panel{font:15px/1.5 system-ui,sans-serif;color:var(--campus-ink,#182b45);background:var(--campus-paper,#f5f7fb);padding:16px;border-radius:16px;margin:12px 0;box-sizing:border-box}
    #campus-seat-panel *{box-sizing:border-box}#campus-seat-panel button{min-height:48px;border:1px solid var(--campus-line,#dce5ef);border-radius:12px;background:var(--campus-surface,#fff);color:var(--campus-accent,#254e9b);padding:10px;font:inherit;touch-action:manipulation}
    #campus-seat-panel,#campus-seat-panel *,#campus-floor-toggle,.campus-seat-managed .seatOperation input{font-family:Arial,'Noto Sans CJK SC','Microsoft YaHei',sans-serif!important}
    #campus-seat-panel .seat-empty{grid-column:1/-1;font-size:14px;color:var(--campus-muted,#52647b);padding:12px 0}
    #campus-seat-panel h3{margin:0 0 10px;font-size:20px}#campus-seat-panel .seat-controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    #campus-seat-panel input{width:100%;padding:12px;border:1px solid var(--campus-line,#dce5ef);border-radius:12px;font:inherit;margin-bottom:12px}
    #campus-seat-panel .seat-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    #campus-seat-panel .seat-summary{margin:0 0 12px;color:var(--campus-muted,#52647b);font-size:13px}
    #campus-seat-panel button[data-state="空闲"]{background:#eef8f1;border-color:#cce7d4;color:#245e39}
    .campus-seat-managed{background:var(--campus-paper,#f5f7fb)!important;font-family:system-ui,sans-serif!important}
    .campus-seat-managed .home-header,.campus-seat-managed .container > .wrapper,.campus-seat-managed .footer,.campus-seat-managed .seat > .day_info,.campus-seat-managed .seat > .content,.campus-seat-managed .seat > .my-tabs,.campus-seat-managed .status_wrapper{display:none!important}
    .campus-seat-managed .navigation{border:0!important;box-shadow:none!important}
    .campus-seat-managed .wrap:before,.campus-seat-managed .wrap:after{display:none!important}
    .campus-seat-managed .seatOperation{background:var(--campus-surface,#fff)!important;border:0!important;border-radius:14px;padding:14px!important;margin:12px 0!important;box-sizing:border-box}
    .campus-seat-managed .seatOperation .el-date-editor,.campus-seat-managed .seatOperation .time-container,.campus-seat-managed .seatOperation .el-select{width:100%!important;margin:0!important}
    .campus-seat-managed .seatOperation input{font-family:system-ui,sans-serif!important;color:var(--campus-ink,#182b45)!important}
    #campus-seat-panel .seat-list button{display:grid;gap:4px;font-size:14px;overflow-wrap:anywhere}#campus-seat-panel small{font-size:12px;color:var(--campus-muted,#5c6c82)}
    #campus-seat-panel .seat-detail{margin-top:14px;padding-top:14px;border-top:1px solid var(--campus-line,#dce5ef)}
    #campus-seat-panel canvas{display:block;width:100%;border-radius:12px;background:#fff;margin:10px 0}
    #campus-seat-panel{background:var(--campus-surface,#fff);padding:18px 14px;border-radius:18px;margin-top:12px;box-shadow:0 2px 12px #172e6108}
    #campus-seat-panel h3{font-size:22px;letter-spacing:-.4px;color:var(--campus-accent,#172e61)}
    #campus-seat-panel .seat-controls{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;background:var(--campus-input,#f1f3f7);border-radius:12px}
    #campus-seat-panel .seat-controls button{border:0;background:transparent;min-height:42px;padding:8px;font-size:14px;color:var(--campus-muted,#667287)}
    #campus-seat-panel .seat-controls button[aria-pressed="true"]{background:var(--campus-surface,#fff);color:var(--campus-accent,#172e61);box-shadow:0 1px 5px #172e6112}
    #campus-seat-panel .filter-toggle{margin:0 0 12px;min-height:36px;padding:6px 12px;font-size:13px;border-radius:20px}
    #campus-seat-panel .seat-list button{min-height:72px;border-color:var(--campus-line,#e7ebf0);border-radius:10px}
    #campus-seat-panel .seat-list button[aria-pressed="true"]{background:var(--campus-wash,#eaf0ff)!important;box-shadow:inset 0 0 0 1px var(--campus-accent,#254e9b)}
    #campus-seat-panel .booking-toggle{width:100%;background:var(--campus-primary,#172e61);color:white;border:0;font-weight:600;margin-top:12px}
    #campus-seat-panel .booking-toggle:disabled{background:var(--campus-input,#e6e9ee);color:var(--campus-muted,#7d8795)}
    #campus-seat-panel .seat-detail{background:var(--campus-input,#f6f8fc);padding:14px;border:0;border-radius:14px;margin-bottom:14px}
    #campus-seat-panel .map-legend{font-size:12px;color:var(--campus-muted,#617087);margin:6px 0 12px}
    #campus-seat-panel .steps{font-size:13px;color:var(--campus-muted,#68768b);margin:0 0 14px}
    #campus-seat-panel .selection-feedback{display:block;padding:8px 0;color:var(--campus-accent,#254e9b);font-size:14px}
    #campus-seat-panel .availability{display:flex;gap:8px;margin:12px 0}
    #campus-seat-panel .availability button{flex:1;min-height:40px;margin:0;border-radius:10px;font-size:13px;padding:6px}
    #campus-seat-panel .availability button[aria-pressed="true"]{background:var(--campus-primary,#172e61);color:white;border-color:var(--campus-primary,#172e61)}
    .campus-reservation-dialog.el-dialog{width:calc(100% - 24px)!important;max-width:520px!important;margin:4vh auto!important;max-height:88vh!important;max-height:88dvh!important;display:flex!important;flex-direction:column!important;border-radius:18px!important;overflow:hidden!important;font-family:Arial,'Noto Sans CJK SC','Microsoft YaHei',sans-serif!important}
    .campus-reservation-dialog .el-dialog__header{flex:none;padding:18px 20px!important;border-bottom:1px solid var(--campus-line,#eef1f5)}
    .campus-reservation-dialog .el-dialog__title{font-size:19px!important;font-weight:600;color:var(--campus-accent,#172e61)!important;display:block!important;white-space:normal!important;overflow-wrap:anywhere!important;padding-right:28px!important;line-height:1.4!important}
    .campus-reservation-dialog .el-dialog__body{min-height:0!important;flex:1 1 auto!important;overflow:auto!important;padding:16px!important;overscroll-behavior:contain;box-sizing:border-box}
    .campus-reservation-dialog .el-dialog__footer{flex:none!important;padding:12px 16px!important;background:var(--campus-surface,#fff)!important;border-top:1px solid var(--campus-line,#e7ebf0);padding-bottom:max(12px,env(safe-area-inset-bottom))!important}
    .campus-reservation-dialog .dialog-footer{display:flex!important;gap:10px!important;flex-wrap:wrap}
    .campus-reservation-dialog .dialog-footer .el-button{flex:1!important;min-height:46px!important;margin:0!important;border-radius:12px!important;font-size:15px!important}
    .campus-reservation-dialog .dialog-footer .el-button--primary{background:var(--campus-primary,#172e61)!important;border-color:var(--campus-primary,#172e61)!important;color:white!important}
    .campus-reservation-dialog .data-box,.campus-reservation-dialog .data-box > div{width:100%!important;box-sizing:border-box!important}
    .campus-reservation-dialog .research-title > div{float:none!important;width:auto!important;line-height:1.7!important}
    .campus-reservation-dialog .el-form-item__label{float:none!important;display:block!important;text-align:left!important;width:auto!important;line-height:24px!important}
    .campus-reservation-dialog .el-form-item__content{margin-left:0!important;line-height:32px!important}
    .campus-reservation-dialog .el-select{max-width:100%!important}.campus-reservation-dialog .showTime{overflow:auto!important;max-width:100%!important}
    .campus-seat-managed .seatOperation:before{content:'1 · 选择日期和预约时段';display:block;width:100%;font-size:14px;font-weight:600;color:var(--campus-accent,#172e61);margin-bottom:8px}
    .campus-hide-map{display:none!important}
    #campus-floor-toggle{display:none}
    #campus-seat-home{font:15px/1.6 system-ui,sans-serif;padding:18px;color:var(--campus-ink,#182b45);background:var(--campus-paper,#f5f7fb);border-radius:16px;margin:12px 0}#campus-seat-home h2{margin:0 0 8px;font-size:22px}#campus-seat-home p{margin:0;color:var(--campus-muted,#5c6c82)}
    .campus-seat-managed,.campus-seat-managed .container{background:var(--campus-paper,#f5f6f8)!important}
    .campus-seat-managed .wrap{box-sizing:border-box!important}
    #campus-seat-home{padding:0 4px;margin:8px 0 16px;background:transparent;border-radius:0}
    #campus-seat-home h2{display:none}#campus-seat-home p{font:14px/1.6 Arial,'Noto Sans CJK SC','Microsoft YaHei',sans-serif;color:var(--campus-muted,#69758a)}
    .campus-seat-managed .navigation{box-sizing:border-box!important;border-radius:14px;overflow:hidden}
    @media(max-width:600px){.campus-seat-managed .wrap{margin:0 16px!important}}
    .campus-seat-landing .wrap > :not(.navigation):not(#campus-floor-toggle):not(#campus-seat-home){display:none!important}
    @media(max-width:600px){body{min-width:0!important}.container{width:100%!important;min-width:0!important}.wrap{display:block!important;width:auto!important;margin:0 12px!important}.seat{width:100%!important;min-width:0!important;padding:0!important}.navigation{width:100%!important;max-height:250px;overflow:auto}.navigation.campus-folded{display:none!important}.navigation .el-menu{width:100%!important}.seatOperation{display:flex!important;flex-wrap:wrap!important;gap:8px}.seatOperation input{font-size:16px!important}#campus-floor-toggle{display:block;min-height:48px;width:100%;border:1px solid var(--campus-line,#dce5ef);border-radius:12px;background:var(--campus-surface,#fff);color:var(--campus-accent,#254e9b);font:16px system-ui;margin:10px 0;padding:12px}}
  `;
  document.head.appendChild(style);
  let area, panel, selected = '', signature = '', full = true, mapCenter = {x:.5,y:.5}, mapView = null, gesture = null, availableOnly = true, route = '', checkingAt = 0, timeContext = '';
  const status = el => {
    if (el.classList.contains('noopenlook')) return '仅供查看';
    if (el.classList.contains('gray')) return '不可预约';
    if (el.classList.contains('yellow')) return '已预约';
    if (el.classList.contains('yellowGreen')) return '部分空闲';
    if (el.classList.contains('green')) return '空闲';
    // Do not infer availability from a default class or colour.
    return '查看学校状态';
  };
  const nodes = () => area ? Array.from(area.querySelectorAll('.draggable[title]')).filter(n => n.style.display !== 'none') : [];
  function draw() {
    const item = nodes().find(n => n.title === selected), image = area && area.querySelector('.grid > img');
    const detail = panel.querySelector('.seat-detail');
    detail.hidden = !item;
    if (!item) return;
    panel.querySelector('.seat-title').textContent = selected + ' · ' + status(item);
    panel.querySelector('.booking-toggle').disabled = !!checkingAt || !['空闲','部分空闲'].includes(status(item));
    if(!['空闲','部分空闲'].includes(status(item)))panel.querySelector('.selection-feedback').textContent='此座位'+status(item)+'，请选择其他座位或更换时段。';
    drawMap();
  }
  function drawMap() {
    const canvas=panel.querySelector('canvas'), image=area.querySelector('.grid > img'),notice=panel.querySelector('.seat-notice');
    if(!image || !image.complete || !image.naturalWidth){notice.textContent='楼层图正在加载，请稍候。';return;}
    const iw=image.naturalWidth,ih=image.naturalHeight;
    const sw=full?iw:Math.min(iw,Math.max(iw*.38,220)),sh=full?ih:Math.min(ih,Math.max(ih*.38,180));
    const sx=full?0:Math.max(0,Math.min(iw-sw,mapCenter.x*iw-sw/2)),sy=full?0:Math.max(0,Math.min(ih-sh,mapCenter.y*ih-sh/2));
    mapView={sx,sy,sw,sh,iw,ih};
    canvas.width=900;canvas.height=Math.round(900*sh/sw);canvas.style.touchAction=full?'pan-y':'none';
    const ctx=canvas.getContext('2d');ctx.drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    nodes().forEach(n=>{
      const state=status(n);if(availableOnly&&state!=='空闲'&&n.title!==selected)return;
      const x=(parseFloat(n.style.left)/100*iw-sx)/sw*canvas.width,y=(parseFloat(n.style.top)/100*ih-sy)/sh*canvas.height;
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>canvas.width||y>canvas.height)return;
      ctx.beginPath();ctx.arc(x,y,n.title===selected?12:full?6:9,0,Math.PI*2);ctx.fillStyle=n.title===selected?getComputedStyle(document.documentElement).getPropertyValue('--campus-primary').trim()||'#254e9b':state==='空闲'?'#30945a':state==='部分空闲'?'#d39728':'#9da6b3';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
      if(n.title===selected||(!full&&state==='空闲')){ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.lineWidth=5;const mapLabel=String(n.title).replace(/^[A-Z0-9]*F-(\d+)$/i,'$1');ctx.strokeText(mapLabel,x,Math.max(24,y-17));ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--campus-primary').trim()||'#254e9b';ctx.fillText(mapLabel,x,Math.max(24,y-17));}
    });
    notice.textContent=full?'全层空闲座位已显示。点击绿色座位选座，选中后可放大附近。':'已放大：拖动查看附近，轻点绿色座位可改选。';
    const toggle=panel.querySelector('.map-toggle');toggle.textContent=full?'放大所选座位附近':'查看所在楼层全图';toggle.disabled=full&&!selected;
  }
  function mapPick(clientX,clientY){
    if(!mapView)return;const canvas=panel.querySelector('canvas'),r=canvas.getBoundingClientRect(),v=mapView;
    const x=(clientX-r.left)/r.width*canvas.width,y=(clientY-r.top)/r.height*canvas.height;let nearest=null,distance=Infinity;
    nodes().filter(n=>status(n)==='空闲'||(!availableOnly&&status(n)==='部分空闲')).forEach(n=>{const px=(parseFloat(n.style.left)/100*v.iw-v.sx)/v.sw*canvas.width,py=(parseFloat(n.style.top)/100*v.ih-v.sy)/v.sh*canvas.height;if(px<0||py<0||px>canvas.width||py>canvas.height)return;const d=Math.hypot(px-x,py-y);if(d<distance){distance=d;nearest=n;}});
    if(nearest&&distance<22/r.width*canvas.width)select(nearest.title,true);
  }
  function bindMap(){
    const canvas=panel.querySelector('canvas');
    canvas.onpointerdown=e=>{if(gesture||checkingAt||!mapView)return;const r=canvas.getBoundingClientRect();gesture={id:e.pointerId,x:e.clientX,y:e.clientY,view:{...mapView},width:r.width,height:r.height,moved:false};canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=e=>{if(!gesture||gesture.id!==e.pointerId)return;const g=gesture,dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.hypot(dx,dy)>6)g.moved=true;if(!full&&g.moved){mapCenter.x=Math.max(g.view.sw/2,Math.min(g.view.iw-g.view.sw/2,g.view.sx+g.view.sw/2-dx/g.width*g.view.sw))/g.view.iw;mapCenter.y=Math.max(g.view.sh/2,Math.min(g.view.ih-g.view.sh/2,g.view.sy+g.view.sh/2-dy/g.height*g.view.sh))/g.view.ih;drawMap();}};
    canvas.onpointerup=e=>{if(!gesture||gesture.id!==e.pointerId)return;const moved=gesture.moved;gesture=null;if(e.cancelable)e.preventDefault();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!moved)mapPick(e.clientX,e.clientY);};
    canvas.onpointercancel=()=>{gesture=null;};
    canvas.onclick=e=>{e.preventDefault();e.stopPropagation();};
  }
  function select(name,fromMap=false){if(checkingAt)return;selected=name;list();panel.querySelector('.selection-feedback').textContent='已选择 '+name+'。已放大座位附近。可拖动改选，核对位置后点击“下一步：确认预约”。';if(!fromMap||full){const item=nodes().find(n=>n.title===name);full=false;mapCenter={x:parseFloat(item.style.left)/100,y:parseFloat(item.style.top)/100};}panel.querySelector('.overview').hidden=false;panel.querySelector('.list-view').hidden=true;panel.querySelector('.overview-toggle').setAttribute('aria-pressed','true');panel.querySelector('.list-toggle').setAttribute('aria-pressed','false');draw();drawMap();if(!fromMap)panel.querySelector('.overview').scrollIntoView({block:'nearest',behavior:'smooth'});}
  function booking(){
    const item=nodes().find(n=>n.title===selected), view=area.__vue__;
    if(checkingAt||!item||!['空闲','部分空闲'].includes(status(item)))return;
    const model=view&&Array.isArray(view.options)&&view.options.find(n=>n.devName===selected&&n.isShow!==false);
    if(model&&view.$parent&&typeof view.$parent.handleClickItem==='function'){
      checkingAt=Date.now();panel.querySelector('.booking-toggle').disabled=true;panel.querySelector('.booking-toggle').textContent='正在检查预约条件…';panel.querySelector('.selection-feedback').textContent='学校正在检查时段、权限和座位状态，请稍候。';
      try{view.$parent.handleClickItem(model);}catch(e){checkingAt=0;panel.querySelector('.booking-toggle').textContent='下一步：确认预约';panel.querySelector('.selection-feedback').textContent='未能打开确认面板，请重新加载后再试。';draw();}
    }
    else panel.querySelector('.selection-feedback').textContent='预约确认暂未就绪，请重新加载后再试。';
  }
  function adaptDialogs(){
    const view=area&&area.__vue__,parent=view&&view.$parent,policy=parent&&parent.$refs&&parent.$refs.needKnow;
    const dialogs=Array.from(document.querySelectorAll('.seat-form .el-dialog'));
    if(policy&&policy.$el)dialogs.push(...policy.$el.querySelectorAll('.el-dialog'));
    dialogs.forEach(dialog=>dialog.classList.add('campus-reservation-dialog'));
    const form=parent&&parent.$refs&&parent.$refs.seatForm;
    if(form&&form.$el){const primary=form.$el.querySelector('.dia-style .el-button--primary span');if(primary)primary.textContent='确认预约';const buttons=form.$el.querySelectorAll('.dia-style .dialog-footer .el-button:not(.el-button--primary) span');buttons.forEach(b=>b.textContent='返回选座');}
    if(!checkingAt||!panel)return;
    const opened=(form&&form.dialogVisible)||(policy&&policy.dialog);
    const message=document.querySelector('.el-message:not([style*="display: none"]) .el-message__content');
    if(opened||message||Date.now()-checkingAt>15000){checkingAt=0;panel.querySelector('.booking-toggle').textContent='下一步：确认预约';panel.querySelector('.selection-feedback').textContent=opened?'请在确认面板核对时段，再提交预约。':message?message.textContent:'学校暂未打开确认面板，请稍后重试。';draw();}
  }
  function list() {
    const query = panel.querySelector('input').value.trim().toLowerCase(), target = panel.querySelector('.seat-list');
    target.replaceChildren();
    const seats = nodes(), free = seats.filter(n => status(n) === '空闲').length;
    const floor=seats.length ? seats[0].title.split('-')[0] + ' · ' : '';
    const floorToggle=document.getElementById('campus-floor-toggle');if(floorToggle&&!document.querySelector('.navigation:not(.campus-folded)'))floorToggle.textContent=floor+'更换校区或楼层';
    panel.querySelector('.seat-summary').textContent = floor + free + ' 个空闲 / ' + seats.length + ' 个座位 · 当前所选时段';
    nodes().filter(n => (!availableOnly || status(n) === '空闲') && n.title.toLowerCase().includes(query)).forEach(n => {
      const button = document.createElement('button'); button.type = 'button';
      button.setAttribute('data-state',status(n));
      const name = document.createElement('span'); name.textContent = n.title;
      const state = document.createElement('small'); state.textContent = status(n);
      button.append(name, state); button.setAttribute('aria-pressed', String(n.title === selected));
      if (n.title === selected) button.style.borderColor = 'var(--campus-accent,#1767d7)';
      button.onclick = () => select(n.title);
      target.appendChild(button);
    });
    if (!target.childElementCount) {const empty=document.createElement('div');empty.className='seat-empty';empty.textContent = availableOnly ? '当前没有匹配的全程空闲座位。可更换时段，或切换全部查看状态。' : '没有匹配的座位，或学校数据尚未加载。';target.appendChild(empty);}
  }
  function refresh() {
    adaptDialogs();
    const navigation = document.querySelector('.wrap > .navigation');
    if (navigation && !document.getElementById('campus-floor-toggle')) {
      const toggle = document.createElement('button'); toggle.id = 'campus-floor-toggle'; toggle.textContent = '选择或更换校区、楼层';
      navigation.classList.add('campus-folded'); toggle.setAttribute('aria-expanded', 'false');
      toggle.onclick = () => { const folded = navigation.classList.contains('campus-folded'); navigation.classList.toggle('campus-folded', !folded); toggle.setAttribute('aria-expanded', String(folded));toggle.textContent=folded?'收起楼层列表':'选择或更换校区、楼层'; };
      navigation.before(toggle);
    }
    const next = document.querySelector('.seat-area');
    const wrap = document.querySelector('.wrap');
    if(wrap)document.body.classList.add('campus-seat-managed');
    if(next && route !== location.hash){route=location.hash;selected='';checkingAt=0;timeContext='';full=true;gesture=null;if(navigation)navigation.classList.add('campus-folded');const toggle=document.getElementById('campus-floor-toggle');if(toggle)toggle.setAttribute('aria-expanded','false');}
    if (!next) {
      if (panel) panel.remove(); panel = null; area = null; signature = '';
      // The first screen is the school home page, not a seat floor. Take it over too.
      if(wrap && navigation && (!location.hash || /^#\/?(?:ic\/home)?$/.test(location.hash))) {
        document.body.classList.add('campus-seat-landing');
        if(!document.getElementById('campus-seat-home')){
          const home=document.createElement('section');home.id='campus-seat-home';home.innerHTML='<h2>图书馆座位</h2><p>先选择校区和楼层，再选择日期、时段和座位。</p>';wrap.prepend(home);
          navigation.classList.remove('campus-folded');
          const toggle=document.getElementById('campus-floor-toggle');if(toggle)toggle.setAttribute('aria-expanded','true');
        }
      } else { document.body.classList.remove('campus-seat-landing');const home=document.getElementById('campus-seat-home');if(home)home.remove(); }
      return;
    }
    document.body.classList.remove('campus-seat-landing');const home=document.getElementById('campus-seat-home');if(home)home.remove();
    if (next !== area || !panel || !panel.isConnected) {
      if (panel) panel.remove(); area = next; selected = '';checkingAt=0; full = true;mapCenter={x:.5,y:.5};mapView=null; availableOnly=true;signature = '';
      panel = document.createElement('section'); panel.id = 'campus-seat-panel';
      panel.innerHTML = '<h3>2 · 选择座位</h3><p class="steps">选楼层与时段 → 查看座位位置 → 确认预约</p><p class="seat-summary" aria-live="polite"></p><div class="seat-controls"><button class="list-toggle" aria-pressed="true">座位列表</button><button class="overview-toggle" aria-pressed="false">在楼层图上选座</button></div><div class="availability"><button class="filter-toggle" aria-pressed="true">仅显示全程空闲</button><button class="all-toggle" aria-pressed="false">显示全部状态</button></div><p class="view-feedback" role="status" aria-live="polite">点击一个座位查看位置，再进入预约确认。</p><div class="seat-detail" hidden><strong class="seat-title"></strong><span class="selection-feedback" role="status" aria-live="polite"></span><button class="booking-toggle">下一步：确认预约</button></div><div class="overview" hidden><p class="map-legend">绿色 空闲 · 金色 部分空闲 · 灰色 不可选 · 蓝色 已选<br>点击座位查看位置，也可用列表按座位号选择。</p><button class="map-toggle">放大所选座位附近</button><canvas class="seat-map" aria-label="可拖动的楼层空闲座位地图"></canvas><small class="seat-notice" aria-live="polite"></small></div><div class="list-view"><input aria-label="查找座位号" placeholder="搜索座位号，如 024"><div class="seat-list"></div></div>';
      area.before(panel); area.classList.add('campus-hide-map');
      panel.querySelector('input').oninput = list;
      function filter(on){availableOnly=on;panel.querySelector('.filter-toggle').setAttribute('aria-pressed',String(on));panel.querySelector('.all-toggle').setAttribute('aria-pressed',String(!on));list();drawMap();panel.querySelector('.view-feedback').textContent=on?'现在仅显示所选时段全程空闲的座位。':'现在显示全部状态。部分空闲需在确认时选择可用时段。';}
      panel.querySelector('.filter-toggle').onclick=()=>filter(true);
      panel.querySelector('.all-toggle').onclick=()=>filter(false);
      panel.querySelector('.booking-toggle').onclick = booking;
      function changeView(on){panel.querySelector('.view-feedback').textContent=on?'已切换为楼层图。点击绿色座位查看位置。':'已切换为座位列表。可输入座位号搜索。';panel.querySelector('.overview').hidden=!on;panel.querySelector('.list-view').hidden=on;panel.querySelector('.overview-toggle').setAttribute('aria-pressed',String(on));panel.querySelector('.list-toggle').setAttribute('aria-pressed',String(!on));drawMap();}
      panel.querySelector('.overview-toggle').onclick=()=>changeView(true);
      panel.querySelector('.list-toggle').onclick=()=>changeView(false);
      panel.querySelector('.map-toggle').onclick = () => { if(full){const item=nodes().find(n=>n.title===selected);if(!item)return;mapCenter={x:parseFloat(item.style.left)/100,y:parseFloat(item.style.top)/100};}full = !full;drawMap(); };
      bindMap();
    }
    const image = area.querySelector('.grid > img');
    const school=area.__vue__&&area.__vue__.$parent;
    const nextContext=school?JSON.stringify([school.dateValue,school.timeValue]):'';
    if(timeContext&&timeContext!==nextContext){selected='';checkingAt=0;full=true;gesture=null;panel.querySelector('.view-feedback').textContent='日期或时段已更改，请根据更新后的空闲状态重新选座。';panel.querySelector('.booking-toggle').textContent='下一步：确认预约';signature='';}
    timeContext=nextContext;
    const sig = (window.__campusTheme?window.__campusTheme.key+'|'+window.__campusTheme.dark:'') + '|' + location.hash + '|' + (image ? image.src + image.complete : '') + '|' + nodes().map(n => n.title + n.className + n.style.left + n.style.top).join(';');
    if (sig !== signature) { signature = sig; list(); draw(); drawMap(); }
  }
  refresh(); let timer = setInterval(refresh, 1000);
  window.addEventListener('pagehide', () => { clearInterval(timer); timer = null; });
  window.addEventListener('pageshow', () => { if (!timer) { refresh(); timer = setInterval(refresh, 1000); } });
})();
