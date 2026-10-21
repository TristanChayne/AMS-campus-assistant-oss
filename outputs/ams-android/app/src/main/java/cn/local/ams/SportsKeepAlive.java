package cn.local.ams;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.CookieManager;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;

/**
 * User-enabled keep-alive for the sports centre session. While the app is away, an inexact alarm repeats the same
 * read-only login-state query the official page sends every 15 minutes, using the WebView's existing session cookie.
 * No password, OTP or extra cookie copy is kept; the cookie scope and lifetime are untouched. It stops as soon as the
 * server reports the session ended, after the chosen number of days without opening sports, on AMS logout, or when
 * switched off in settings. Doze may still defer alarms, so a session can expire while the phone sleeps.
 */
final class SportsKeepAlive {
    static final String SITE = "https://sportscentre.xipueduinno.cn/website/";
    private static final String QUERY = SITE + "netUser/queryUserInfo?lang=zh_cn";
    private static final String PREFS = "sportsKeepAlive";
    static final long INTERVAL = 10 * 60 * 1000L;
    private static final long DAY = 24 * 60 * 60 * 1000L;

    interface Result { void done(Boolean signedIn); }

    private SportsKeepAlive() {}

    private static SharedPreferences prefs(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    /** Nothing runs until the user chooses, either in the first-login prompt or in settings. */
    static boolean decided(Context context) { return prefs(context).getBoolean("decided", false); }
    static boolean enabled(Context context) { return decided(context) && prefs(context).getBoolean("enabled", true); }
    static int days(Context context) { int d = prefs(context).getInt("days", 3); return d == 5 || d == 7 ? d : 3; }

    static void setPreference(Context context, boolean enabled, int days) {
        prefs(context).edit().putBoolean("decided", true).putBoolean("enabled", enabled).putInt("days", days == 5 || days == 7 ? days : 3).apply();
        if (!enabled) cancel(context);
    }

    /** Opening sports restarts the inactivity window. */
    static void sportsOpened(Context context) { prefs(context).edit().putLong("lastOpen", System.currentTimeMillis()).apply(); }

    private static boolean withinWindow(Context context) {
        long last = prefs(context).getLong("lastOpen", 0);
        return last > 0 && System.currentTimeMillis() - last < days(context) * DAY;
    }

    private static PendingIntent intent(Context context) {
        Intent intent = new Intent(context, SportsKeepAliveReceiver.class).setPackage(context.getPackageName());
        return PendingIntent.getBroadcast(context, 7301, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Called when sports leaves the foreground; the first answer decides whether there is a session to keep. */
    static void schedule(Context context) {
        if (!enabled(context) || !withinWindow(context)) { cancel(context); return; }
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + INTERVAL, intent(context));
        prefs(context).edit().putLong("nextDue", System.currentTimeMillis() + INTERVAL).apply();
    }

    /**
     * Opening the main screen confirms the alarm is still there and re-arms it if not. Alarms are lost when the app is
     * updated, force-stopped or the phone restarts, none of which tells the app. Only an enabled keep-alive with a
     * session last seen signed in, inside its day window, is re-armed; a signed-out answer or a switch-off stays stopped.
     */
    static void ensureScheduled(Context context) {
        if (!enabled(context) || !withinWindow(context) || !wasSignedIn(context)) return;
        Intent probe = new Intent(context, SportsKeepAliveReceiver.class).setPackage(context.getPackageName());
        boolean exists = PendingIntent.getBroadcast(context, 7301, probe, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE) != null;
        long due = prefs(context).getLong("nextDue", 0);
        // The inexact window plus idle deferral can stretch one round; a due time more than two rounds old was missed.
        boolean armed = exists && due > 0 && System.currentTimeMillis() - due < 2 * INTERVAL;
        if (!armed) schedule(context);
    }

    static void cancel(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(intent(context));
        prefs(context).edit().remove("nextDue").apply();
    }

    /** AMS logout ends sports keep-alive and forgets the remembered state. */
    static void reset(Context context) {
        cancel(context);
        prefs(context).edit().remove("signedIn").remove("expired").apply();
    }

    static void markSignedIn(Context context, boolean signedIn) {
        SharedPreferences.Editor editor = prefs(context).edit().putBoolean("signedIn", signedIn);
        if (signedIn) editor.remove("expired"); else if (prefs(context).getBoolean("signedIn", false)) editor.putBoolean("expired", true);
        editor.apply();
    }

    /** Outcome of the latest check only (time, answer, HTTP status, exception class); never cookies or response bodies. */
    private static void record(Context context, Boolean signedIn, int http, String error) {
        SharedPreferences preferences = prefs(context);
        preferences.edit().putLong("lastCheck", System.currentTimeMillis())
            .putString("lastResult", signedIn == null ? "unknown" : signedIn ? "in" : "out")
            .putInt("lastHttp", http).putString("lastError", error == null ? "" : error)
            .putInt("checks", preferences.getInt("checks", 0) + 1).apply();
        android.util.Log.i("AmsKeepAlive", "check result=" + (signedIn == null ? "unknown" : signedIn ? "in" : "out") + " http=" + http + (error == null || error.isEmpty() ? "" : " error=" + error));
    }

    /** One line for the settings card. */
    static String lastSummary(Context context) {
        SharedPreferences preferences = prefs(context);
        long time = preferences.getLong("lastCheck", 0);
        if (time == 0) return "";
        String clock = new java.text.SimpleDateFormat("MM-dd HH:mm", java.util.Locale.ROOT).format(new java.util.Date(time));
        String result = preferences.getString("lastResult", "unknown");
        if ("in".equals(result)) return "上次确认 " + clock + "：仍在登录";
        if ("out".equals(result)) return "上次确认 " + clock + "：体育中心已退出登录";
        String reason = preferences.getInt("lastHttp", 0) > 0 ? "HTTP " + preferences.getInt("lastHttp", 0) : preferences.getString("lastError", "");
        return "上次尝试 " + clock + "：未取得结果" + (reason.isEmpty() ? "" : "（" + reason + "）");
    }

    static boolean wasSignedIn(Context context) { return prefs(context).getBoolean("signedIn", false); }

    /** True once after a remembered session was found ended. */
    static boolean consumeExpired(Context context) {
        boolean expired = prefs(context).getBoolean("expired", false);
        if (expired) prefs(context).edit().remove("expired").apply();
        return expired;
    }

    /**
     * Reads the WebView cookie on the main thread, queries off it, and reports on the main thread:
     * TRUE signed in, FALSE signed out (loginTag "0"), null unknown (offline, server error, unexpected reply).
     */
    static void check(Context context, Result result) {
        Context app = context.getApplicationContext();
        Handler main = new Handler(Looper.getMainLooper());
        main.post(() -> {
            String cookie;
            try { cookie = CookieManager.getInstance().getCookie(SITE); } catch (RuntimeException e) { cookie = null; }
            if (cookie == null || !cookie.contains("JSESSIONID=")) { record(app, Boolean.FALSE, 0, "no-cookie"); result.done(Boolean.FALSE); return; }
            final String header = cookie;
            new Thread(() -> {
                Boolean state = null; List<String> renewed = null; int http = 0; String error = "";
                HttpURLConnection c = null;
                try {
                    c = (HttpURLConnection) new URL(QUERY).openConnection();
                    c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(15000);
                    c.setRequestMethod("POST"); c.setDoOutput(true); c.setUseCaches(false);
                    c.setRequestProperty("Cookie", header);
                    c.setRequestProperty("X-Requested-With", "XMLHttpRequest");
                    c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
                    try (OutputStream out = c.getOutputStream()) { out.write(new byte[0]); }
                    http = c.getResponseCode();
                    if (http == 200) {
                        Map<String, List<String>> headers = c.getHeaderFields();
                        for (Map.Entry<String, List<String>> entry : headers.entrySet())
                            if ("set-cookie".equalsIgnoreCase(entry.getKey())) renewed = entry.getValue();
                        try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                            byte[] buffer = new byte[4096]; int n;
                            while ((n = in.read(buffer)) != -1) { if (out.size() + n > 65536) throw new java.io.IOException("Response size"); out.write(buffer, 0, n); }
                            JSONObject body = new JSONObject(out.toString("UTF-8"));
                            if (body.optInt("error", -1) == 0 && body.has("loginTag")) state = !"0".equals(body.optString("loginTag"));
                        }
                    }
                } catch (Exception e) { error = e.getClass().getSimpleName();
                } finally { if (c != null) c.disconnect(); }
                final Boolean answer = state; final List<String> cookies = renewed; final int status = http; final String failure = error;
                main.post(() -> {
                    // A rotated session cookie from the same site replaces the WebView's own copy; nothing else is stored.
                    if (cookies != null) { CookieManager manager = CookieManager.getInstance(); for (String value : cookies) manager.setCookie(SITE, value); manager.flush(); }
                    if (answer != null) markSignedIn(app, answer);
                    record(app, answer, status, failure);
                    result.done(answer);
                });
            }, "sports-keepalive").start();
        });
    }
}
