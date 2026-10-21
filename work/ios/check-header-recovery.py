"""Check header recovery wiring/JS; emit extracted native methods for `swift` checks."""
from pathlib import Path
import argparse
import json
import re
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = (root / 'outputs/ams-ios/Sources/CampusController.swift').read_text(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--emit-swift', type=Path)
args = parser.parse_args()

def method(name):
    start = source.index('    private func ' + name + '(')
    end = source.index('\n    }', start) + len('\n    }')
    return source[start:end].replace('private func', 'func', 1)

methods = '\n'.join(method(n) for n in [
    'invalidateOriginalChrome', 'recoverOriginalChrome', 'checkOriginalChrome', 'syncOriginalChrome'])
assert '@objc private func resume() { checkOriginalChrome();' in source
assert 'setReservationActive(true); checkOriginalChrome()' in source
assert 'if webView === originalHeader { invalidateOriginalChrome(); recoverOriginalChrome() }' in source
assert 'if webView === originalHeader { chromeNeedsReload = false; chromePayload = ""; syncOriginalChrome(); return }' in source
assert 'if !(failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled) { invalidateOriginalChrome() }' in source
assert 'web.reload' not in methods and 'loadInitialPage' not in methods

# Execute the actual JS expression sent by Swift, including absence and throw paths.
expression = re.search(r'header.evaluateJavaScript\("(\(\(\)=>.*?)"\)', method('syncOriginalChrome')).group(1)
expression = expression.replace(r'\(payload)', json.dumps(['/home', 'AMS', True, '']))
subprocess.run([shutil.which('node') or 'node', '-e', '''
const vm=require('vm'),assert=require('assert/strict'),code=JSON.parse(process.argv[1]);
assert.equal(vm.runInNewContext(code,{window:{}}),false);
let args;assert.equal(vm.runInNewContext(code,{window:{setChrome(...a){args=a}}}),true);
assert.equal(args[0],'/home');assert.equal(args[1],'AMS');assert.equal(args[2],true);
assert.throws(()=>vm.runInNewContext(code,{window:{setChrome(){throw Error('stopped')}}}));
console.log('PASS: actual sync JS reports missing renderer, applied state and thrown failure');
''', json.dumps(expression)], check=True)

harness = r'''
import Foundation
import Dispatch
enum AppState { case active, background }
final class UIApplication { static let shared = UIApplication(); var applicationState = AppState.active }
final class Bundle {
    static let main = Bundle()
    func url(forResource:String,withExtension:String,subdirectory:String) -> URL? { URL(fileURLWithPath:"/local/ios-chrome.html") }
}
final class DispatchWorkItem {
    let body: () -> Void; var cancelled = false
    init(block:@escaping () -> Void) { body = block }
    func cancel() { cancelled = true }
    func perform() { if !cancelled { body() } }
}
final class DispatchQueue {
    static let main = DispatchQueue(); var tasks:[DispatchWorkItem] = []
    func asyncAfter(deadline:DispatchTime,execute:DispatchWorkItem) { tasks.append(execute) }
    func drain() { let pending = tasks; tasks = []; pending.forEach { $0.perform() } }
}
final class WKWebView {
    var isLoading = false; var loads = 0
    var callbacks:[(Any?,Error?)->Void] = []
    func stopLoading() { isLoading = false }
    func loadFileURL(_ url:URL,allowingReadAccessTo:URL) { loads += 1; isLoading = true }
    func evaluateJavaScript(_ text:String,completionHandler:@escaping (Any?,Error?)->Void) { callbacks.append(completionHandler) }
    func reply(_ index:Int,_ value:Any?,_ error:Error? = nil) { callbacks[index](value,error) }
}
enum Style { case dark, light }
struct Traits { var userInterfaceStyle = Style.dark }
final class Subject {
    var originalHeader:WKWebView? = WKWebView()
    var chromePayload = "", chromeVariables = "", chromeRoute = "/home"
    var title:String? = "AMS"
    var chromeNeedsReload = false, mainReady = true, isCurrentPage = true, rootChrome = true
    var chromeGeneration = 0, chromeSyncSequence = 0
    var traitCollection = Traits()
''' + methods + r'''
}
func fresh() -> Subject { DispatchQueue.main.tasks = []; UIApplication.shared.applicationState = .active; return Subject() }
var s = fresh(); var h = s.originalHeader!
s.syncOriginalChrome(); assert(s.chromePayload.isEmpty); h.reply(0,false); assert(s.chromePayload.isEmpty)
s.syncOriginalChrome(); h.reply(1,true); assert(!s.chromePayload.isEmpty)
s.syncOriginalChrome(); assert(h.callbacks.count == 2) // acknowledged state deduplicates
s.title = "Temporary"; s.syncOriginalChrome(); s.title = "AMS"; s.syncOriginalChrome()
assert(h.callbacks.count == 4); h.reply(3,true); let restored = s.chromePayload
h.reply(2,true); assert(s.chromePayload == restored)
s = fresh(); h = s.originalHeader!; s.syncOriginalChrome(); s.title = "New"; s.syncOriginalChrome()
h.reply(1,true); let newest = s.chromePayload; h.reply(0,true); assert(s.chromePayload == newest)
s = fresh(); h = s.originalHeader!; s.syncOriginalChrome(); s.invalidateOriginalChrome()
h.reply(0,true); assert(s.chromePayload.isEmpty) // old document cannot acknowledge the new one
UIApplication.shared.applicationState = .background; s.recoverOriginalChrome(); assert(h.loads == 0)
UIApplication.shared.applicationState = .active; s.checkOriginalChrome(); assert(h.loads == 1 && h.isLoading)
s.checkOriginalChrome(); assert(h.loads == 1) // no duplicate reload during recovery
h.isLoading = false; s.syncOriginalChrome(); h.reply(1,true); assert(!s.chromePayload.isEmpty)
s = fresh(); h = s.originalHeader!; s.checkOriginalChrome(); s.checkOriginalChrome()
h.reply(1,true); h.reply(2,true); DispatchQueue.main.drain(); assert(h.loads == 0)
h.reply(0,false); assert(h.loads == 0) // older health probe cannot invalidate a healthy header
s = fresh(); h = s.originalHeader!; s.checkOriginalChrome(); h.reply(0,false); assert(h.loads == 1)
DispatchQueue.main.drain(); assert(h.loads == 1) // cancelled probe timeout cannot reload again
s = fresh(); h = s.originalHeader!; s.checkOriginalChrome(); DispatchQueue.main.drain(); assert(h.loads == 1)
h.reply(0,true); assert(h.callbacks.count == 1 && h.loads == 1) // late health callback ignored
s = fresh(); h = s.originalHeader!; s.checkOriginalChrome(); h.reply(0,true); h.reply(1,true)
assert(!s.chromePayload.isEmpty && h.loads == 0)
s = fresh(); h = s.originalHeader!; s.isCurrentPage = false; s.invalidateOriginalChrome()
s.recoverOriginalChrome(); s.checkOriginalChrome(); assert(h.loads == 0 && h.callbacks.isEmpty)
s.isCurrentPage = true; s.checkOriginalChrome(); assert(h.loads == 1)
s = fresh(); h = s.originalHeader!; s.checkOriginalChrome()
UIApplication.shared.applicationState = .background; DispatchQueue.main.drain()
assert(h.loads == 0 && s.chromeNeedsReload)
UIApplication.shared.applicationState = .active; s.checkOriginalChrome(); assert(h.loads == 1)
s = fresh(); h = s.originalHeader!; s.syncOriginalChrome()
h.reply(0,nil,NSError(domain:"test",code:1)); assert(s.chromePayload.isEmpty)
s.syncOriginalChrome(); h.reply(1,true); assert(!s.chromePayload.isEmpty)
print("PASS: extracted Swift methods — acknowledged sync, retries, stale replies, background/current-page guards, recovery, health failure and timeout")
'''
if args.emit_swift:
    args.emit_swift.write_text(harness, encoding='utf-8')
    print('Emitted native regression harness:', args.emit_swift)
swift = shutil.which('swift')
if swift:
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'HeaderRecoveryChecks.swift'
        path.write_text(harness, encoding='utf-8')
        subprocess.run([swift, str(path)], check=True)
else:
    print('SKIP: native Swift execution unavailable; run --emit-swift on a Swift host. Wiring and JS checks only.')
print('PASS: lifecycle/termination wiring and recovery scope')
