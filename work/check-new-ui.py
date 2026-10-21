from pathlib import Path
import re
for p in Path('work').glob('chunk-*.js'):
 s=p.read_text(encoding='utf-8')
 for m in list(re.finditer('amsuserInfo',s))[:2]: print(p.name,s[max(0,m.start()-110):m.start()+170])
p=Path('work/check-managed-routes.cjs');s=p.read_text();s=s.replace('const context={location:',"const stored={};const context={localStorage:{getItem:k=>stored[k]||null,setItem:(k,v)=>stored[k]=v,removeItem:k=>delete stored[k]},location:");p.write_text(s)
p=Path('work/live-ui.html');s=p.read_text();Path('work/check-child-ui.js').write_text(s.split('<script>')[1].split('</script>')[0])
