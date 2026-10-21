// WKWebView can stay alive while its timers are suspended. Repaint on every activation,
// including returning from a native reservation page, then restart exactly one timer.
let iosClockTimer=null;
window.__amsRefreshClock=()=>{clockMinute='';refreshClock();};
function iosSetClockActive(active){
 clearInterval(iosClockTimer);iosClockTimer=null;
 if(active){window.__amsRefreshClock();iosClockTimer=setInterval(refreshClock,1000);}
}
window.addEventListener('message',e=>{
 if(e.source===parent&&typeof e.data?.iosActive==='boolean')iosSetClockActive(e.data.iosActive);
});
window.addEventListener('pageshow',()=>iosSetClockActive(true));
window.addEventListener('focus',()=>window.__amsRefreshClock());
iosSetClockActive(true);
