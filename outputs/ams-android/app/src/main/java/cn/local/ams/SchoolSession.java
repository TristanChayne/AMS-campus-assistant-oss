package cn.local.ams;

import android.app.Activity;
import android.content.Context;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Keeps the AMS web session the school already issued (sessionStorage.amsuserInfo), encrypted with an independent
 * Keystore key. Mirrors iOS session.js: no password or OTP, no cross-site token copying, no cookie scope or lifetime
 * change. The school still validates every request and its 401 clears the copy.
 * Seat / room are deliberately excluded: their servers gate every document with the UIM cookie session and the
 * page trusts a restored userInfo without re-exchanging it, so a stale copy left those pages loading forever.
 */
final class SchoolSession {
    static final String AMS = "ams.xjtlu.edu.cn";
    static final String AMS_HOME = "https://ams.xjtlu.edu.cn/studenth5/#/home";
    static final String BRIDGE = "AmsSchoolSession";
    private static final List<String> RETIRED_HOSTS = Arrays.asList("seatbookings.xjtlu.edu.cn", "roombookings.xjtlu.edu.cn");
    private static final List<String> SECRET_FIELDS = Arrays.asList("password", "passwd", "otp", "verificationcode");
    private static final String ALIAS = "ams.school.session", PREFS = "schoolSession", RESTORE_PATH = "/__campus/session-restore";
    private static final int LIMIT = 65536;
    private static final Map<String, String> pendingRestores = new HashMap<>();
    private static long generation;
    private static String hookScript, restoreTemplate;

    private SchoolSession() {}

