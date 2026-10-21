"""Static guards for Android AMS session persistence, mirroring the iOS session.js boundaries."""
from pathlib import Path
import re, subprocess

root = Path(__file__).resolve().parents[1]
src = root/'outputs/ams-android/app/src/main/java/cn/local/ams'
session = (src/'SchoolSession.java').read_text(encoding='utf-8')
main = (src/'MainActivity.java').read_text(encoding='utf-8')
reservation = (src/'ReservationActivity.java').read_text(encoding='utf-8')
sports = (src/'SportsReservationActivity.java').read_text(encoding='utf-8')
generator = (root/'work/build-live-ui.py').read_text(encoding='utf-8')

def section(text, start, end):
    a = text.index(start)
    return text[a:text.index(end, a + len(start))]

# Storage: independent Keystore AES-GCM key, private prefs, corrupt data discarded, backup disabled.
assert 'ALIAS = "ams.school.session"' in session and 'ams.hht.session' not in session and 'ams.xipuCode.session' not in session
assert 'KeyGenerator.getInstance("AES", "AndroidKeyStore")' in session and 'AES/GCM/NoPadding' in session
assert 'Context.MODE_PRIVATE' in session and 'MODE_WORLD' not in session
assert '} catch (Exception e) { clear(context); return ""; }' in session
assert 'android:allowBackup="false"' in (root/'outputs/ams-android/app/src/main/AndroidManifest.xml').read_text(encoding='utf-8')
# Only the school-issued AMS session; never passwords/OTP; no cookie changes.
assert 'Arrays.asList("password", "passwd", "otp", "verificationcode")' in session
assert not re.search(r'setCookie|CookieManager|expires|Max-Age', session), 'no cookie scope or lifetime change'
# Seat / room are excluded: their pages trust a restored userInfo and stayed loading with a stale copy.
assert 'RETIRED_HOSTS = Arrays.asList("seatbookings.xjtlu.edu.cn", "roombookings.xjtlu.edu.cn")' in session
assert 'discardRetired(context);' in section(session, 'static String amsRestoreUrl(', 'static WebResourceResponse restoreResponse(')
assert 'SchoolSession' not in reservation and 'addJavascriptInterface(' not in reservation and '__campus/session-restore' not in reservation
# Restore page: AMS origin, one-shot nonce, main-frame GET, never forwarded to the school server, not cached.
restore = section(session, 'static String amsRestoreUrl(', 'static WebResourceResponse restoreResponse(')
assert restore.index('.replace("__TARGET__"') < restore.index('.replace("__SESSION_ITEMS__"'), 'target placeholder replaced before the session value'
assert 'new SecureRandom().nextBytes(random)' in restore and 'put("amsuserInfo", stored)' in restore
response = section(session, 'static WebResourceResponse restoreResponse(', 'static final class Bridge')
assert 'request.isForMainFrame() && "GET".equalsIgnoreCase(request.getMethod())' in response
assert '!AMS.equals(uri.getHost())' in response and 'pendingRestores.remove(' in response and 'pendingRestores.get(' not in session
assert 'headers.put("Cache-Control", "no-store")' in response and "location.replace('/')" in response
# Bridge: JS only signals; native reads the AMS main frame; expiry requires the exact saved token; logout generation.
bridge = section(session, 'static final class Bridge', 'void install()')
assert bridge.count('@JavascriptInterface') == 2 and 'token.equals(token(read(activity)))' in bridge
assert "page.evaluateJavascript(\"sessionStorage.getItem('amsuserInfo')||''\"" in bridge
assert 'createdGeneration != generation' in bridge and 'restorePage(url)' in bridge and 'AMS.equals(uri.getHost())' in bridge
assert re.search(r'else if \(raw\.isEmpty\(\)\) \{\s*clear\(activity\);\s*if \(saved != null\) saved\.run\(\);\s*\}', bridge), 'school sign-out clears storage and signals account sync'
assert re.search(r'write\(activity, clean\);\s*if \(saved != null\) saved\.run\(\);', bridge), 'login/account change signals account sync'
assert 'schoolSession.onSaved(this::schoolAccountChanged);' in main
assert 'generation++' in section(session, 'static synchronized void clearAll(', 'static String sanitized(')
assert not re.search(r'Log\.[dviwe]\s*\(', session)
# MainActivity wiring.
assert 'web.addJavascriptInterface(schoolSession, SchoolSession.BRIDGE);' in section(main, 'schoolSession = new SchoolSession.Bridge(this, web);', 'web.setWebViewClient(')
assert 'WebResourceResponse restore = SchoolSession.restoreResponse(request);' in main
assert 'String restore = SchoolSession.amsRestoreUrl(this);' in main
assert 'if (restore != null) web.loadUrl(restore);' in main and 'else if (saved == null || web.restoreState(saved) == null) web.loadUrl(HOME);' in main
logout = section(main, 'private void logoutSchool()', 'private void openCreatorEmail()')
assert logout.index('SchoolSession.clearAll(this)') < logout.index('removeAllCookies') and 'schoolSession.renew()' in logout
assert 'if (!loadFailed) schoolSession.install();' in main and 'schoolSession.sync(); web.onPause();' in main
assert 'web.removeJavascriptInterface(SchoolSession.BRIDGE); web.destroy();' in main
assert 'SchoolSession' not in sports and 'addJavascriptInterface(' not in sports, 'sports keeps its own cookie session and no bridge'
# Generated assets come from work/ sources.
assert "(root/'school-session.js').write_text(Path('work/android-school-session.js')" in generator
assert "(root/'school-session-restore.html').write_text(Path('work/android-school-session-restore.html')" in generator
print('PASS static Android AMS-session guards: Keystore AES-GCM storage, no password/OTP, AMS host only, seat/room without any session bridge or restore page, old copies discarded, one-shot non-cached restore page, token-matched expiry, logout clears and fences older pages, no cookie changes, sports untouched.')
print('LIMIT: real Android WebView restore after force-stop, school token lifetime and 401 handling still need a real device and account.')
