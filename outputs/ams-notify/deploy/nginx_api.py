"""ADMIN-BE-001: add or refresh the AMS API reverse proxy block in the ams.tristanchayne.com nginx site.

Run on the server: python3 nginx_api.py
Only manages the marked block; keeps /api/notify/, the ADMIN-FE-001 static block, certificates and other sites.
Backs up the site file, validates with nginx -t, reloads, and restores the exact previous file on failure.
"""
import re
import shutil
import subprocess
import time
from pathlib import Path

SITE = Path('/www/server/panel/vhost/nginx/ams.tristanchayne.com.conf')
BACKUPS = Path('/opt/ams-notify/backups')
START = '    # BEGIN ADMIN-BE-001 api'
END = '    # END ADMIN-BE-001 api'
PROXY = '''        proxy_pass http://127.0.0.1:18640;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;'''
BLOCK = f'''{START}
    # Admin console API (same origin as /admin/); ADMIN-FE-001 deploy keeps this location.
    location ^~ /api/admin/ {{
{PROXY}
    }}
    # Activation, per-open client check, iOS public config, review demo.
    location ^~ /api/ {{
        client_max_body_size 2m;
{PROXY}
    }}
{END}
'''
ANCHOR = '    location / { try_files $uri /index.html; }'


def main():
    original = SITE.read_text()
    if START in original:
        updated, count = re.subn(re.escape(START) + r'.*?' + re.escape(END) + r'\n', BLOCK, original, flags=re.S)
        if count != 1:
            raise ValueError('Ambiguous ADMIN-BE-001 block')
    else:
        if original.count(ANCHOR) != 1:
            raise ValueError('Site configuration changed; inspect before editing')
        if re.search(r'location\s+[^\n{]*?/api/admin/', original):
            raise ValueError('Another /api/admin/ location exists (ADMIN-FE-001 placeholder?); remove it first')
        updated = original.replace(ANCHOR, BLOCK + ANCHOR)
    if updated == original:
        print('nginx block unchanged')
        return
    BACKUPS.mkdir(parents=True, exist_ok=True)
    backup = BACKUPS / f'nginx-{time.strftime("%Y%m%d-%H%M%S")}.conf'
    shutil.copy2(SITE, backup)
    nginx = shutil.which('nginx') or '/www/server/nginx/sbin/nginx'
    try:
        SITE.write_text(updated)
        subprocess.run([nginx, '-t'], check=True)
        subprocess.run([nginx, '-s', 'reload'], check=True)
    except Exception:
        if SITE.read_text() == updated:
            SITE.write_text(original)
            subprocess.run([nginx, '-t'], check=False)
        raise
    print('nginx block installed; backup', backup)


if __name__ == '__main__':
    main()
