from pathlib import Path
p=Path('work/build-live-ui.py');s=p.read_text(encoding='utf-8').replace('0.10.3','0.10.4').replace('校园日常，轻松一点</div>','由 Tristan Chayne 制作<br><a href="mailto:linlantc@gmail.com">linlantc@gmail.com</a></div>');p.write_text(s,encoding='utf-8')
p=Path('work/managed-ui-polish.css');s=p.read_text(encoding='utf-8');s+='\n.about-app a{color:inherit;text-decoration:none;display:inline-block;padding:5px 0;overflow-wrap:anywhere}\n';p.write_text(s,encoding='utf-8')
p=Path('outputs/ams-android/app/build.gradle');s=p.read_text(encoding='utf-8').replace('versionCode 16','versionCode 17').replace('0.10.3','0.10.4');p.write_text(s,encoding='utf-8')
p=Path('outputs/ams-android/build-local.ps1');s=p.read_text(encoding='utf-8-sig').replace("'--version-code','15'","'--version-code','17'").replace('0.10.3','0.10.4');p.write_text(s,encoding='utf-8-sig')
p=Path('outputs/ams-android/README.md');s=p.read_text(encoding='utf-8');s+='\n0.10.4（versionCode 17）：设置页底部添加创作者 Tristan Chayne 和联系邮箱 linlantc@gmail.com，可点击邮箱打开邮件应用；统一本地构建与 Gradle 版本号。\n';p.write_text(s,encoding='utf-8')
