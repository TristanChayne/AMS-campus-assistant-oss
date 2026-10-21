from pathlib import Path
p=Path('work/build-live-ui.py');s=p.read_text(encoding='utf-8');s=s.replace("body=body.replace('</header>', '</header><p id=\"dailyLine\" class=\"daily-line\" hidden></p>')", "body=body.replace('<div id=\"completed\"></div></section>', '<div id=\"completed\"></div></section><p id=\"dailyLine\" class=\"daily-line\" hidden></p>')")
s=s.replace('0.12.0','0.12.1');p.write_text(s,encoding='utf-8')
p=Path('work/managed-ui-polish.css');s=p.read_text(encoding='utf-8');s+='\n#homeScreen > .daily-line{margin:28px 0 0;padding-top:18px;border-top:1px solid var(--line);font-size:12px;line-height:1.8}\n';p.write_text(s,encoding='utf-8')
for name in ['outputs/ams-android/build-local.ps1','outputs/ams-android/app/build.gradle']:
 p=Path(name);s=p.read_text(encoding='utf-8-sig').replace('0.12.0','0.12.1').replace("'--version-code','24'","'--version-code','25'").replace('versionCode 24','versionCode 25');p.write_text(s,encoding='utf-8-sig' if name.endswith('.ps1') else 'utf-8')
