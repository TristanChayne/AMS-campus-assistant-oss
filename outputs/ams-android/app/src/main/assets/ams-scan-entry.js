(function () {
    if (location.protocol !== 'https:' || location.hostname !== 'ams.xjtlu.edu.cn'
        || location.pathname.indexOf('/studenth5/') !== 0 || window.__amsNativeScanInstalled) return;
    window.__amsNativeScanInstalled = true;
    document.addEventListener('click', function (event) {
        var element = event.target;
        if (!event.isTrusted || !element || typeof element.closest !== 'function') return;
        var button = element.closest('.buttonbox.left-cancel');
        if (!button || !button.querySelector('.icon-erweima')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        location.href = 'ams-local://scan';
    }, true);
})();
