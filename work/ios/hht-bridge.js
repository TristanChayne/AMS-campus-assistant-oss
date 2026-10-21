window.HhtBridge = {
    ready:()=>window.webkit.messageHandlers.hht.postMessage({action:'ready'}),
    close:()=>window.webkit.messageHandlers.hht.postMessage({action:'close'}),
    refresh:()=>window.webkit.messageHandlers.hht.postMessage({action:'refresh'}),
    edit:()=>window.webkit.messageHandlers.hht.postMessage({action:'edit'}),
    unbind:()=>window.webkit.messageHandlers.hht.postMessage({action:'unbind'}),
    bind:(mode,credential)=>window.webkit.messageHandlers.hht.postMessage({action:'bind',mode,credential}),
 navigation:(title,management)=>window.webkit.messageHandlers.hht.postMessage({action:'navigation',title,management:management?'1':'0'})
};
