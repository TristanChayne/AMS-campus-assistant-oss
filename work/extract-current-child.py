from pathlib import Path
import re
html=Path('work/live-ui.html').read_text(encoding='utf-8')
Path('work/check-current-child.js').write_text(re.search(r'<script>(.*)</script>',html,re.S).group(1),encoding='utf-8')
