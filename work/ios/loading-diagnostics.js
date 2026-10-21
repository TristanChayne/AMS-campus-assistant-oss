/* Local loading status only: no URLs, credentials, response bodies or network requests. */
(() => {
  if (location.protocol !== 'https:' || window !== window.top
      || !['ams.xjtlu.edu.cn','seatbookings.xjtlu.edu.cn','roombookings.xjtlu.edu.cn','uim.xjtlu.edu.cn','portalapp.xjtlu.edu.cn'].includes(location.hostname)) return;
  let resourceFailed = false;
  window.addEventListener('error', event => {
    if (['SCRIPT','LINK'].includes(event.target?.tagName)) resourceFailed = true;
  }, true);
  window.__amsLoadingDiagnostics = () => {
    if (resourceFailed) return 'resources';
    if (document.querySelector('input[type="password"]') || ['uim.xjtlu.edu.cn','portalapp.xjtlu.edu.cn'].includes(location.hostname)) return 'login';
    if (document.readyState !== 'complete') return 'document';
    return 'adapter';
  };
})();
