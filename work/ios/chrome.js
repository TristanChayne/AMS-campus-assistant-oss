
document.documentElement.classList.add('chrome-'+window.chromeMode);
const send=(action,index)=>window.webkit.messageHandlers.amsChromeAction.postMessage({action,index:index??0});
document.getElementById('settingsBtn').onclick=()=>send('settings');
document.getElementById('xjCodeBtn').onclick=()=>send('xjcode');
document.getElementById('hhtCodeBtn').onclick=()=>send('hhtcode');
window.setChrome=(route,title,dark,variables)=>{
 document.querySelector('.app').classList.toggle('home-layout',route==='/home');document.querySelector('h1').textContent=title;document.documentElement.classList.toggle('ams-dark',dark);
 document.documentElement.style.cssText=variables;
 document.getElementById('xjCodeBtn').hidden=route!=='/home';document.getElementById('settingsBtn').hidden=!['/home','/course','/leave'].includes(route);
 document.getElementById('hhtCodeBtn').hidden=route!=='/home';
 if(window.chromeMode==='header')requestAnimationFrame(reportHeight);
};
function reportHeight(){const header=document.querySelector('header');send('height',Math.ceil(header.getBoundingClientRect().bottom+parseFloat(getComputedStyle(header).marginBottom||0)));}
if(window.chromeMode==='header')new ResizeObserver(reportHeight).observe(document.querySelector('header'));
