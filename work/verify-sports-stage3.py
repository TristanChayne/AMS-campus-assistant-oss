"""Verify a Stage-3-family signed test APK; optional first argument selects the APK path."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
APK = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'outputs/test-0.14.1-build73-stage3/campus-day-0.14.1-test-build73-stage3.apk'
ANDROID_ASSETS = ROOT / 'outputs/ams-android/app/src/main/assets'
TOOLS = Path('E:/DevTools/AndroidTools/SDK/build-tools/36.1.0')
JAVA_HOME = Path('E:/RuntimeEnv/Java/jdk-21.0.8+9')
REPORT = APK.parent / 'resource-verification.json'

def run(executable, *args):
    command = [str(executable), *map(str, args)]
    if Path(executable).suffix.lower() == '.bat':
        command = ['cmd.exe', '/d', '/c', subprocess.list2cmdline(command)]
    env = os.environ.copy()
    if (JAVA_HOME / 'bin/java.exe').is_file():
        env['JAVA_HOME'] = str(JAVA_HOME)
        env['PATH'] = str(JAVA_HOME / 'bin') + os.pathsep + env.get('PATH', '')
    return subprocess.check_output(command, stderr=subprocess.STDOUT, env=env)

assert APK.is_file(), f'Missing staged test APK: {APK}'
source_files = {
    'sports-theme.css': ROOT / 'work/sports-theme.css',
    'sports-ui.js': ROOT / 'work/sports-ui.js',
}
for name, source in source_files.items():
    generated = (ANDROID_ASSETS / name).read_bytes()
    assert generated.replace(b'\r\n', b'\n') == source.read_bytes(), f'Generated Android resource differs from upstream: {name}'

with zipfile.ZipFile(APK) as package:
    for name, source in source_files.items():
        assert package.read(f'assets/{name}') == (ANDROID_ASSETS / name).read_bytes(), f'APK resource differs from generated Android asset: {name}'

badging = run(TOOLS / 'aapt2.exe', 'dump', 'badging', APK).decode('utf-8', 'replace')
assert "name='cn.local.ams' versionCode='73' versionName='0.14.1'" in badging, 'Unexpected APK package or version'
signature = run(TOOLS / 'apksigner.bat', 'verify', '--verbose', APK).decode('utf-8', 'replace')
assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in signature
assert 'Verified using v3 scheme (APK Signature Scheme v3): true' in signature
cert_output = run(TOOLS / 'apksigner.bat', 'verify', '--print-certs', APK).decode('utf-8', 'replace')
certificate = re.search(r'Signer #1 certificate SHA-256 digest: (\S+)', cert_output)
assert certificate, 'Could not read APK signer certificate digest'
run(TOOLS / 'zipalign.exe', '-c', '4', APK)

stage2 = ROOT / 'outputs/test-0.14.1-build73-stage2/campus-day-0.14.1-test-build73-stage2.apk'
if stage2.is_file():
    old_certs = run(TOOLS / 'apksigner.bat', 'verify', '--print-certs', stage2).decode('utf-8', 'replace')
    old_certificate = re.search(r'Signer #1 certificate SHA-256 digest: (\S+)', old_certs)
    assert old_certificate and old_certificate.group(1) == certificate.group(1), 'Stage-3 signer differs from the existing approved test signing environment'

report = {
    'result': 'PASS',
    'package': 'cn.local.ams',
    'versionName': '0.14.1',
    'versionCode': 73,
    'apk': APK.name,
    'apkSha256': hashlib.sha256(APK.read_bytes()).hexdigest(),
    'bytes': APK.stat().st_size,
    'zipAligned4': True,
    'signatureSchemes': ['v2', 'v3'],
    'signerCertificateSha256': certificate.group(1),
    'stage2SignerMatches': stage2.is_file(),
    'sportsAssets': {
        name: {'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'matchesUpstreamAfterLineEndingNormalizationAndApk': True}
        for name, source in source_files.items()
    },
    'realDeviceAcceptance': 'BLOCKED',
    'publicUpload': False,
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
