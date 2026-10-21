package cn.local.ams;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.util.Locale;

final class Activation {
    // Temporary client cadence; existing installations also switch to two days.
    static final int CHECK_INTERVAL_DAYS = 2;
    static final class LicenseException extends IOException {
        LicenseException(String message) { super(message); }
    }
    static String errorText(Exception error) {
        if (error instanceof LicenseException) return error.getMessage();
        if (error instanceof java.net.UnknownHostException) return "无法找到激活服务器，请切换网络后用原码重试。";
        if (error instanceof java.net.SocketTimeoutException || error instanceof java.net.ConnectException)
            return "连接激活服务器超时，请切换 Wi-Fi／移动数据，或临时开启已有代理后用原码重试。网络恢复后可重试。";
        if (error instanceof javax.net.ssl.SSLException) return "无法建立安全连接，请检查网络和手机时间后重试。";
        return "激活未完成，请检查网络后用原码重试；仍无法连接时请联系创作者。";
    }
    private static final String ALIAS = "ams.install.activation.v1";
    private static final int B64 = Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING;
    static String base64(byte[] bytes) { return Base64.encodeToString(bytes, B64); }
    static byte[] decode(String value) { return Base64.decode(value, B64); }
    static JSONObject config(Context context) throws Exception {
        try (InputStream input = context.getAssets().open("activation-config.json")) {
            return new JSONObject(read(input, 8192));
        }
    }
    static String read(InputStream input, int limit) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream(); byte[] buffer = new byte[1024]; int n;
        while ((n = input.read(buffer)) != -1) {
            if (output.size() + n > limit) throw new LicenseException("响应过长");
            output.write(buffer, 0, n);
        }
        return output.toString("UTF-8");
    }
    static KeyStore store() throws Exception { KeyStore s = KeyStore.getInstance("AndroidKeyStore"); s.load(null); return s; }
    static File marker(Context context) { return new File(context.getNoBackupFilesDir(), "activation-install-v1"); }
    static void prepareInstall(Context context) throws Exception {
        // A missing app-private marker means a fresh install/data reset. Do not reuse an orphaned key.
        KeyStore s = store();
        if (!marker(context).exists()) {
            if (s.containsAlias(ALIAS)) s.deleteEntry(ALIAS);
            context.getSharedPreferences("activation", 0).edit().clear().commit();
            try (FileOutputStream out = new FileOutputStream(marker(context))) { out.write(1); }
        }
        if (!s.containsAlias(ALIAS)) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                    .setKeySize(2048).setDigests(KeyProperties.DIGEST_SHA256)
                    .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1).build());
            generator.generateKeyPair();
        }
    }
    static String fingerprint(byte[] encoded) throws Exception {
        StringBuilder result = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(encoded)) result.append(String.format(Locale.ROOT, "%02x", b & 255));
        return result.toString();
    }
    static boolean verify(Context context, String grant) {
        try {
            if (!marker(context).exists() || grant == null || grant.length() > 4096) return false;
            KeyStore s = store(); if (!s.containsAlias(ALIAS)) return false;
            String[] parts = grant.split("\\.", -1); if (parts.length != 2) return false;
            PublicKey server = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decode(config(context).getString("publicKey"))));
            Signature signature = Signature.getInstance("SHA256withRSA"); signature.initVerify(server);
            signature.update(parts[0].getBytes(StandardCharsets.UTF_8));
            if (!signature.verify(decode(parts[1]))) return false;
            JSONObject payload = new JSONObject(new String(decode(parts[0]), StandardCharsets.UTF_8));
            return payload.getInt("v") == 1 && "cn.local.ams".equals(payload.getString("app"))
                    && fingerprint(s.getCertificate(ALIAS).getPublicKey().getEncoded()).equals(payload.getString("device"));
        } catch (Exception e) { return false; }
    }
    static boolean valid(Context context) { return !context.getSharedPreferences("activation", 0).getBoolean("revoked", false) && verify(context, context.getSharedPreferences("activation", 0).getString("grant", "")); }
    static void activate(Context context, String input) throws Exception {
        String code = input.trim().toUpperCase(Locale.ROOT);
        if (!code.matches("AMS-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}")) throw new LicenseException("请检查激活码格式");
        JSONObject settings = config(context); String endpoint = settings.getString("endpoint");
        if (endpoint.isEmpty()) throw new LicenseException("激活服务尚未配置");
        URL url = new URL(endpoint);
        if (!"https".equals(url.getProtocol()) || url.getHost().isEmpty() || url.getUserInfo() != null) throw new LicenseException("激活服务尚未配置");
        prepareInstall(context); KeyStore s = store();
        Signature proof = Signature.getInstance("SHA256withRSA"); proof.initSign((PrivateKey)s.getKey(ALIAS, null));
        proof.update(("AMS-ACTIVATE-1\n" + code).getBytes(StandardCharsets.UTF_8));
        JSONObject request = new JSONObject().put("code", code)
                .put("publicKey", base64(s.getCertificate(ALIAS).getPublicKey().getEncoded()))
                .put("proof", base64(proof.sign()));
        HttpURLConnection connection = (HttpURLConnection)url.openConnection();
        connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
        connection.setInstanceFollowRedirects(false); connection.setRequestMethod("POST"); connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        byte[] bytes = request.toString().getBytes(StandardCharsets.UTF_8); connection.setFixedLengthStreamingMode(bytes.length);
        try {
            try (OutputStream out = connection.getOutputStream()) { out.write(bytes); }
            int status = connection.getResponseCode();
            InputStream response = status == 200 ? connection.getInputStream() : connection.getErrorStream();
            if (response == null) throw new LicenseException("激活服务暂不可用，请稍后重试");
            JSONObject data; try (InputStream in = response) { data = new JSONObject(read(in, 8192)); }
            if (status != 200) throw new LicenseException(data.optString("message", "激活未完成，请稍后重试"));
            String grant = data.getString("grant");
            if (!verify(context, grant)) throw new LicenseException("授权校验失败，请联系创作者");
            if (!context.getSharedPreferences("activation", 0).edit().putString("grant", grant).putBoolean("revoked", false).putLong("lastCheck", System.currentTimeMillis()).putLong("lastAttempt", 0).putInt("intervalDays", CHECK_INTERVAL_DAYS).remove("release").commit()) throw new LicenseException("授权未保存，请用原码重试");
        } finally { connection.disconnect(); }
    }
    static boolean due(long now, long last, long attempt, int days) {
        long interval = Math.max(1, Math.min(365, days)) * 86400000L;
        if (last > 0 && now >= last && now - last < interval) return false;
        return !(attempt > 0 && now >= attempt && now - attempt < 3600000L);
    }
    static synchronized boolean checkDue(Context context) {
        android.content.SharedPreferences p = context.getSharedPreferences("activation", 0);
        long now = System.currentTimeMillis(), last = p.getLong("lastCheck", 0), attempt = p.getLong("lastAttempt", 0);
        if (!due(now, last, attempt, CHECK_INTERVAL_DAYS)) return false;
        p.edit().putLong("lastAttempt", now).apply();
        return true;
    }
    static boolean check(Context context) throws Exception {
        android.content.SharedPreferences prefs = context.getSharedPreferences("activation", 0);
        String grant = prefs.getString("grant", "");
        if (!verify(context, grant)) return false;
        byte[] random = new byte[24]; new SecureRandom().nextBytes(random); String nonce = base64(random);
        KeyStore s = store();
        Signature proof = Signature.getInstance("SHA256withRSA"); proof.initSign((PrivateKey)s.getKey(ALIAS, null));
        proof.update(("AMS-CHECK-1\n" + grant + "\n" + nonce).getBytes(StandardCharsets.UTF_8));
        JSONObject request = new JSONObject().put("grant", grant).put("nonce", nonce)
                .put("publicKey", base64(s.getCertificate(ALIAS).getPublicKey().getEncoded())).put("proof", base64(proof.sign()));
        URL url = new URL(new URL(config(context).getString("endpoint")), "/api/check");
        if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null) throw new IOException("Invalid endpoint");
        HttpURLConnection connection = (HttpURLConnection)url.openConnection();
        connection.setConnectTimeout(15000); connection.setReadTimeout(15000); connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
        byte[] bytes = request.toString().getBytes(StandardCharsets.UTF_8); connection.setFixedLengthStreamingMode(bytes.length);
        try {
            try (OutputStream out = connection.getOutputStream()) { out.write(bytes); }
            if (connection.getResponseCode() != 200) throw new IOException("Check unavailable");
            JSONObject response; try (InputStream in = connection.getInputStream()) { response = new JSONObject(read(in, 16384)); }
            String[] parts = response.getString("status").split("\\.", -1);
            if (parts.length != 2) throw new IOException("Invalid status");
            PublicKey server = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decode(config(context).getString("publicKey"))));
            Signature signature = Signature.getInstance("SHA256withRSA"); signature.initVerify(server); signature.update(parts[0].getBytes(StandardCharsets.UTF_8));
            if (!signature.verify(decode(parts[1]))) throw new IOException("Invalid signature");
            JSONObject data = new JSONObject(new String(decode(parts[0]), StandardCharsets.UTF_8));
            JSONObject original = new JSONObject(new String(decode(grant.split("\\.")[0]), StandardCharsets.UTF_8));
            if (data.getInt("v") != 1 || !"cn.local.ams".equals(data.getString("app")) || !nonce.equals(data.getString("nonce"))
                    || !original.getString("device").equals(data.getString("device")) || !original.getString("grant").equals(data.getString("grant"))) throw new IOException("Status mismatch");
            int days = data.getInt("intervalDays"); if (days < 1 || days > 365) throw new IOException("Invalid interval");
            boolean enabled = data.getBoolean("enabled");
            // Ignore replies from an installation grant that changed during the request.
            if (!grant.equals(prefs.getString("grant", ""))) return false;
            if (!prefs.edit().putLong("lastCheck", System.currentTimeMillis()).putInt("intervalDays", CHECK_INTERVAL_DAYS)
                    .putBoolean("revoked", !enabled).putString("release", data.getJSONObject("release").toString()).commit()) throw new IOException("Save failed");
            return !enabled;
        } finally { connection.disconnect(); }
    }

    /** The server has no per-open check (older deployment): the periodic legacy check applies. */
    static final class CheckUnsupported extends IOException { CheckUnsupported() { super("Per-open check unavailable"); } }

    /** Current school account from the saved AMS session (amsuserInfo.account); null when signed out. */
    static String account(String session) {
        try {
            String name = session == null || session.isEmpty() ? "" : new JSONObject(session).optString("account", "").trim();
            return name.isEmpty() || name.length() > 120 ? null : name;
        } catch (Exception e) { return null; }
    }
    /** Records a login, switch or logout. The newer revision lets the server drop late requests sent for the old account. */
    static synchronized boolean noteAccount(Context context, String name) {
        android.content.SharedPreferences p = context.getSharedPreferences("activation", 0);
        String old = p.getString("accountName", null);
        if (old == null ? name == null : old.equals(name)) return false;
        p.edit().putString("accountName", name).putInt("accountRevision", p.getInt("accountRevision", 0) + 1).commit();
        return true;
    }

    /** One server round trip on every cold start / return to foreground; falls back to the legacy check on older servers. */
    static boolean refresh(Context context) throws Exception {
        try { return clientCheck(context); }
        catch (CheckUnsupported e) { return checkDue(context) && check(context); }
    }

    /** Per-open check (protocol 2): signed authorization (code and this device), account sync, announcements, release. */
    static boolean clientCheck(Context context) throws Exception {
        try { return clientCheck(context, true); }
        catch (CheckInboxUnsupported e) { return clientCheck(context, false); }
    }
    // Keep authorization/account/announcement checks working before the inbox-capable server is deployed.
    static final class CheckInboxUnsupported extends IOException {}
    private static boolean clientCheck(Context context, boolean inbox) throws Exception {
        android.content.SharedPreferences prefs = context.getSharedPreferences("activation", 0);
        String grant = prefs.getString("grant", "");
        if (!verify(context, grant)) return false;
        String name; int revision;
        synchronized (Activation.class) { name = prefs.getString("accountName", null); revision = prefs.getInt("accountRevision", 0); }
        byte[] random = new byte[24]; new SecureRandom().nextBytes(random); String nonce = base64(random);
        KeyStore s = store();
        Signature proof = Signature.getInstance("SHA256withRSA"); proof.initSign((PrivateKey)s.getKey(ALIAS, null));
        String version = "";
        try { android.content.pm.PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0); version = info.versionName + " (" + info.versionCode + ")"; } catch (Exception ignored) {}
        if (version.length() > 40) version = version.substring(0, 40);
        String model = (android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL).trim();
        if (model.length() > 80) model = model.substring(0, 80);
        String bundle = context.getPackageName();
        org.json.JSONArray readMessages = MessageInbox.readIds(prefs);
        // The proof covers the account and device metadata, so they cannot be written for another installation.
        proof.update(("AMS-CHECK-2\n" + grant + "\n" + nonce + "\nandroid\n" + revision + "\n" + (name == null ? "" : name)
                + "\n" + bundle + "\n" + version + "\n" + model + (inbox ? "\nAMS-INBOX-1\n" + readMessages : "")).getBytes(StandardCharsets.UTF_8));
        JSONObject request = new JSONObject().put("grant", grant).put("nonce", nonce).put("platform", "android")
                .put("account", new JSONObject().put("name", name == null ? JSONObject.NULL : name).put("revision", revision))
                .put("publicKey", base64(s.getCertificate(ALIAS).getPublicKey().getEncoded())).put("proof", base64(proof.sign()))
                .put("appVersion", version).put("model", model).put("bundleId", bundle);
        if (inbox) request.put("readMessageIds", readMessages);
        URL url = new URL(new URL(config(context).getString("endpoint")), "/api/client/check");
        if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null) throw new IOException("Invalid endpoint");
        HttpURLConnection connection = (HttpURLConnection)url.openConnection();
        connection.setConnectTimeout(10000); connection.setReadTimeout(10000); connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
        byte[] bytes = request.toString().getBytes(StandardCharsets.UTF_8); connection.setFixedLengthStreamingMode(bytes.length);
        try {
            try (OutputStream out = connection.getOutputStream()) { out.write(bytes); }
            int code = connection.getResponseCode();
            if (code == 404 || code == 405) throw new CheckUnsupported();
            if (code == 400 && inbox) throw new CheckInboxUnsupported();
            if (code != 200) throw new IOException("Check unavailable");
            JSONObject response; try (InputStream in = connection.getInputStream()) { response = new JSONObject(read(in, 262144)); }
            String[] parts = response.getString("status").split("\\.", -1);
            if (parts.length != 2) throw new IOException("Invalid status");
            PublicKey server = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decode(config(context).getString("publicKey"))));
            Signature signature = Signature.getInstance("SHA256withRSA"); signature.initVerify(server); signature.update(parts[0].getBytes(StandardCharsets.UTF_8));
            if (!signature.verify(decode(parts[1]))) throw new IOException("Invalid signature");
            JSONObject data = new JSONObject(new String(decode(parts[0]), StandardCharsets.UTF_8));
            JSONObject original = new JSONObject(new String(decode(grant.split("\\.")[0]), StandardCharsets.UTF_8));
            if (data.getInt("v") != 2 || !"cn.local.ams".equals(data.getString("app")) || !nonce.equals(data.getString("nonce"))
                    || !original.getString("device").equals(data.getString("device")) || !original.getString("grant").equals(data.getString("grant"))) throw new IOException("Status mismatch");
            boolean enabled = data.getBoolean("enabled");
            if (!grant.equals(prefs.getString("grant", ""))) return false;
            // Announcements and release info are read from the signed status only.
            android.content.SharedPreferences.Editor edit = prefs.edit().putLong("lastCheck", System.currentTimeMillis()).putBoolean("revoked", !enabled)
                    .putString("installationId", data.optString("installationId", ""))
                    .putString("announcements", data.optJSONArray("announcements") == null ? "[]" : data.getJSONArray("announcements").toString())
                    .putString("messages", data.optJSONArray("messages") == null ? "[]" : data.getJSONArray("messages").toString());
            JSONObject release = data.optJSONObject("release");
            if (release != null && release.optJSONObject("android") != null) edit.putString("release", release.getJSONObject("android").toString());
            synchronized (Activation.class) {
                // Never fall behind the server's revision, so the next account change is accepted.
                JSONObject account = data.optJSONObject("account");
                int serverRevision = account == null ? 0 : account.optInt("revision", 0);
                if (serverRevision > prefs.getInt("accountRevision", 0)) edit.putInt("accountRevision", serverRevision);
                if (!edit.commit()) throw new IOException("Save failed");
            }
            return !enabled;
        } finally { connection.disconnect(); }
    }
}
