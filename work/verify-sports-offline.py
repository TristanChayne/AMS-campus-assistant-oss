"""Verify the delivered ZIP and all embedded resources without opening a browser."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description='Verify an offline sports review bundle.')
parser.add_argument('--output-dir', type=Path, default=root / 'outputs/sports-offline-gpt')
parser.add_argument('--zip-path', type=Path, default=root / 'outputs/AMS-体育馆预约-GPT参考包-20261012.zip')
args = parser.parse_args()
out = args.output_dir if args.output_dir.is_absolute() else root / args.output_dir
zip_path = args.zip_path if args.zip_path.is_absolute() else root / args.zip_path
html = (out/'index.html').read_text(encoding='utf-8')
assert html == (out/'体育馆预约-离线演示.html').read_text(encoding='utf-8')
assert not re.search(r'<(?:script\b[^>]*\bsrc|link\b[^>]*\bhref|img\b[^>]*\bsrc)', html, re.I)
assert "connect-src 'none'" in html and "form-action 'none'" in html
embedded = json.loads(re.search(r'<script type="application/json" id="demo-data">(.*?)</script>',html,re.S).group(1))
assert embedded == json.loads((out/'demo-data.json').read_text(encoding='utf-8'))
assert embedded['metadata']['synthetic'] and not embedded['metadata']['network']
assert all(o['id'].startswith('DEMO-') for o in embedded['orders']+embedded['tickets'])
for name in ['sports-offline.js','sports-offline.css','sports-ui.js','sports-theme.css']:
    assert (root/'work'/name).read_text(encoding='utf-8') in html
    assert (root/'work'/name).read_bytes() == (out/'assets'/name).read_bytes()
manifest = json.loads((out/'manifest.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(manifest['files'])+1
    for name,digest in manifest['files'].items():
        data = z.read('AMS-体育馆预约-GPT参考包/'+name)
        assert hashlib.sha256(data).hexdigest() == digest
        assert data == (out/name).read_bytes()
    forbidden = ['cookie','capture','session','satoken','review-code','signing','keystore','.apk','.ipa','.pdf','.wxapkg']
    assert not any(word in name.lower() for name in z.namelist() for word in forbidden)
report = json.loads((out/'verification.json').read_text(encoding='utf-8'))
assert report['result']=='PASS' and report['networkAttempts']==0 and not report['scriptErrors']
visual_path = out/'visual-verification.json'
visual = None
if visual_path.exists():
    visual = json.loads(visual_path.read_text(encoding='utf-8'))
    assert visual['result']=='PASS' and visual['viewportCount']==7 and visual['themeCombinationCount']==18
    assert visual['networkAttempts']==0 and not visual['pageErrors']
    for shot in visual['screenshots']:
        p=out/shot['file']
        assert p.is_file() and p.stat().st_size == shot['bytes']
        assert hashlib.sha256(p.read_bytes()).hexdigest() == shot['sha256']
summary = f'{len(manifest["files"])} whitelisted files, synthetic offline HTML, exact source snapshots, ZIP hashes, and DOM checks'
if visual:
    summary += f', {visual["viewportCount"]} viewport checks, {visual["themeCombinationCount"]} theme checks, and {len(visual["screenshots"])} screenshot hashes'
print(f'PASS: {summary}.')
