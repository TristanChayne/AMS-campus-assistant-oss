from pathlib import Path
import zipfile,json
root=Path('outputs/ams-android')
with zipfile.ZipFile(root/'ams-prototype-0.12.0-debug.apk') as z:
 js=z.read('assets/ams-modern-ui.js').decode()
 assert 'renderSignResult(screen,true)' in js and 'dailyLine' in js
 rows=json.loads(z.read('assets/daily-lines.json'))
 assert len(rows)==20000 and any(len(x['text'])<=54 for x in rows)
 assert all('早八' not in x['text'] and '食堂' not in x['text'] for x in rows)
 config=json.loads(z.read('assets/activation-config.json'))
 assert config['endpoint'].endswith(('app.tcloudbase.com/api/activate','ams.tristanchayne.com/api/activate'))
 assert config['publicKey']==Path('E:/DevTools/Cache/AmsActivationSecrets/public-key.txt').read_text().strip()
print('PASS final APK includes result UI, local revised quote corpus and unchanged activation verification key.')
