package cn.local.ams;

import android.content.SharedPreferences;
import java.time.Instant;
import java.util.LinkedHashSet;
import org.json.JSONArray;
import org.json.JSONObject;

/** D-023: messages obtained inside the signed foreground check; no remote push SDK. */
final class MessageInbox {
    private MessageInbox() {}
    static JSONArray readIds(SharedPreferences prefs) {
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        try {
            JSONArray saved = new JSONArray(prefs.getString("messageReadIds", "[]"));
            for (int i = 0; i < saved.length(); i++) {
                String id = saved.optString(i, "");
                if (id.matches("msg-[A-Za-z0-9_-]{1,96}")) ids.add(id);
            }
        } catch (Exception ignored) {}
        while (ids.size() > 100) ids.remove(ids.iterator().next());
        return new JSONArray(ids);
    }
    static JSONObject next(SharedPreferences prefs, long now) {
        JSONArray read = readIds(prefs);
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (int i = 0; i < read.length(); i++) seen.add(read.optString(i));
        try {
            JSONArray messages = new JSONArray(prefs.getString("messages", "[]"));
            for (int i = 0; i < messages.length(); i++) {
                JSONObject message = messages.optJSONObject(i);
                if (message == null) continue;
                String id = message.optString("id", "");
                if (!id.matches("msg-[A-Za-z0-9_-]{1,96}") || seen.contains(id)) continue;
                try {
                    String expiry = message.isNull("expiresAt") ? "" : message.optString("expiresAt", "");
                    if (!expiry.isEmpty() && Instant.parse(expiry).toEpochMilli() <= now) continue;
                    return message;
                } catch (Exception ignored) { /* A malformed item must not block the next valid one. */ }
            }
        } catch (Exception ignored) {}
        return null;
    }
    static void confirm(SharedPreferences prefs, String id) {
        if (!id.matches("msg-[A-Za-z0-9_-]{1,96}")) return;
        JSONArray old = readIds(prefs);
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        for (int i = 0; i < old.length(); i++) ids.add(old.optString(i));
        ids.add(id);
        while (ids.size() > 100) ids.remove(ids.iterator().next());
        prefs.edit().putString("messageReadIds", new JSONArray(ids).toString()).apply();
    }
}
