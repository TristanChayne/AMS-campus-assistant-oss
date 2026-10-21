"""Exercise extracted native session handlers when Swift is available; otherwise emit a harness."""
from pathlib import Path
import argparse
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = (root / 'outputs/ams-ios/Sources/CampusController.swift').read_text(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--emit-swift', type=Path)
args = parser.parse_args()

def method(declaration):
    start = source.index('    ' + declaration)
    end = source.index('\n    }', start) + len('\n    }')
    return source[start:end].replace('fileprivate func', 'func', 1).replace('private func', 'func', 1)

methods = '\n'.join(method(name) for name in ['fileprivate func saveSession(', 'private func installSchoolSession('])
assert 'installSchoolSession(in:config.userContentController)' in source
assert (root / 'work/ios/session.js').read_text(encoding='utf-8').startswith('/* AMS school session bridge */')
assert methods.count('installSchoolSession(in:web.configuration.userContentController)') == 2
assert 'web.reload' not in methods and 'expires' not in methods
harness = r'''
import Foundation
enum InjectionTime { case atDocumentStart }
final class WKUserScript {
    let source:String
    init(source:String,injectionTime:InjectionTime,forMainFrameOnly:Bool) {
        precondition(injectionTime == .atDocumentStart && forMainFrameOnly);self.source=source
    }
}
final class WKUserContentController {
    var userScripts:[WKUserScript]=[]
    func removeAllUserScripts(){userScripts=[]}
    func addUserScript(_ script:WKUserScript){userScripts.append(script)}
}
final class Configuration { let userContentController=WKUserContentController() }
final class WKWebView { let configuration=Configuration() }
struct Request { let url:URL? }
struct Frame { let isMainFrame:Bool; let request:Request }
struct WKScriptMessage { let webView:WKWebView; let frameInfo:Frame; let body:Any }
enum KeychainStore {
    static var value="",fail=false
    static func read(_ account:String)->String { precondition(account=="amsSession");return value }
    @discardableResult static func save(_ input:String,account:String)->Bool {
        precondition(account=="amsSession");if fail{return false};value=input;return true
    }
}
enum ActivationStore { static func accountChanged() {} }
final class Bundle {
    static let main=Bundle()
    func url(forResource:String,withExtension:String,subdirectory:String)->URL? {
        URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appendingPathComponent("work/ios/session.js")
    }
}
final class Subject {
    let web=WKWebView()
''' + methods + r'''
}
let s=Subject(),controller=s.web.configuration.userContentController
func message(_ body:String,_ host:String="ams.xjtlu.edu.cn",_ main:Bool=true)->WKScriptMessage {
    WKScriptMessage(webView:s.web,frameInfo:Frame(isMainFrame:main,request:Request(url:URL(string:"https://"+host+"/studenth5/"))),body:body)
}
let other=WKUserScript(source:"unrelated readiness",injectionTime:.atDocumentStart,forMainFrameOnly:true)
controller.addUserScript(other);s.installSchoolSession(in:controller)
func injected()->String { precondition(controller.userScripts.count==2 && controller.userScripts[1] === other);return controller.userScripts[0].source }
precondition(!injected().contains("__AMS_SESSION__"))
s.saveSession(message(#"{"token":"synthetic-first","password":"do-not-store"}"#))
precondition(injected().contains("synthetic-first") && !KeychainStore.value.contains("do-not-store"))
s.saveSession(message(#"{"token":"synthetic-rotated"}"#))
precondition(injected().contains("synthetic-rotated") && !injected().contains("synthetic-first"))
let latest=injected()
s.saveSession(message(#"{"token":"wrong-origin"}"#,"uim.xjtlu.edu.cn"))
s.saveSession(message(#"{"token":"wrong-frame"}"#,"ams.xjtlu.edu.cn",false))
s.saveSession(message("invalid json"));precondition(injected()==latest)
KeychainStore.fail=true;s.saveSession(message(#"{"token":"failed-write"}"#));KeychainStore.fail=false
precondition(injected()==latest)
s.saveSession(message(""));precondition(KeychainStore.value.isEmpty && !injected().contains("synthetic-rotated"))
print("PASS: extracted native session handler, first login/rotation/clear, sanitization, unrelated scripts, origin/frame isolation and failed keychain write")
'''
if args.emit_swift:
    args.emit_swift.write_text(harness, encoding='utf-8')
    print('Emitted native harness:', args.emit_swift)
swift = shutil.which('swift')
if swift:
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'SchoolSessionRecoveryChecks.swift'
        path.write_text(harness, encoding='utf-8')
        subprocess.run([swift, str(path)], cwd=root, check=True)
else:
    print('SKIP: Swift unavailable; native handler execution requires a Swift host.')
print('PASS: native installation/update/clear wiring and tagged bridge source')
