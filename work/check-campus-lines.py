from pathlib import Path
import json
folder=Path('outputs/daily-lines')
for p in folder.iterdir():
 if p.suffix in ('.txt','.json','.md','.html'):
  text=p.read_text(encoding='utf-8-sig')
  assert '早八' not in text and '食堂' not in text,p
page=(folder/'句库预览.html').read_text(encoding='utf-8')
assert page.index('<h1>今日课表</h1>')<page.index('<section id="sample">')<page.index('class="controls"')
print('PASS all review files: no early-eight/canteen assumptions; title placement retained.')
