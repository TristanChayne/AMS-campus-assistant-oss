"""Read-only anonymous school initialization diagnostic; never submits credentials."""
import http.cookiejar
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = 'https://uim.xjtlu.edu.cn'
events = []

def safe_url(url):
    p = urllib.parse.urlsplit(url)
    if p.scheme != 'https' or p.hostname not in ('ams.xjtlu.edu.cn', 'uim.xjtlu.edu.cn'):
        raise ValueError('Unexpected redirect host')
    return p.hostname + p.path

class Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urllib.parse.urljoin(req.full_url, newurl)
        events.append({'redirectStatus': code, 'from': safe_url(req.full_url), 'to': safe_url(target)})
        return super().redirect_request(req, fp, code, msg, headers, target)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), Redirects())

def get(url, label, sdk=False):
    safe_url(url)
    headers = {'Accept': 'application/json, text/html', 'User-Agent': 'AMS-Anonymous-Diagnostic/1.0'}
    if sdk:
        url += ('&' if '?' in url else '?') + '_=' + str(int(time.time() * 1000))
        headers.update({'Content-Type': 'application/json; charset=utf-8', 'Accept-Language': 'zh-CN', 'language': 'zh-CN'})
    req = urllib.request.Request(url, headers=headers)
    try:
        response = opener.open(req, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read(2_000_000)
    result = {'step': label, 'url': safe_url(url), 'final': safe_url(response.geturl()), 'http': response.code,
              'type': response.headers.get_content_type(), 'cookies': [{'name': c.name, 'domain': c.domain, 'path': c.path, 'secure': c.secure} for c in jar]}
    try:
        body = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        body = None
    if isinstance(body, dict):
        code = body.get('code')
        if isinstance(code, int) or code in ('0', 'SSO10034'):
            result['businessCode'] = code
    events.append(result)
    return body

try:
    entry = get('https://ams.xjtlu.edu.cn/xjtlu/sso/mobile/iam/login', 'AMS entry')
    address = entry.get('data') if isinstance(entry, dict) else None
    if not isinstance(address, str):
        raise ValueError('Entry did not return authorize address')
    safe_url(address)
    get(ROOT + '/esc-sso/login/page', 'Initialize page')
    get(address, 'Authorize')
    get(ROOT + '/ngw/context', 'SDK context', sdk=True)
    get(ROOT + '/esc-sso/api/v3/auth/language/list', 'SDK languages', sdk=True)
    get(ROOT + '/esc-sso/api/v3/auth/dict', 'SDK dictionary', sdk=True)
    policy = get(ROOT + '/esc-sso/api/v3/auth/policy', 'Policy', sdk=True)
    if isinstance(policy, dict) and isinstance(policy.get('data'), dict):
        otp = policy['data'].get('login', {}).get('webOtpAuth', {})
        events.append({'otpPolicy': {k: otp.get(k) for k in ('status', 'passwordType', 'otpLength')}})
        login = policy['data'].get('login', {})
        events.append({'loginMethods': {name: {'status': item.get('status')} for name, item in login.items() if isinstance(item, dict)},
                       'config': {k: policy['data'].get('config', {}).get(k) for k in ('shareSession', 'defaultLoginType', 'loginMethod', 'loginStatus')}})
except Exception as error:
    events.append({'stopped': type(error).__name__})

destination = Path(__file__).resolve().parents[1] / 'outputs/ams-auth-investigation/匿名初始化检查-20261008.json'
destination.write_text(json.dumps({'note': 'GET only; no credentials, cookie values, raw responses or query parameters saved', 'events': events}, ensure_ascii=False, indent=2), encoding='utf-8')
print(destination.read_text(encoding='utf-8'))