    private static SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }

    static synchronized String read(Context context) {
        android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String value = prefs.getString(AMS + ".value", "");
        if (value.isEmpty()) return "";
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(prefs.getString(AMS + ".iv", ""), Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(value, Base64.NO_WRAP)), "UTF-8");
        } catch (Exception e) { clear(context); return ""; }
    }

    private static synchronized void write(Context context, String plain) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] value = cipher.doFinal(plain.getBytes("UTF-8"));
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(AMS + ".iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .putString(AMS + ".value", Base64.encodeToString(value, Base64.NO_WRAP)).commit();
        } catch (Exception e) { clear(context); }
    }

    static synchronized void clear(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(AMS + ".iv").remove(AMS + ".value").commit();
    }

    /** Copies saved by the first test build for seat / room are discarded, never restored. */
    private static synchronized void discardRetired(Context context) {
        android.content.SharedPreferences.Editor editor = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        for (String host : RETIRED_HOSTS) editor.remove(host + ".iv").remove(host + ".value");
        editor.commit();
    }

    /** Explicit AMS logout: forget the saved session and stop pages created before it from saving again. */
    static synchronized void clearAll(Context context) {
        generation++;
        synchronized (pendingRestores) { pendingRestores.clear(); }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().commit();
    }

    /** Stored form is the sanitized amsuserInfo object; it must carry the school's token. */
    static String sanitized(String raw) {
        if (raw == null || raw.isEmpty() || raw.length() > LIMIT) return "";
        try {
            JSONObject user = new JSONObject(raw);
            if (user.optString("token", "").isEmpty()) return "";
            for (Iterator<String> keys = user.keys(); keys.hasNext();) if (SECRET_FIELDS.contains(keys.next().toLowerCase(java.util.Locale.ROOT))) keys.remove();
            return user.toString();
        } catch (Exception e) { return ""; }
    }

    static String token(String stored) {
        try { return stored.isEmpty() ? "" : new JSONObject(stored).optString("token", ""); }
        catch (Exception e) { return ""; }
    }

    private static String asset(Context context, String name) {
        try (InputStream in = context.getAssets().open(name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toString("UTF-8");
        } catch (Exception e) { return ""; }
    }

    static boolean restorePage(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        return "https".equals(uri.getScheme()) && AMS.equals(uri.getHost()) && RESTORE_PATH.equals(uri.getPath());
    }

    /**
     * Every new AMS WebView starts with empty sessionStorage, including Activity recreation (restoreState keeps
     * history only). A one-shot local page on the AMS origin writes the saved session, then replaces itself.
     */
    static String amsRestoreUrl(Context context) {
        discardRetired(context);
        String stored = read(context);
        if (stored.isEmpty()) return null;
        if (restoreTemplate == null) restoreTemplate = asset(context, "school-session-restore.html");
        if (!restoreTemplate.contains("__SESSION_ITEMS__") || !restoreTemplate.contains("__TARGET__")) return null;
        try {
            // Target first: the session value itself must never be scanned for a placeholder.
            String html = restoreTemplate.replace("__TARGET__", JSONObject.quote(AMS_HOME))
                .replace("__SESSION_ITEMS__", new JSONObject().put("amsuserInfo", stored).toString());
            byte[] random = new byte[24]; new SecureRandom().nextBytes(random);
            String nonce = Base64.encodeToString(random, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            synchronized (pendingRestores) { pendingRestores.put(nonce, html); }
            return "https://" + AMS + RESTORE_PATH + "?n=" + nonce;
        } catch (Exception e) { return null; }
    }

    /** Never lets the restore path reach the school server; serves each prepared page once, to a main-frame GET only. */
    static WebResourceResponse restoreResponse(WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!"https".equals(uri.getScheme()) || !AMS.equals(uri.getHost()) || !RESTORE_PATH.equals(uri.getPath())) return null;
        String html = null;
        if (request.isForMainFrame() && "GET".equalsIgnoreCase(request.getMethod()) && uri.getQueryParameter("n") != null) {
            synchronized (pendingRestores) { html = pendingRestores.remove(uri.getQueryParameter("n")); }
        }
        // A reused or replayed restore URL carries no session; it simply continues to the site's normal entry.
        if (html == null) html = "<!doctype html><meta charset=\"utf-8\"><script>location.replace('/')</script>";
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("Referrer-Policy", "no-referrer");
        byte[] body = new byte[0];
        try { body = html.getBytes("UTF-8"); } catch (Exception ignored) {}
        return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, new ByteArrayInputStream(body));
    }

    /** Called from a page's own JavaScript; it only signals. The session value is read from the main frame by native code. */
    static final class Bridge {
        private final Activity activity;
        private final WebView page;
        private long createdGeneration;
        private Runnable saved;
        Bridge(Activity activity, WebView page) { this.activity = activity; this.page = page; renew(); }
        /** Runs on the UI thread after the stored session changed (login, renewal, school sign-out). */
        void onSaved(Runnable callback) { saved = callback; }
        void renew() { synchronized (SchoolSession.class) { createdGeneration = generation; } }
        @JavascriptInterface public void changed() { activity.runOnUiThread(this::sync); }
        @JavascriptInterface public void expired(String token) {
            if (token == null || token.isEmpty() || token.length() > LIMIT) return;
            activity.runOnUiThread(() -> { if (token.equals(token(read(activity)))) { clear(activity); if (saved != null) saved.run(); } });
        }
        private boolean amsPage(String url) {
            if (url == null || restorePage(url)) return false;
            Uri uri = Uri.parse(url);
            return "https".equals(uri.getScheme()) && AMS.equals(uri.getHost());
        }
        /** Saves only from the AMS main frame; an AMS page without a token means the school signed out. */
        void sync() {
            if (activity.isFinishing() || activity.isDestroyed() || !amsPage(page.getUrl())) return;
            page.evaluateJavascript("sessionStorage.getItem('amsuserInfo')||''", value -> {
                if (activity.isFinishing() || activity.isDestroyed() || !amsPage(page.getUrl())) return;
                synchronized (SchoolSession.class) { if (createdGeneration != generation) return; }
                String raw;
                try { raw = new JSONArray("[" + value + "]").getString(0); } catch (Exception e) { return; }
                String clean = sanitized(raw);
                if (!clean.isEmpty()) { if (!clean.equals(read(activity))) { write(activity, clean); if (saved != null) saved.run(); } }
                else if (raw.isEmpty()) { clear(activity); if (saved != null) saved.run(); }
            });
        }
        /** Hook installation is idempotent per document; it reports the current state once. */
        void install() {
            if (!amsPage(page.getUrl())) return;
            if (hookScript == null) hookScript = asset(activity, "school-session.js");
            if (!hookScript.isEmpty()) page.evaluateJavascript(hookScript, null);
        }
    }
}
