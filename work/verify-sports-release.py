"""Check the Android sports integration delivery without any school account or transaction."""
from pathlib import Path
import hashlib, json, os, re, shutil, subprocess, zipfile

os.environ['JAVA_HOME'] = 'E:/RuntimeEnv/Java/jdk-21.0.8+9'
tools = Path('E:/DevTools/AndroidTools/SDK/build-tools/36.1.0')
apk = Path('outputs/ams-android/campus-day-0.14.1.apk')
out = Path('outputs/release-0.14.1'); out.mkdir(exist_ok=True)
assets = Path('outputs/ams-android/app/src/main/assets')
expected = ['ams-modern-ui.js', 'navigation.html', 'library-seat-ui.js', 'sports-theme.css']
with zipfile.ZipFile(apk) as archive:
    for name in expected:
        assert archive.read('assets/' + name) == (assets / name).read_bytes(), name
    dex = archive.read('classes.dex')
    for name in [b'SportsReservationActivity', b'SportsNavigation', b'UpdateNotice']:
        assert name in dex, name
    assert not any(name.endswith(('.saz', '.har', '.jks', '.keystore')) or 'signing.json' in name for name in archive.namelist())
badging = subprocess.check_output([str(tools/'aapt2.exe'),'dump','badging',str(apk)]).decode('utf-8')
assert "name='cn.local.ams' versionCode='71' versionName='0.14.1'" in badging
def certificate(path):
    result = subprocess.check_output([str(tools/'apksigner.bat'),'verify','--print-certs',str(path)],shell=True).decode('utf-8','replace')
    return re.search(r'Signer #1 certificate SHA-256 digest: (\S+)',result).group(1)
assert certificate(apk) == certificate(Path('outputs/release-0.14.0/campus-day-0.14.0.apk'))
report = {'versionName':'0.14.1','versionCode':71,'applicationId':'cn.local.ams',
    'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'bytes':apk.stat().st_size,
    'sameSigningCertificateAs0140':True,'packagedAssetsMatchSource':expected,
    'realDeviceAcceptance':'pending','schoolTransactionsPerformed':False,
    'publicUpload':False,'backendUpdatePromptChanged':False,'iosPackageBuilt':False}
(out/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
shutil.copy2(apk,out/apk.name)
(out/'SHA256.txt').write_text(report['sha256']+'  '+apk.name+'\n',encoding='ascii')
print('PASS Android 0.14.1/71, same release signer, source-matching assets and native sports/update classes; no capture or signing files. MiB:',round(report['bytes']/1024/1024,2))
