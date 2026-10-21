from pathlib import Path
p=Path('outputs/ams-android/app/src/main/AndroidManifest.xml');s=p.read_text(encoding='utf-8').replace('AMS 校园助手（原型）','AMS 校园助手');p.write_text(s,encoding='utf-8')
for f in ['work/build-live-ui.py','outputs/ams-android/app/build.gradle','outputs/ams-android/build-local.ps1']:
 p=Path(f);s=p.read_text(encoding='utf-8-sig').replace('0.10.4','0.10.5').replace('versionCode 17','versionCode 18').replace("'--version-code','17'","'--version-code','18'");p.write_text(s,encoding='utf-8-sig' if f.endswith('.ps1') else 'utf-8')
