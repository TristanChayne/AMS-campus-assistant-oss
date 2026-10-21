from pathlib import Path
p=Path('outputs/ams-android/app/src/main/java/cn/local/ams/Activation.java');s=p.read_text(encoding='utf-8').replace('throw new IOException(', 'throw new LicenseException(');p.write_text(s,encoding='utf-8')
for f in ['outputs/ams-android/build-local.ps1','outputs/ams-android/app/build.gradle','work/build-live-ui.py']:
 p=Path(f);s=p.read_text(encoding='utf-8-sig').replace('0.11.0','0.11.1').replace("'--version-code','19'","'--version-code','20'").replace('versionCode 19','versionCode 20');p.write_text(s,encoding='utf-8-sig' if f.endswith('.ps1') else 'utf-8')
