from pathlib import Path
import json,zipfile
root=Path('outputs/ams-android')
grant=json.loads(Path('work/live-activation-grant.json').read_text(encoding='utf-8'));Path('work/grant-java.txt').write_text(grant['publicKey']+'\n'+grant['grant'],encoding='utf-8')
with zipfile.ZipFile(root/'ams-prototype-0.11.0-debug.apk') as z:
 config=json.loads(z.read('assets/activation-config.json'))
 assert config['endpoint']=='https://ams-campus-activation.ams-activation.workers.dev/api/activate'
 assert config['publicKey']==grant['publicKey']
 assert z.read('assets/ams-modern-ui.js')==(root/'app/src/main/assets/ams-modern-ui.js').read_bytes()
 assert any('campus_icon' in n for n in z.namelist())
 assert 'SIGNING_KEY' not in '\n'.join(z.namelist())
 print('PASS: packaged endpoint/public key/current UI/icon; no secret config file')
p=root/'README.md';s=p.read_text(encoding='utf-8');s+='\n0.11.0（versionCode 19）：第二版桌面图标，安装专属密钥及永久离线授权，首开激活页；授权服务部署 Cloudflare Workers + D1。学校退出只清理学校会话，授权保持。安装包签名及实际云端接口已检查，手机生命周期仍需验收。\n';p.write_text(s,encoding='utf-8')
