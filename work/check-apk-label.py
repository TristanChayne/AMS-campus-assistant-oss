import subprocess,sys
from pathlib import Path
apk=Path(sys.argv[1])
text=subprocess.check_output(['E:/DevTools/AndroidTools/SDK/build-tools/36.1.0/aapt2.exe','dump','badging',str(apk)]).decode('utf-8')
assert "application-label:'AMS 校园助手'" in text, 'APK application label corrupted'
print('PASS APK application label UTF-8')
