(() => {
  if (location.protocol !== 'https:') return;
  const host = location.hostname;
  const managed = host === 'ams.xjtlu.edu.cn'
    || ['seatbookings.xjtlu.edu.cn','roombookings.xjtlu.edu.cn','uim.xjtlu.edu.cn','portalapp.xjtlu.edu.cn'].includes(host);
  if (!managed) return;
  const style = document.createElement('style');
  style.textContent = 'html:not(.ams-ios-ready) body{visibility:hidden!important} html:not(.ams-ios-ready) .el-loading-spinner{visibility:hidden!important}';
  document.documentElement.append(style);
  let finished = false;
  function reset() { finished=false; document.documentElement.classList.remove('ams-ios-ready'); window.webkit?.messageHandlers.amsReady.postMessage('waiting'); check(); }
  window.addEventListener('hashchange',reset);
  function check() {
    if (finished || !document.body) return;
    let ready = false;
    if (host === 'ams.xjtlu.edu.cn') {
      const frame = document.getElementById('ams-managed-ui');
      try { ready = !!(frame && frame.style.display !== 'none' && frame.contentDocument?.querySelector('.app')); } catch (_) {}
      if (document.querySelector('input[type="password"]')) ready = true;
    } else if (['uim.xjtlu.edu.cn','portalapp.xjtlu.edu.cn'].includes(host)) {
      ready = !!document.querySelector('input[type=password],input[autocomplete=one-time-code],input[inputmode=numeric],form input:not([type=hidden])');
      // School verification and recovery can contain only text, links or buttons.
      // They must remain authentic and usable after their document finishes loading.
      if (document.readyState === 'complete' && document.body.textContent.trim()) ready = true;
    } else {
      ready = (location.hash||'').startsWith('#/ic/userinfo')
        ? !!document.querySelector('#campus-records-panel')
        : !!document.querySelector('#campus-seat-panel,#campus-seat-home,#campus-room-panel,#campus-room-welcome');
      // Authentication must stay usable; it is intentionally not a managed business page.
      if (/login/i.test(location.hash) || document.querySelector('input[type="password"]')) ready = true;
    }
    if (!ready) return;
    finished = true; document.documentElement.classList.add('ams-ios-ready');
    window.webkit?.messageHandlers.amsReady.postMessage('ready');
    // Keep observing route changes; the same document can navigate after first readiness.
  }
  // Offscreen preloaded WebViews may defer animation frames. Readiness cannot depend on them.
  const observer = new MutationObserver(check);
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden','class']});

  window.addEventListener('DOMContentLoaded',check); window.addEventListener('load',check);
  window.addEventListener('ams-ios-active',check); check();
})();
