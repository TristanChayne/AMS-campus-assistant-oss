from pathlib import Path
import re
r=Path('.'); s=r/'outputs/ams-ios/Sources'
p=s/'CampusController.swift';t=p.read_text(encoding='utf-8')
t=t.replace('        if message.name == "amsDemoExit" { owner?.exitDemo(); return }\n','').replace('    private let demoData: Data?\n','').replace(', demoData:Data? = nil','').replace('        self.demoData = demoData\n','')
t=t.replace('demoData == nil, ','').replace('config.websiteDataStore = demoData == nil ? .default() : .nonPersistent()','config.websiteDataStore = .default()')
t='\n'.join(x for x in t.split('\n') if not ('if let demoData {' in x or 'name:"amsDemoExit"' in x or 'fileprivate func exitDemo()' in x or 'if demoData != nil { return url?' in x or 'if demoData != nil { decisionHandler' in x))
t=t.replace('for name in demoData == nil ? [','for name in [').replace('] : [] {','] {').replace('"ios-auth-login", ','"ios-auth-recovery", ')
a=t.index('        if demoData != nil, let demo =');b=t.index('        #if DEBUG',a);t=t[:a]+t[b:];t=t.replace('\n        }\n        registerForTraitChanges','\n        registerForTraitChanges',1)
a=t.index('        if message.body as? String == "demo"');b=t.index('        guard message.body',a);t=t[:a]+t[b:]
t=t.replace('if demoData != nil { applyAppearance(); return }; ','').replace('if demoData != nil { return }; ','').replace('webView === web, demoData == nil','webView === web')
p.write_text(t,encoding='utf-8')
p=s/'CampusTabController.swift';t=p.read_text(encoding='utf-8').replace('init(demoData:Data? = nil) { campus = CampusController(demoData:demoData);','init() { campus = CampusController();');p.write_text(t,encoding='utf-8')
p=s/'AppDelegate.swift';t=p.read_text(encoding='utf-8');t='\n'.join(x for x in t.split('\n') if '--test-demo' not in x);t=t.replace('var root: UIViewController = CampusTabController()','var root: UIViewController = ActivationController()');p.write_text(t,encoding='utf-8')
p=r/'work/ios/prepare.py';t=p.read_text(encoding='utf-8');t='\n'.join(x for x in t.split('\n') if "with_name('auth-login.js')" not in x and "with_name('demo.html')" not in x and "with_name('demo-bridge.js')" not in x and "(ASSETS/'ios-demo-content.html').write_text" not in x)
a=t.index("for source,target in [('library-seat-ui.js'");b=t.index('\nrecord_style=',a);t=t[:a]+t[b:]
t=t.replace("shutil.copy2(Path(__file__).with_name('auth-theme.js'), ASSETS / 'ios-auth-theme.js')","shutil.copy2(Path(__file__).with_name('auth-theme.js'), ASSETS / 'ios-auth-theme.js')\nshutil.copy2(Path(__file__).with_name('auth-recovery.js'), ASSETS / 'ios-auth-recovery.js')\nshutil.copy2(ANDROID/'activation-config.json',ASSETS/'activation-config.json')\nshutil.copy2(Path(__file__).with_name('app-icon.png'),ASSETS/'activation-icon.png')")
p.write_text(t,encoding='utf-8')
p=r/'work/ios/readiness.js';t=p.read_text(encoding='utf-8');t='\n'.join(x for x in t.split('\n') if "#ams-login-cover input[type=password]" not in x);p.write_text(t,encoding='utf-8')
for p in [s/'DemoController.swift',*[(r/'work/ios'/x) for x in ['auth-login.js','demo.html','demo-bridge.js','demo-reservation.html','demo-reservation.js','check-demo.cjs','build-demo-preview.py']],*(r/'outputs/ams-ios/Assets').glob('ios-demo*'),r/'outputs/ams-ios/Assets/ios-auth-login.js']:
 if p.exists():p.unlink()
p=r/'outputs/ams-activation-tencent/src/worker.mjs';t=p.read_text(encoding='utf-8').replace("import {demoRequest} from './demo.mjs';\n",'');a=t.index("   if(path.startsWith('/api/demo/'))");b=t.index("   if(path==='/api/activate'",a);t=t[:a]+t[b:];p.write_text(t,encoding='utf-8');(r/'outputs/ams-activation-tencent/src/demo.mjs').unlink()
p=r/'work/ios/check.py';t=p.read_text(encoding='utf-8').replace("assert not (app / 'Assets/activation-config.json').exists()","assert (app / 'Assets/activation-config.json').exists()\nassert not list((app/'Assets').glob('ios-demo*'))\nassert not (app/'Sources/DemoController.swift').exists()").replace('no activation resources','activation configuration and no obsolete demo assets');p.write_text(t,encoding='utf-8')
