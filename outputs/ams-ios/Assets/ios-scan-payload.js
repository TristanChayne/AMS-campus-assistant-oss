(function () {
    window.__amsSubmitScanPayload = function (payload) {
        // Match the school WeChat scanner and Android resultStr.split('=')[1].
        const code = typeof payload === 'string' ? payload.split('=')[1] : '';
        if (!code || code.length > 2048) return 'invalid-payload';
        if (typeof window.__amsSubmitScan !== 'function') return 'unavailable';
        return window.__amsSubmitScan(code);
    };
})();
