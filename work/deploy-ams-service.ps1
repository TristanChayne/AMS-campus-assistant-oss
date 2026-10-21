# ADMIN-BE-001: deploy outputs/ams-notify (with the activation worker sources) to the shared Hong Kong server.
# Touches only /opt/ams-notify, the ams-notify container and (with -Nginx) the marked API block of the
# ams.tristanchayne.com site. Never prunes images or caches: the previous image is removed by its exact ID only.
#   powershell -File work/deploy-ams-service.ps1 [-Nginx]
param([switch]$Nginx)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$key = Join-Path $env:USERPROFILE '.ssh/ams_server'
$server = 'root@165.99.43.244'
$stage = Join-Path ([IO.Path]::GetTempPath()) ('ams-service-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path "$stage/ams-notify/activation" | Out-Null
foreach ($item in 'Dockerfile', 'compose.yml', 'package.json', 'README.md', 'ams-notify.env.example', '.dockerignore', 'src', 'deploy') {
  Copy-Item -Recurse (Join-Path $repo "outputs/ams-notify/$item") "$stage/ams-notify/"
}
foreach ($file in 'worker.mjs', 'review-demo.mjs', 'review-seed.mjs', 'ios-public-config.mjs') {
  Copy-Item (Join-Path $repo "outputs/ams-activation-tencent/src/$file") "$stage/ams-notify/activation/"
}
Copy-Item (Join-Path $repo 'outputs/ams-activation-tencent/schema.sql') "$stage/ams-notify/activation/"
$archive = Join-Path $stage 'ams-service.tar.gz'
tar -czf $archive -C $stage ams-notify
if ($LASTEXITCODE) { throw 'tar failed' }
$remote = @'
set -e
cd /opt/ams-notify
OLD=$(docker image inspect -f '{{.Id}}' ams-notify:local 2>/dev/null || true)
mkdir -p backups && tar -czf backups/source-$(date +%Y%m%d-%H%M%S).tar.gz --exclude=./data --exclude=./backups .
rm -rf src test activation deploy
tar -xzf /tmp/ams-service.tar.gz --strip-components=1 -C /opt/ams-notify
rm -f /tmp/ams-service.tar.gz
docker compose up -d --build
for i in $(seq 1 20); do sleep 2; curl -fsS http://127.0.0.1:18640/api/notify/health && break; done
NEW=$(docker image inspect -f '{{.Id}}' ams-notify:local)
if [ -n "$OLD" ] && [ "$OLD" != "$NEW" ]; then docker image rm "$OLD" >/dev/null 2>&1 || true; fi
docker logs --tail 5 ams-notify
'@
if ($Nginx) { $remote += "`npython3 /opt/ams-notify/deploy/nginx_api.py" }
[IO.File]::WriteAllText("$stage/ams-deploy.sh", $remote.Replace("`r", '') + "`n", (New-Object Text.UTF8Encoding $false))
scp -i $key -o BatchMode=yes $archive "$stage/ams-deploy.sh" "${server}:/tmp/"
if ($LASTEXITCODE) { throw 'upload failed' }
ssh -i $key -o BatchMode=yes $server 'bash /tmp/ams-deploy.sh; rc=$?; rm -f /tmp/ams-deploy.sh; exit $rc'
if ($LASTEXITCODE) { throw 'remote deploy failed' }
Remove-Item -Recurse -Force $stage
