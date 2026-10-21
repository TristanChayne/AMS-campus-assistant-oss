"""Verify the local Mac tutorial and signed Android test package without school requests."""
from pathlib import Path
import hashlib, json, os, re, shutil, subprocess, zipfile

os.environ['JAVA_HOME'] = 'E:/RuntimeEnv/Java/jdk-21.0.8+9'
tools = Path('E:/DevTools/AndroidTools/SDK/build-tools/36.1.0')
apk = Path('outputs/ams-android/campus-day-0.14.1.apk')
out = Path('outputs/test-0.14.1-build72'); out.mkdir(exist_ok=True)
assets = Path('outputs/ams-android/app/src/main/assets/hht')
tutorial = (assets/'tutorial.html').read_text(encoding='utf-8')
assert '.pdf' not in tutorial and '下载 PDF' not in tutorial
assert 'id="macTutorial" hidden' in tutorial and 'aria-controls="windowsTutorial"' in tutorial
assert tutorial == Path('outputs/ams-ios/Assets/hht/tutorial.html').read_text(encoding='utf-8')
with zipfile.ZipFile(apk) as archive:
    assert archive.read('assets/hht/tutorial.html') == (assets/'tutorial.html').read_bytes()
    assert archive.read('res/raw/hht_tutorial.html') == (assets/'tutorial.html').read_bytes()
    for i in range(1,8):
        name = f'mac_p{i}.png'
        source = Path('outputs/hht-entry-preview/assets',name).read_bytes()
        assert archive.read('assets/hht/assets/'+name) == source
        assert archive.read('res/raw/hht_'+name) == source
        assert Path('outputs/ams-ios/Assets/hht/assets',name).read_bytes() == source
        assert 'assets/'+name in tutorial
    assert not any(n.lower().endswith(('.pdf','.har','.saz','.jks','.keystore')) for n in archive.namelist())
    for name in [b'SportsReservationActivity',b'UpdateNotice']:
        assert name in archive.read('classes.dex')
badging = subprocess.check_output([str(tools/'aapt2.exe'),'dump','badging',str(apk)]).decode('utf-8')
assert "name='cn.local.ams' versionCode='72' versionName='0.14.1'" in badging
def certificate(path):
    result = subprocess.check_output([str(tools/'apksigner.bat'),'verify','--print-certs',str(path)],shell=True).decode('utf-8','replace')
    return re.search(r'Signer #1 certificate SHA-256 digest: (\S+)',result).group(1)
assert certificate(apk) == certificate(Path('outputs/release-0.14.1/campus-day-0.14.1.apk'))
name = 'campus-day-0.14.1-test-build72.apk'
shutil.copy2(apk,out/name)
report = dict(versionName='0.14.1',versionCode=72,sha256=hashlib.sha256(apk.read_bytes()).hexdigest(),bytes=apk.stat().st_size,
    sameSignerAsBuild71=True,sevenSanitizedImagesVerified=True,pdfIncluded=False,realDeviceAcceptance='pending',publicUpload=False)
(out/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'SHA256.txt').write_text(report['sha256']+'  '+name+'\n',encoding='ascii')
print('PASS Android 0.14.1/72; seven images, raw fallback, iOS parity, no PDF, same signer, sports/update retained. MiB:',round(report['bytes']/1024/1024,2))
