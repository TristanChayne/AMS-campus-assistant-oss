let iosPreloadState={};
function iosUpdateReservationState() {
 document.querySelectorAll('.ios-service-state').forEach(note=>note.remove());
}
function iosGroupSettings(screen) {
 const account=screen.querySelector('.form-section'),appearance=screen.querySelector('#appearanceDropdown'),theme=screen.querySelector('.theme-options')?.closest('section'),maps=screen.querySelector('#campusMapsBtn'),about=screen.querySelector('.about-app');
 for(const [title,nodes] of [['账户',[account]],['外观',[appearance,theme]],['校园服务',[maps]],['关于',[about]]]){
  const group=document.createElement('section');group.className='ios-settings-group';
  const heading=document.createElement('h2');heading.textContent=title;group.append(heading);
  nodes.filter(Boolean).forEach(node=>group.append(node));screen.append(group);
 }
 account?.classList.add('ios-account-section');
}
window.addEventListener('message',event=>{
 if(event.source!==parent)return;
 if(event.data?.iosAction){const action=event.data.iosAction;if(action==='back')window.__amsHandleBack();if(action==='settings')document.getElementById('settingsBtn').click();if(action==='xjcode')document.getElementById('xjCodeBtn').click();}
 if(event.data?.iosPreload){iosPreloadState=event.data.iosPreload;iosUpdateReservationState();}
 if(event.data?.iosTextScale){document.documentElement.style.setProperty('--ios-text-scale',event.data.iosTextScale);}
});
function iosUpdateChrome(route) {
 parent.postMessage({amsIosChrome:{route,title:document.querySelector('h1').textContent,variables:document.documentElement.style.cssText}},'*');
 iosUpdateReservationState();
}
new MutationObserver(()=>parent.postMessage({amsIosModal:document.getElementById('sheet').open},'*')).observe(document.getElementById('sheet'),{attributes:true,attributeFilter:['open']});
