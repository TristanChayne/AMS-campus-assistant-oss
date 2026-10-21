(() => {
 if(location.protocol!=='https:'||!['ams.xjtlu.edu.cn','uim.xjtlu.edu.cn','seatbookings.xjtlu.edu.cn','roombookings.xjtlu.edu.cn','portalapp.xjtlu.edu.cn'].includes(location.hostname))return;
 const style=document.createElement('style');style.textContent=`html.campus-auth-dark{color-scheme:dark;background:#15191f!important}html.campus-auth-dark body{background:#15191f!important;color:#e7ecf4!important}html.campus-auth-dark :is(.card,.login-form,.login-box,.el-card,.el-dialog,.el-message-box,.v-card,form){background:#202630!important;color:#e7ecf4!important}html.campus-auth-dark :is(input:not([type=checkbox]):not([type=radio]),select,textarea,.el-input__inner){background:#191f27!important;color:#e7ecf4!important;border-color:#343d49!important}html.campus-auth-dark :is(label,p,h1,h2,h3,h4,.el-form-item__label){color:#e7ecf4!important}html.campus-auth-dark [data-ios-auth-surface]{background:#202630!important;color:#e7ecf4!important;border-color:#343d49!important}html.campus-auth-dark [data-ios-auth-brand-ink]{color:#bfa7ff!important}html.campus-auth-dark [data-ios-auth-ink]{color:#e7ecf4!important}html.campus-auth-dark input::placeholder{color:#a4afbf!important}`;
 document.documentElement.append(style);
 window.__amsAuthAppearance=dark=>document.documentElement.classList.toggle('campus-auth-dark',!!dark&&!!document.querySelector('input[type=password]'));
 const seen=new WeakSet();
 const update=()=>{
  if(document.querySelector('input[type=password]'))for(const node of document.body.querySelectorAll('*')){
   if(seen.has(node)||['IMG','SVG','PATH','SCRIPT','STYLE'].includes(node.tagName))continue;seen.add(node);
   const css=getComputedStyle(node),rgb=css.backgroundColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
   if(rgb){const values=rgb.slice(1).map(Number);if(Math.min(...values)>220&&Math.max(...values)-Math.min(...values)<18)node.setAttribute('data-ios-auth-surface','');}
   const ink=css.color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
   if(ink){const [r,g,b]=ink.slice(1).map(Number);if(Math.max(r,g,b)<125)node.setAttribute('data-ios-auth-ink','');else if(b>r+50&&b>g+80&&r<160)node.setAttribute('data-ios-auth-brand-ink','');}
  }
  window.__amsAuthAppearance(window.__amsNativeDark??matchMedia('(prefers-color-scheme:dark)').matches);
 };
 new MutationObserver(update).observe(document.documentElement,{childList:true,subtree:true});update();
})();
