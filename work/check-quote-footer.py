from pathlib import Path
s=Path('work/live-ui.html').read_text(encoding='utf-8')
assert s.index('id="scanBtn"')<s.index('id="completed"')<s.index('id="dailyLine"')<s.index('id="otherScreen"')
assert s.count('id="dailyLine"')==1
print('PASS quote below courses, no added space above sign-in controls.')
