import json,re,shutil
from pathlib import Path
p=Path('outputs/school-capture-20261011');m=json.loads((p/'manifest.json').read_text(encoding='utf-8'));m['responses']=[x for x in m['responses'] if not any(s in x['path'] for s in ['/sso/','/wechat/','unReadCount','/captcha/','/authentication/'])]
allowed={x['file'] for x in m['responses']}
for f in p.glob('response-*.json'):
 if f.name not in allowed:f.unlink()
def scrub(v,key=''):
 if re.search(r'token|cookie|password|passwd|secret|authorization|openid|unionid|satoken|qrcode|qr_code|barcode|captcha|verificationcode|phone|mobile|studentid|studentno|studentnumber|email|username|account|birthday|address|attachment|filename|fileurl|userid|loginname|createdby|updatedby|accname|accno|accid|realname|studentname|displayname|fullname|identity|cardno|certno|idcard|memberlist|resvuser|userlist|imagebase',key,re.I):return '[REDACTED]'
 if isinstance(v,dict):return {k:scrub(x,k) for k,x in v.items()}
 if isinstance(v,list):return [scrub(x) for x in v]
 if v==2580505:return 1000000
 if isinstance(v,str):
  for s in ['田成俊彦','田成俊艳','Chengjunyan Tian','Chengjunyan.Tian25','Chengjunyan','2580505']:v=v.replace(s,'演示用户')
  v=re.sub(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}','demo@example.invalid',v,flags=re.I)
  v=re.sub(r'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+','[REDACTED]',v)
 return v
for f in p.glob('response-*.json'):
 f.write_text(json.dumps(scrub(json.loads(f.read_text(encoding='utf-8'))),ensure_ascii=False,indent=2),encoding='utf-8')
for f in p.glob('*.html'):
 t=scrub(f.read_text(encoding='utf-8'));t=re.sub(r'<meta\b[^>]*(?:csrf|token|auth)[^>]*>','',t,flags=re.I);t=re.sub(r'\s(?:data-[\w-]*(?:token|ticket|session)|nonce)=("[^"]*"|\x27[^\x27]*\x27)','',t,flags=re.I);t=re.sub(r'(<input\b[^>]*?)\svalue=("[^"]*"|\x27[^\x27]*\x27)',r'\1',t,flags=re.I);f.write_text(t,encoding='utf-8')
assets=Path('C:/Users/linla/AppData/Local/Temp/browser-use/assets/bd3fa2ff-5325-445c-95e6-5cd59a1554f2')
bundle=json.loads((assets/'manifest.json').read_text(encoding='utf-8'))
for x in bundle.get('assets',[]):
 from urllib.parse import urlsplit
 u=urlsplit(x['url']);f=Path(x['path'])
 if u.hostname and u.hostname.endswith('xjtlu.edu.cn') and f.suffix in ['.css','.woff2']:
  shutil.copy2(f,p/'assets'/f.name);m.setdefault('assets',[]).append({'file':f.name,'host':u.hostname,'path':u.path})
 elif (p/'assets'/f.name).exists():(p/'assets'/f.name).unlink()
m['pages']=list({x['name']:x for x in m['pages']}.values());m['blockers']=['account has no leave records: submitted detail and approval states not observed','current seat/room/bus query results have no own bookings: cancellation and ticket states not observed','QR native UI can be reused; no authenticated live QR contract capture; never store valid QR payload'];m['uploaded']=False;m['sanitization']='credentials/auth responses removed; user identity masked; no real submissions; no valid QR payload saved';(p/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
print('Pages:',len(m['pages']),'responses:',len(m['responses']),'assets:',len(list((p/'assets').glob('*'))))

import hashlib
seen=set();rows=[]
for x in m['responses']:
 file=p/x['file']
 if not file.exists():continue
 k=(x['host'],x['path'],hashlib.sha256(file.read_bytes()).hexdigest())
 if k in seen:file.unlink();continue
 seen.add(k);rows.append(x)
m['responses']=rows
m['assets']=list({x['file']:x for x in m.get('assets',[]) if (p/'assets'/x['file']).exists()}.values())
success={(x['host'],x['path']) for x in rows}
m['skipped']=list({(x['host'],x['path']):x for x in m['skipped'] if (x['host'],x['path']) not in success and not any(s in x['path'] for s in ['/sso/','/captcha/','/authentication/','/wechat/'])}.values())
(p/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
print('Final pages:',len(m['pages']),'unique responses:',len(rows),'assets:',len(m['assets']))
