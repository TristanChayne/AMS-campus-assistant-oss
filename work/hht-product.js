const el=id=>document.getElementById(id);
let mode='openid',bound=false,bindingBusy=false;
function page(name){
 const pass=name==='pass';el('binding').hidden=pass;el('pass').hidden=!pass;el('more').hidden=!pass;el('headerSpace').hidden=pass;
 el('pageTitle').textContent=pass?'宿舍通行码':'绑定慧湖通';el('menu').hidden=true;window.scrollTo(0,0);
}
window.hhtHideCode=()=>{el('qrImage').hidden=true;el('qrImage').removeAttribute('src');el('qrPlaceholder').hidden=false;el('qrTitle').textContent='正在获取二维码';el('qrHint').textContent='请稍候';};
window.hhtTheme=t=>{
 document.body.classList.toggle('dark',t.dark);
 for(const [name,value] of Object.entries({accent:t.accent,'accent-soft':t.wash,bg:t.bg,surface:t.surface,ink:t.ink,muted:t.muted,line:t.line}))document.body.style.setProperty('--'+name,value);
};
window.hhtResult=data=>{
 if(data.kind==='session'){
  bound=data.bound;bindingBusy=false;el('bind').disabled=false;el('bind').textContent='验证并绑定';page(bound?'pass':'binding');
  el('credential').value='';el('feedback').textContent='';
  if(!bound)window.hhtHideCode();
 }else if(data.kind==='loading'){
  window.hhtHideCode();el('refresh').disabled=true;el('refresh').textContent='正在刷新…';el('status').className='status';el('status').textContent='正在更新，请稍候';
  if(data.binding){bindingBusy=true;el('bind').disabled=true;el('bind').textContent='正在验证…';el('feedback').textContent='正在验证慧湖通并获取通行码…';}
 }else if(data.kind==='code'){
  bound=true;bindingBusy=false;el('credential').value='';el('bind').disabled=false;el('bind').textContent='验证并绑定';el('feedback').textContent='';page('pass');
  el('passName').textContent=data.name||'宿舍通行码';el('qrPlaceholder').hidden=true;el('qrImage').src='data:image/png;base64,'+data.image;el('qrImage').hidden=false;
  el('updated').textContent='更新时间：'+new Date(data.updated).toLocaleTimeString();el('status').className='status';el('status').textContent='二维码每 8 秒自动更新';
  el('refresh').hidden=false;el('refresh').disabled=false;el('refresh').textContent='刷新二维码';el('rebind').hidden=true;
 }else if(data.kind==='error'){
  window.hhtHideCode();el('qrTitle').textContent=data.expired?'登录凭证已失效':'二维码暂不可用';el('qrHint').textContent='';el('updated').textContent='当前没有可用二维码';
  el('bind').disabled=false;el('bind').textContent='验证并绑定';el('refresh').disabled=false;el('refresh').textContent='重试获取二维码';el('refresh').hidden=false;
  el('rebind').hidden=!data.expired;el('status').className='status error';el('status').textContent=data.message;el('feedback').textContent=data.message;bindingBusy=false;
 }
};
el('back').onclick=()=>HhtBridge.close();
el('more').onclick=()=>el('menu').hidden=!el('menu').hidden;
el('reveal').onclick=()=>{const shown=el('credential').type==='password';el('credential').type=shown?'text':'password';el('reveal').textContent=shown?'隐藏':'显示';};
el('bind').onclick=()=>{const value=el('credential').value.trim();if(!value){el('feedback').textContent='请先粘贴你的 '+(mode==='openid'?'OpenId':'satoken');return;}HhtBridge.bind(mode,value);};
el('switchMode').onclick=()=>{
 if(bindingBusy)return;mode=mode==='openid'?'token':'openid';el('credentialLabel').textContent=mode==='openid'?'OpenId':'登录令牌';
 el('credential').placeholder=mode==='openid'?'粘贴你的 OpenId':'粘贴你的 satoken';el('credential').value='';el('feedback').textContent='';el('switchMode').textContent=mode==='openid'?'改用登录令牌':'改用 OpenId';
};
el('change').onclick=()=>{HhtBridge.edit();window.hhtHideCode();page('binding');};el('rebind').onclick=el('change').onclick;
el('unbind').onclick=()=>HhtBridge.unbind();el('refresh').onclick=()=>HhtBridge.refresh();
window.addEventListener('pagehide',window.hhtHideCode);
HhtBridge.ready();
