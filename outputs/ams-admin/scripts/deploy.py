"""Install only AMS admin static files and its named nginx locations.

Run on the new server: python3 deploy.py <dist.tar.gz> <release-id>
Does not alter notify, activation databases, secrets or other sites.
"""
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile

BASE = Path('/opt/ams-admin')
WEB = Path('/www/wwwroot/ams.tristanchayne.com')
SITE = Path('/www/server/panel/vhost/nginx/ams.tristanchayne.com.conf')
START = '    # BEGIN ADMIN-FE-001 static frontend'
END = '    # END ADMIN-FE-001 static frontend'
ROUTES = '''    # BEGIN ADMIN-FE-001 static frontend
    location = /admin { return 301 /admin/; }
    location ^~ /admin/assets/ {
        try_files $uri =404;
        expires 30d;
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
    location ^~ /admin/ {
        try_files $uri $uri/ /admin/index.html;
        add_header Cache-Control "no-cache" always;
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
    }
    # END ADMIN-FE-001 static frontend
'''
# Insert once, outside the managed static block. Later frontend deployments preserve
# Claude's authenticated API route exactly as it stands.
API_PLACEHOLDER = '''    # Claude replaces only this placeholder when the authenticated admin API is ready.
    location ^~ /api/admin/ {
        default_type application/json;
        add_header Cache-Control "no-store" always;
        return 503 '{"message":"管理服务尚未接入，请稍后重试。","error":{"code":"BACKEND_NOT_CONNECTED","message":"管理服务尚未接入，请稍后重试。"}}';
    }
'''


def main():
    archive = Path(sys.argv[1]).resolve()
    release = sys.argv[2]
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9.-]{0,79}', release):
        raise ValueError('Invalid release id')
    target = BASE / 'releases' / release
    if target.exists():
        raise FileExistsError('Release already exists; do not overwrite')
    if (WEB / 'admin').exists() and not (WEB / 'admin').is_symlink():
        raise ValueError('Existing admin directory has unknown ownership')
    original = SITE.read_text()
    if START in original:
        updated, count = re.subn(re.escape(START) + r'.*?' + re.escape(END) + r'\n?', ROUTES, original, flags=re.S)
    else:
        anchor = '    location / { try_files $uri /index.html; }'
        count = original.count(anchor)
        if count != 1:
            raise ValueError('Site configuration changed; inspect before deploying')
        api_route = '' if re.search(r'location\s+[^\n{]*?/api/admin/', original) else API_PLACEHOLDER
        updated = original.replace(anchor, ROUTES + api_route + '\n' + anchor)
    if count != 1:
        raise ValueError('Ambiguous managed route block')
    backup = BASE / 'backups' / release
    backup.mkdir(parents=True, exist_ok=False)
    shutil.copy2(SITE, backup / 'nginx.conf')
    old_link = os.readlink(WEB / 'admin') if (WEB / 'admin').is_symlink() else ''
    (backup / 'admin-link.txt').write_text(old_link)
    target.mkdir(parents=True, exist_ok=False)
    with tarfile.open(archive) as bundle:
        bundle.extractall(target, filter='data')
    if not (target / 'index.html').is_file() or not (target / 'assets').is_dir():
        raise ValueError('Incomplete static bundle')
    for file in target.rglob('*'):
        file.chmod(0o755 if file.is_dir() else 0o644)
    next_link = WEB / ('.admin-next-' + release)
    next_link.symlink_to(target, target_is_directory=True)
    os.replace(next_link, WEB / 'admin')
    nginx = shutil.which('nginx') or '/www/server/nginx/sbin/nginx'
    try:
        if SITE.read_text() != original:
            raise ValueError('Site changed while preparing; preserve other writer')
        SITE.write_text(updated)
        subprocess.run([nginx, '-t'], check=True)
        subprocess.run([nginx, '-s', 'reload'], check=True)
    except Exception:
        # Restore only if our exact content is still present; never overwrite another writer.
        if SITE.read_text() == updated:
            SITE.write_text(original)
        if old_link:
            restore = WEB / ('.admin-restore-' + release)
            restore.symlink_to(old_link, target_is_directory=True)
            os.replace(restore, WEB / 'admin')
        else:
            (WEB / 'admin').unlink()
        raise
    print('Deployed:', release)
    print('Index SHA256:', hashlib.sha256((target / 'index.html').read_bytes()).hexdigest())
    print('Rollback reference:', backup)


if __name__ == '__main__':
    main()
