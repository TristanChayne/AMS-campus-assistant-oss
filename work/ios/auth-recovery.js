(() => {
  if (location.protocol !== 'https:' || location.hostname !== 'uim.xjtlu.edu.cn') return;
  // Keep the school's real login and verification controls. Recovery uses Safari.
  document.addEventListener('click', e => {
    const link = e.target.closest?.('a,button,[role=button]');
    if (!link) return;
    const url = new URL(link.href || location.href, location.href);
    if ((url.hostname === 'uim.xjtlu.edu.cn' && url.pathname.includes('/selfcareforgetpassword/')) || link.textContent.trim() === '忘记密码') {
      e.preventDefault(); e.stopImmediatePropagation();
      window.webkit?.messageHandlers.amsAuthExternal.postMessage('forgotPassword');
    }
  }, true);
})();
