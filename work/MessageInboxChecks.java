package cn.local.ams;

import android.content.SharedPreferences;
import java.util.HashMap;
import org.json.JSONArray;

final class MessageInboxChecks {
    private static void check(boolean ok, String name) { if (!ok) throw new AssertionError(name); }
    static void run() {
        SharedPreferences prefs = CourseReminderChecks.memory(new HashMap<>());
        prefs.edit().putString("messages", "[null,{\"id\":\"msg-bad\",\"expiresAt\":\"wrong\"},{\"id\":\"msg-expired\",\"expiresAt\":\"2020-01-01T00:00:00Z\"},{\"id\":\"msg-first\",\"expiresAt\":null},{\"id\":\"msg-next\"}]").apply();
        check(MessageInbox.next(prefs, 1_700_000_000_000L).optString("id").equals("msg-first"), "skip invalid/expired items, accept null expiry");
        MessageInbox.confirm(prefs, "msg-first"); MessageInbox.confirm(prefs, "msg-first");
        check(MessageInbox.readIds(prefs).length() == 1, "idempotent read confirmation");
        check(MessageInbox.next(prefs, 1_700_000_000_000L).optString("id").equals("msg-next"), "read item does not repeat");
        MessageInbox.confirm(prefs, "msg-next");
        check(MessageInbox.next(prefs, 1_700_000_000_000L) == null, "no unread message remains");
        prefs.edit().putString("messageReadIds", "broken").apply();
        check(MessageInbox.readIds(prefs).length() == 0, "corrupt read state safely recovers");
        for (int i = 0; i < 105; i++) MessageInbox.confirm(prefs, "msg-" + i);
        JSONArray ids = MessageInbox.readIds(prefs);
        check(ids.length() == 100 && ids.optString(0).equals("msg-5") && ids.optString(99).equals("msg-104"), "bounded FIFO acknowledgements");
        prefs.edit().putString("messages", "broken").apply();
        check(MessageInbox.next(prefs, 1_700_000_000_000L) == null, "corrupt cache produces no message");
        System.out.println("PASS: Android inbox expiry, corrupt items/cache, local unread filtering, idempotent acknowledgement and 100-item bound");
    }
}
