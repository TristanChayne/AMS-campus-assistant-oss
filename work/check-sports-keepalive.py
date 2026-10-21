"""Static guards for the opt-in sports keep-alive: user choice first, same official read-only query, bounded and stoppable."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
src = root/'outputs/ams-android/app/src/main/java/cn/local/ams'
keep = (src/'SportsKeepAlive.java').read_text(encoding='utf-8')
receiver = (src/'SportsKeepAliveReceiver.java').read_text(encoding='utf-8')
sports = (src/'SportsReservationActivity.java').read_text(encoding='utf-8')
main = (src/'MainActivity.java').read_text(encoding='utf-8')
manifest = (root/'outputs/ams-android/app/src/main/AndroidManifest.xml').read_text(encoding='utf-8')

def section(text, start, end):
    a = text.index(start); return text[a:text.index(end, a + len(start))]

# Nothing runs before the user chooses; preference is validated to 3 / 5 / 7 days.
assert 'return decided(context) && prefs(context).getBoolean("enabled", true);' in keep
assert 'putBoolean("decided", true)' in section(keep, 'static void setPreference(', 'static void sportsOpened(')
assert 'days == 5 || days == 7 ? days : 3' in keep
# Same official read-only query as the page's 15-minute poll, with only the WebView's own cookie; no credentials.
assert 'SITE + "netUser/queryUserInfo?lang=zh_cn"' in keep and 'CookieManager.getInstance().getCookie(SITE)' in keep
code = re.sub(r'/\\*.*?\\*/|//[^\\n]*', '', keep, flags=re.S)
assert not re.search(r'password|otp|captcha|verifyCode|loginObj', code, re.I), 'no credential handling'
assert 'setInstanceFollowRedirects(false)' in keep and 'out.size() + n > 65536' in keep
assert '"0".equals(body.optString("loginTag"))' in keep and 'manager.setCookie(SITE, value)' in keep
logs = re.findall(r'Log\.[dviwe]\s*\([^;]*;', keep + receiver)
assert len(logs) == 1 and 'AmsKeepAlive' in logs[0] and 'header' not in logs[0] and 'cookie' not in logs[0].lower(), 'single status-only log line'
assert 'lastSummary' in keep and 'putString("lastError"' in keep
# Inexact, Doze-tolerant 10-minute alarm; bounded by days since sports was opened; cancellable.
assert 'INTERVAL = 10 * 60 * 1000L' in keep and 'setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP' in keep
assert 'if (!enabled(context) || !withinWindow(context)) { cancel(context); return; }' in keep
assert 'FLAG_IMMUTABLE' in keep and '<receiver android:name=".SportsKeepAliveReceiver" android:exported="false" />' in manifest
assert 'SCHEDULE_EXACT_ALARM' not in manifest and 'FOREGROUND_SERVICE' not in manifest and 'RECEIVE_BOOT_COMPLETED' not in manifest
# Receiver stops on a confirmed signed-out answer, continues on signed-in or unknown.
assert 'if (!Boolean.FALSE.equals(signedIn)) SportsKeepAlive.schedule(context); else SportsKeepAlive.cancel(context);' in receiver and 'pending.finish()' in receiver
# Sports screen: alarms only after leaving; first confirmed login asks once; expired session gets a native prompt.
resume = section(sports, '@Override protected void onResume()', 'private void showKeepAliveChoice()')
pause = section(sports, '@Override protected void onPause()', '@Override protected void onSaveInstanceState(')
assert 'SportsKeepAlive.sportsOpened(this); SportsKeepAlive.cancel(this);' in resume and 'showSessionExpired()' in resume
assert 'SportsKeepAlive.schedule(this)' in pause and 'root.removeCallbacks(loginWatch)' in pause
assert 'Boolean(localStorage.getItem(\'loginObj\'))' in sports and 'Boolean.TRUE.equals(signedIn)' in sports
choice = section(sports, 'private void showKeepAliveChoice()', 'private void showSessionExpired()')
assert '保持体育中心登录？' in choice and '暂不开启' in choice and 'AppDialog.present(this, card, false)' in choice and 'new int[]{3, 5, 7}' in choice
assert 'navigate(1)' in section(sports, 'private void showSessionExpired()', '@Override protected void onPause()')
# Opening the main screen re-arms a lost alarm, only for an enabled, in-window, last-known-signed-in session.
ensure = section(keep, 'static void ensureScheduled(', 'static void cancel(')
assert 'if (!enabled(context) || !withinWindow(context) || !wasSignedIn(context)) return;' in ensure
assert 'PendingIntent.FLAG_NO_CREATE' in ensure and 'getLong("nextDue", 0)' in ensure and 'if (!armed) schedule(context);' in ensure
assert 'remove("nextDue")' in section(keep, 'static void cancel(', 'static void reset(')
resume = main[main.index('@Override protected void onResume()'):]
resume = resume[:resume.index('showVersionNotice();') + len('showVersionNotice();')]
assert 'SportsKeepAlive.ensureScheduled(this);' in resume and resume.index('Activation.valid(this)') < resume.index('ensureScheduled')
# AMS logout ends it; settings route validated.
assert 'SportsKeepAlive.reset(this);' in section(main, 'private void logoutSchool()', 'private void openCreatorEmail()')
assert 'days.matches("[357]")' in main
print('PASS sports keep-alive guards: opt-in after first confirmed login, official read-only query with the WebView cookie only, inexact 10-minute alarm, 3/5/7-day bound, stops on signed-out/logout/off, native expiry prompt.')
print('LIMIT: whether the query extends the server session, and Doze timing on real phones, need device observation.')
