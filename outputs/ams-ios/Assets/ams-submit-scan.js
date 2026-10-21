(function () {
    window.__amsSubmitScan = function (code) {
        if (location.protocol !== 'https:' || location.hostname !== 'ams.xjtlu.edu.cn'
                || location.pathname.indexOf('/studenth5/') !== 0) return 'unavailable';
        const queue = [], seen = new Set();
        for (const node of document.querySelectorAll('*')) if (node.__vue__) queue.push(node.__vue__);
        let home = null, route = null;
        while (queue.length) {
            const vm = queue.pop();
            if (!vm || seen.has(vm) || vm._isDestroyed) continue;
            seen.add(vm);
            if (vm.$route) route = vm.$route.path;
            if (vm.$options && vm.$options.name === 'home' && vm._inactive !== true
                    && typeof vm.onSubmit === 'function') home = vm;
            if (vm.$parent) queue.push(vm.$parent);
            if (vm.$root) queue.push(vm.$root);
            if (vm.$children) queue.push(...vm.$children);
        }
        if (route !== '/home' || !home) return 'unavailable';
        // Once the school handler is called, never retry a submission.
        try { window.__amsSignMethod = 'scan'; home.onSubmit(code); return 'submitted'; }
        catch (e) { return 'handler-error'; }
    };
})();
