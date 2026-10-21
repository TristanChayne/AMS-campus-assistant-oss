from pathlib import Path
import zipfile, hashlib, json, subprocess, re, os, shutil

os.environ['JAVA_HOME'] = 'E:/RuntimeEnv/Java/jdk-21.0.8+9'
apk = Path('outputs/ams-android/campus-day-0.13.4.apk')
out = Path('outputs/release-0.13.4')
assets = Path('outputs/ams-android/app/src/main/assets')
expected = ['ams-modern-ui.js', 'navigation.html', 'hht/hht.html', 'hht/tutorial.html',
            'hht/assets/options.png', 'hht/assets/https.png', 'hht/assets/capture.png', 'hht/assets/credentials.png']
with zipfile.ZipFile(apk) as archive:
    for name in expected:
        assert archive.read('assets/' + name) == (assets / name).read_bytes(), name
    assert not any(name.endswith('.saz') or 'signing.json' in name or 'source-before' in name for name in archive.namelist())
    assert b'HhtBridge' in archive.read('classes.dex')
    html = archive.read('assets/hht/hht.html').decode('utf-8')
    assert 'preview-tools' not in html and 'TEST-ONLY' not in html

tools = 'E:/DevTools/AndroidTools/SDK/build-tools/36.1.0/'
badging = subprocess.check_output([tools + 'aapt2.exe', 'dump', 'badging', str(apk)]).decode('utf-8')
assert "name='cn.local.ams' versionCode='65' versionName='0.13.4'" in badging
assert "application-label:'AMS 校园助手'" in badging

def certificate(path):
    result = subprocess.check_output([tools + 'apksigner.bat', 'verify', '--print-certs', str(path)], shell=True).decode('utf-8', 'replace')
    return re.search(r'Signer #1 certificate SHA-256 digest: (\S+)', result).group(1)

assert certificate(apk) == certificate(Path('outputs/release-0.13.3/campus-day-0.13.3.apk'))
report = {
    'versionName': '0.13.4', 'versionCode': 65, 'applicationId': 'cn.local.ams',
    'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'bytes': apk.stat().st_size,
    'sameSigningCertificateAs0133': True, 'packagedAssetsMatchSource': expected,
    'realDeviceAcceptance': 'pending', 'publicUpload': False, 'backendUpdatePromptChanged': False,
}
(out / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
shutil.copy2(apk, out / apk.name)
(out / 'SHA256.txt').write_text(report['sha256'] + '  ' + apk.name + '\n', encoding='ascii')
print('PASS version 0.13.4/65, unchanged release signer, assets match, no captures/signing config/demo controls. APK MiB:', round(report['bytes'] / 1024 / 1024, 2))
