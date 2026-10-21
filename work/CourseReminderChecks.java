package cn.local.ams;

import java.util.ArrayList;
import java.util.List;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.lang.reflect.Proxy;
import android.content.SharedPreferences;
import org.json.JSONObject;

// REMIND-001 Android planning check (plain JVM, android.jar only as stubs on the classpath).
// Same cases as outputs/ams-notify/test/schedule.test.mjs.
public final class CourseReminderChecks {
    private static void check(boolean ok, String name) { if (!ok) throw new AssertionError(name); }
    private static CourseReminder.Item item(String key, String start, String end) {
        return new CourseReminder.Item(key, "2026-10-14", "C" + key, "T" + key, "SA101", CourseReminder.chinaMillis("2026-10-14", start), CourseReminder.chinaMillis("2026-10-14", end));
    }
    // In-memory Android preference interface; all migration/change logic below calls production methods.
    static SharedPreferences memory(Map<String, Object> values) {
        return (SharedPreferences) Proxy.newProxyInstance(CourseReminderChecks.class.getClassLoader(), new Class<?>[]{SharedPreferences.class}, (proxy, method, args) -> {
            String name = method.getName();
            if (name.equals("contains")) return values.containsKey(args[0]);
            if (name.equals("getAll")) return new HashMap<>(values);
            if (name.startsWith("get")) return values.containsKey(args[0]) ? values.get(args[0]) : args[1];
            if (name.equals("edit")) {
                Map<String, Object> changes = new HashMap<>(); Set<String> removed = new HashSet<>();
                return Proxy.newProxyInstance(CourseReminderChecks.class.getClassLoader(), new Class<?>[]{SharedPreferences.Editor.class}, (editor, operation, a) -> {
                    String op = operation.getName();
                    if (op.startsWith("put")) { removed.remove(a[0]); changes.put((String)a[0], a[1]); return editor; }
                    if (op.equals("remove")) { changes.remove(a[0]); removed.add((String)a[0]); return editor; }
                    if (op.equals("apply") || op.equals("commit")) { for (String key : removed) values.remove(key); values.putAll(changes); return op.equals("commit") ? true : null; }
                    throw new UnsupportedOperationException(op);
                });
            }
            throw new UnsupportedOperationException(name);
        });
    }
    private static void settingsChecks() throws Exception {
        for (String mode : new String[]{"ongoing", "notify"}) {
            for (boolean enabled : new boolean[]{false, true}) {
                Map<String, Object> values = new HashMap<>();
                values.put("mode", mode); values.put("enabled", enabled); values.put("muted", "[\"MTH101\"]"); values.put("merge", false);
                SharedPreferences p = memory(values);
                check(CourseReminder.ongoing(p) == mode.equals("ongoing"), "legacy countdown " + mode);
                check(CourseReminder.alerts(p) == mode.equals("notify"), "legacy alerts " + mode);
                check(!values.containsKey("ongoing"), "reading old settings does not overwrite them");
                check(!CourseReminder.applyChange(p, new JSONObject("{\"leadMin\":20}")), "migration does not request permission");
                check(p.getBoolean("enabled", false) == enabled, "migration preserves master switch");
                check(CourseReminder.ongoing(p) == mode.equals("ongoing") && CourseReminder.alerts(p) == mode.equals("notify"), "persist migrated channels");
                check(!p.contains("mode") && p.contains("ongoing") && p.contains("alerts"), "migration replaces old key");
                check(p.getInt("leadMin", 0) == 20 && !p.getBoolean("merge", true) && p.getString("muted", "").equals("[\"MTH101\"]"), "preserve unrelated settings");
            }
        }
        Map<String, Object> values = new HashMap<>(); SharedPreferences p = memory(values);
        check(CourseReminder.ongoing(p) && !CourseReminder.alerts(p), "new install channel defaults");
        check(CourseReminder.applyChange(p, new JSONObject("{\"enabled\":true}")), "first enable requests permission");
        check(p.getBoolean("decided", false), "enable records first choice");
        check(CourseReminder.applyChange(p, new JSONObject("{\"channel\":{\"key\":\"notify\",\"on\":true}}")), "enabling alerts requests permission");
        check(CourseReminder.ongoing(p) && CourseReminder.alerts(p), "both channels on independently");
        CourseReminder.applyChange(p, new JSONObject("{\"channel\":{\"key\":\"ongoing\",\"on\":false}}"));
        check(!CourseReminder.ongoing(p) && CourseReminder.alerts(p) && p.getBoolean("enabled", false), "one channel off leaves other running");
        check(!CourseReminder.applyChange(p, new JSONObject("{\"channel\":{\"key\":\"notify\",\"on\":false}}")), "last channel off never requests permission");
        check(!p.getBoolean("enabled", true), "both off disables master");
        check(CourseReminder.ongoing(p) && !CourseReminder.alerts(p), "keep default selection for next enable");
        CourseReminder.applyChange(p, new JSONObject("{\"enabled\":true}"));
        CourseReminder.applyChange(p, new JSONObject("{\"channel\":{\"key\":\"ongoing\",\"on\":false}}"));
        check(!p.getBoolean("enabled", true), "countdown as last channel also disables master");
        values.put("mode", "notify"); values.put("ongoing", true); values.put("alerts", false);
        check(CourseReminder.ongoing(p) && !CourseReminder.alerts(p), "explicit channels override old mode");
    }
    public static void main(String[] args) throws Exception {
        settingsChecks();
        MessageInboxChecks.run();
        check(CourseReminder.chinaMillis("2026-10-14", "09:00") == 1791939600000L, "china time");
        check(CourseReminder.chinaMillis("2026-02-30", "09:00") == -1, "invalid date");
        check(CourseReminder.chinaMillis("10-14", "09:00") == -1, "short date");
        check(CourseReminder.chinaMillis("2026-10-14", "24:00") == -1, "invalid time");
        List<CourseReminder.Item> merged = new ArrayList<>();
        merged.add(item("a", "09:00", "10:50")); merged.add(item("b", "11:00", "12:50"));
        check(CourseReminder.chains(merged, 15, true).size() == 1, "back-to-back merge");
        check(CourseReminder.chains(merged, 15, false).size() == 2, "merge off");
        List<CourseReminder.Item> gap = new ArrayList<>();
        gap.add(item("a", "09:00", "10:00")); gap.add(item("b", "10:31", "11:00"));
        check(CourseReminder.chains(gap, 15, true).size() == 2, "gap over 30 minutes");
        List<CourseReminder.Item> day = new ArrayList<>();
        String[][] slots = {{"08:00", "09:50"}, {"10:00", "11:50"}, {"12:00", "13:50"}, {"14:00", "15:50"}, {"16:00", "17:50"}};
        for (String[] s : slots) day.add(item(s[0], s[0], s[1]));
        List<List<CourseReminder.Item>> chains = CourseReminder.chains(day, 15, true);
        check(chains.size() >= 2, "8 hour cap splits");
        for (List<CourseReminder.Item> c : chains) check(c.get(c.size() - 1).end + 5 * 60_000L - (c.get(0).start - 15 * 60_000L) <= 8 * 3600_000L, "span");
        System.out.println("PASS: legacy channel migration (both modes, master on/off), independent channels, last channel disables master, permission trigger, preference preservation; China time, invalid dates/times, merge gap / off, 8-hour cap");
    }
}
