from pathlib import Path
import hashlib
import plistlib
import subprocess

root = Path(__file__).resolve().parents[2]
app = root / 'outputs/ams-ios'
android = root / 'outputs/ams-android/app/src/main/assets'
with (app / 'Info.plist').open('rb') as file:
    info = plistlib.load(file)
assert info['CFBundleIdentifier'] == '$(PRODUCT_BUNDLE_IDENTIFIER)'
assert info['UIApplicationSceneManifest']['UIApplicationSupportsMultipleScenes'] is False
assert (app / 'Assets/activation-config.json').exists()
assert not list((app/'Assets').glob('ios-demo*'))
assert not (app/'Sources/DemoController.swift').exists()
review = (app/'Assets/review-content.html').read_text(encoding='utf-8')
assert '.review-seat-plan{position:relative;width:2670px;height:2004px}' in review
assert '.review-seat{position:absolute;' in review
assert 'grid-template-columns:repeat(8,minmax(0,1fr))' not in review
for name in ['ams-scan-entry.js','ams-submit-scan.js']:
    assert hashlib.sha256((android/name).read_bytes()).digest() == hashlib.sha256((app/'Assets'/name).read_bytes()).digest(), name
source = (app/'Sources/AppService.swift').read_text(encoding='utf-8')
assert 'static let enabled = true' in source
assert '/api/public/ios/config' in source
navigation = (app/'Sources/CampusController.swift').read_text(encoding='utf-8')
assert 'web.allowsBackForwardNavigationGestures = false' in navigation
assert 'window.__amsHandleBack && window.__amsHandleBack()' in navigation
assert (app/'Assets/ams-modern-ui.js').read_text(encoding='utf-8').count('iosSettingsBack') >= 4
assert 'override func viewDidAppear' in (app/'Sources/XipuCodeController.swift').read_text(encoding='utf-8')
node = Path('E:/RuntimeEnv/Node/node-v24.21.0-win-x64/node.exe')
for path in (app/'Assets').glob('*.js'):
    subprocess.run([str(node),'--check',str(path)],check=True,capture_output=True)
print('PASS: plist, scene lifecycle, activation configuration and no obsolete demo assets, adapter parity, public service enabled, JS syntax')
