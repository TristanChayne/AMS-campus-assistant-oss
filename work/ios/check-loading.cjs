const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('work/ios/loading-diagnostics.js','utf8');
function launch(host='seatbookings.xjtlu.edu.cn',main=true){
 const events={},document={readyState:'loading',querySelector(){return false}},window={addEventListener(k,v){events[k]=v}};window.top=main?window:{};
 vm.runInNewContext(source,{window,document,location:{protocol:'https:',hostname:host}});
 return {window,document,events};
}
const a=launch();assert.equal(a.window.__amsLoadingDiagnostics(),'document');
a.document.readyState='complete';assert.equal(a.window.__amsLoadingDiagnostics(),'adapter');
a.document.querySelector=()=>true;assert.equal(a.window.__amsLoadingDiagnostics(),'login');
a.events.error({target:{tagName:'SCRIPT',src:'https://school.invalid/private?token=DO_NOT_COLLECT'}});
assert.equal(a.window.__amsLoadingDiagnostics(),'resources');
assert.equal(launch('uim.xjtlu.edu.cn').window.__amsLoadingDiagnostics(),'login');
assert.equal(launch('unknown.invalid').window.__amsLoadingDiagnostics,undefined);
assert.equal(launch('seatbookings.xjtlu.edu.cn',false).window.__amsLoadingDiagnostics,undefined);
assert(!/fetch\(|XMLHttpRequest|sessionStorage|localStorage|\.src|\.href/.test(source));
assert.equal(fs.readFileSync('outputs/ams-ios/Assets/ios-loading-diagnostics.js','utf8'),source);
const native=fs.readFileSync('outputs/ams-ios/Sources/CampusController.swift','utf8');
assert(native.includes('if web.reload() == nil { loadInitialPage() }'));
assert(native.includes('self.loadingAttempt == attempt'));
assert(native.includes('guard webView === web, !(failure.domain == NSURLErrorDomain'));
assert(native.includes('webViewWebContentProcessDidTerminate'));
console.log('PASS: loading phase classification, failed script, host/frame isolation, no credential collection, generated parity and native recovery guards');
