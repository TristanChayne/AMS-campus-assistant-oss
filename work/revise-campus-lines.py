from pathlib import Path
p=Path('work/generate-daily-lines.py')
s=p.read_text(encoding='utf-8-sig').replace('赶早八的路上，','赶早九的路上，').replace('在食堂排队的时候，','等一份喜欢的饭的时候，')
p.write_text(s,encoding='utf-8')
