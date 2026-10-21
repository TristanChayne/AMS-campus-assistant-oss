from pathlib import Path
import zipfile,json
root=Path('outputs/ams-android')
s=(root/'app/src/main/java/cn/local/ams/ActivationActivity.java').read_text(encoding='utf-8')
assert 'if(valid)enter(); else showForm();' in s
assert s.index('private void showForm()')<s.index('开启校园助手')
assert s.count('Activation.valid(this)')==1
with zipfile.ZipFile(root/'ams-prototype-0.11.3-debug.apk') as z:
 c=json.loads(z.read('assets/activation-config.json'))
 assert c['endpoint'].endswith(('app.tcloudbase.com/api/activate','ams.tristanchayne.com/api/activate'))
 assert c['publicKey']==Path('E:/DevTools/Cache/AmsActivationSecrets/public-key.txt').read_text().strip()
 assert not any('secrets' in x.lower() for x in z.namelist())
print('PASS APK: Tencent endpoint, original public key, no secret file; activated startup does not build activation form.')

