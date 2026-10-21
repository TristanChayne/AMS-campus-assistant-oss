package cn.local.ams;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * REMIND-001 course reminders (Android parity of the iOS Live Activity), fully local: the timetable exported by the
 * shared UI (3 school days) is stored here and one alarm at a time wakes {@link CourseReminderReceiver} at the next
 * boundary. Two independent channels (D-021): the ongoing countdown notification per class chain, and a single alert
 * before each class. Rules match outputs/ams-notify/src/schedule.mjs: lead time, merge gap 30 min, 8 h cap, shown end time.
 */
final class CourseReminder {
    static final String CHANNEL = "course_reminder";
    static final String ACTION_ALARM = "cn.local.ams.COURSE_REMINDER_ALARM";
    static final String ACTION_END = "cn.local.ams.COURSE_REMINDER_END";
    static final String ACTION_SCAN = "cn.local.ams.COURSE_REMINDER_SCAN";
    private static final String PREFS = "courseReminder";
    private static final int ONGOING_ID = 7400, REFRESH_ID = 7399;
    private static final long MINUTE = 60_000L, MERGE_GAP = 30 * MINUTE, MAX_SPAN = 8 * 60 * MINUTE, LINGER = 5 * MINUTE, DAY = 24 * 60 * MINUTE, PROGRESS_STEP = 5 * MINUTE;
    static final TimeZone CHINA = TimeZone.getTimeZone("Asia/Shanghai");
    private static final int[] LEADS = {5, 10, 15, 20, 30};

    static final class Item {
        final String key, date, code, title, room; final long start, end;
        Item(String key, String date, String code, String title, String room, long start, long end) { this.key = key; this.date = date; this.code = code; this.title = title; this.room = room; this.start = start; this.end = end; }
    }

    private CourseReminder() {}

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static boolean enabled(Context c) { return prefs(c).getBoolean("enabled", false); }
    // Builds before D-021 stored one exclusive mode ("ongoing" or "notify"); it seeds the two switches.
    static boolean ongoing(Context c) { return ongoing(prefs(c)); }
    static boolean ongoing(SharedPreferences p) { return p.contains("ongoing") ? p.getBoolean("ongoing", true) : !"notify".equals(p.getString("mode", "ongoing")); }
    static boolean alerts(Context c) { return alerts(prefs(c)); }
    static boolean alerts(SharedPreferences p) { return p.contains("alerts") ? p.getBoolean("alerts", false) : "notify".equals(p.getString("mode", "ongoing")); }
    static int lead(Context c) { int v = prefs(c).getInt("leadMin", 15); for (int l : LEADS) if (l == v) return v; return 15; }
    static boolean merge(Context c) { return prefs(c).getBoolean("merge", true); }
    static List<String> muted(Context c) { return strings(prefs(c).getString("muted", "[]")); }

    private static List<String> strings(String json) {
        List<String> out = new ArrayList<>();
        try { JSONArray a = new JSONArray(json); for (int i = 0; i < a.length(); i++) out.add(a.getString(i)); } catch (Exception ignored) {}
        return out;
    }

    /** Milliseconds for a China-time "YYYY-MM-DD" + "HH:MM", or -1. */
    static long chinaMillis(String date, String time) {
        if (date == null || time == null || !date.matches("\\d{4}-\\d{2}-\\d{2}") || !time.matches("([01]\\d|2[0-3]):[0-5]\\d")) return -1;
        Calendar c = Calendar.getInstance(CHINA, Locale.ROOT);
        c.setLenient(false); c.clear();
        try {
            c.set(Integer.parseInt(date.substring(0, 4)), Integer.parseInt(date.substring(5, 7)) - 1, Integer.parseInt(date.substring(8, 10)), Integer.parseInt(time.substring(0, 2)), Integer.parseInt(time.substring(3, 5)), 0);
            return c.getTimeInMillis();
        } catch (IllegalArgumentException e) { return -1; }
    }

    /** Stores the validated snapshot from window.__amsSchedule; returns false when unusable. */
    static boolean receiveSchedule(Context c, String json) {
        try {
            if (json == null || json.length() > 65536) return false;
            JSONObject s = new JSONObject(json);
            JSONArray courses = s.getJSONArray("courses");
            if (s.optInt("version") != 1 || courses.length() > 60) return false;
            prefs(c).edit().putString("schedule", s.toString()).apply();
            refresh(c);
            return true;
        } catch (Exception e) { return false; }
    }

    /** Applies a settings change from the shared UI. Returns true when notification permission should be requested. */
    static boolean receiveChange(Context c, String json) {
        try {
            if (json == null || json.length() > 2000) return false;
            boolean turnedOn = applyChange(prefs(c), new JSONObject(json));
            refresh(c);
            return turnedOn;
        } catch (Exception ex) { return false; }
    }

    // Keep preference changes testable on the JVM, without invoking Android notification or alarm services.
    static boolean applyChange(SharedPreferences p, JSONObject ch) throws org.json.JSONException {
        SharedPreferences.Editor e = p.edit();
        boolean turnedOn = false;
        if (ch.optBoolean("decided")) e.putBoolean("decided", true);
        if (ch.has("enabled")) { boolean on = ch.getBoolean("enabled"); turnedOn = on && !p.getBoolean("enabled", false); e.putBoolean("enabled", on); if (on) e.putBoolean("decided", true); }
        boolean ongoing = ongoing(p), alerts = alerts(p), wasAlerts = alerts;
        if (ch.has("mode")) { String m = ch.getString("mode"); if ("ongoing".equals(m) || "notify".equals(m)) { ongoing = "ongoing".equals(m); alerts = !ongoing; } }
        if (ch.has("channel")) {
            JSONObject k = ch.getJSONObject("channel"); boolean on = k.optBoolean("on");
            if ("ongoing".equals(k.optString("key"))) ongoing = on; else if ("notify".equals(k.optString("key"))) alerts = on;
        }
        // Both channels off means reminders off; one channel stays selected for the next time they are switched on.
        boolean nowOn = ch.has("enabled") ? ch.getBoolean("enabled") : p.getBoolean("enabled", false);
        if (!ongoing && !alerts) { ongoing = true; if (!(nowOn && !p.getBoolean("enabled", false))) { e.putBoolean("enabled", false); turnedOn = false; } }
        if (nowOn && alerts && !wasAlerts) turnedOn = true;
        e.putBoolean("ongoing", ongoing).putBoolean("alerts", alerts).remove("mode");
        if (ch.has("leadMin")) { int v = ch.getInt("leadMin"); for (int l : LEADS) if (l == v) e.putInt("leadMin", v); }
        if (ch.has("merge")) e.putBoolean("merge", ch.getBoolean("merge"));
        if (ch.has("mute")) {
            JSONObject m = ch.getJSONObject("mute"); String code = m.optString("code", "");
            if (!code.isEmpty() && code.length() <= 40) {
                List<String> list = strings(p.getString("muted", "[]")); list.remove(code); if (m.optBoolean("muted")) list.add(code);
                e.putString("muted", new JSONArray(list).toString());
            }
        }
        e.apply();
        return turnedOn;
    }

    /** AMS logout: the timetable belonged to that account. */
    static void clear(Context c) {
        prefs(c).edit().remove("schedule").remove("ended").remove("notified").apply();
        refresh(c);
    }

    // ---- planning ----

    static List<Item> items(Context c) { return items(c, muted(c)); }

    /** Every class, muted ones included (they still take place): for the "classes left today" count. */
    static List<Item> allItems(Context c) { return items(c, new ArrayList<String>()); }

    private static List<Item> items(Context c, List<String> muted) {
        List<Item> out = new ArrayList<>();
        try {
            JSONArray a = new JSONObject(prefs(c).getString("schedule", "{}")).getJSONArray("courses");
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                String date = o.optString("date"), code = o.optString("code");
                long s = chinaMillis(date, o.optString("start")), e = chinaMillis(date, o.optString("end"));
                if (s < 0 || e <= s || muted.contains(code)) continue;
                out.add(new Item(o.optString("key"), date, code, o.optString("title", "课程"), o.optString("room"), s, e));
            }
        } catch (Exception ignored) {}
        Collections.sort(out, (x, y) -> Long.compare(x.start, y.start));
        return out;
    }

    static List<List<Item>> chains(List<Item> items, int leadMin, boolean merge) {
        List<List<Item>> out = new ArrayList<>();
        long lead = leadMin * MINUTE;
        for (Item item : items) {
            List<Item> last = out.isEmpty() ? null : out.get(out.size() - 1);
            Item tail = last == null ? null : last.get(last.size() - 1);
            if (merge && tail != null && item.start >= tail.end && item.start - tail.end <= MERGE_GAP && item.end + LINGER - (last.get(0).start - lead) <= MAX_SPAN) last.add(item);
            else { List<Item> chain = new ArrayList<>(); chain.add(item); out.add(chain); }
        }
        return out;
    }

    private static JSONObject ended(Context c) {
        try { return new JSONObject(prefs(c).getString("ended", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static void userEnded(Context c, String chain) {
        JSONObject ended = ended(c);
        try { ended.put(chain, System.currentTimeMillis()); } catch (Exception ignored) {}
        prefs(c).edit().putString("ended", ended.toString()).apply();
        refresh(c);
    }

    // ---- notifications and alarms ----

    private static String hm(long t) { SimpleDateFormat f = new SimpleDateFormat("HH:mm", Locale.ROOT); f.setTimeZone(CHINA); return f.format(new Date(t)); }

    static boolean notificationsAllowed(Context c) {
        NotificationManager m = c.getSystemService(NotificationManager.class);
        return m != null && m.areNotificationsEnabled();
    }

    static boolean exactAllowed(Context c) {
        AlarmManager a = c.getSystemService(AlarmManager.class);
        return Build.VERSION.SDK_INT < 31 || (a != null && a.canScheduleExactAlarms());
    }

    private static void channel(Context c) {
        NotificationManager m = c.getSystemService(NotificationManager.class);
        if (m == null || m.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "课程提醒", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("上课前提醒，并显示上课倒计时与进度");
        m.createNotificationChannel(ch);
    }

    private static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, ActivationActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        return PendingIntent.getActivity(c, 7402, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent alarmIntent(Context c) {
        Intent i = new Intent(c, CourseReminderReceiver.class).setAction(ACTION_ALARM).setPackage(c.getPackageName());
        return PendingIntent.getBroadcast(c, 7403, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Recomputes everything for "now": the ongoing notification, due alerts, and the next alarm. Idempotent. */
    static void refresh(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (nm == null || am == null) return;
        long now = System.currentTimeMillis();
        am.cancel(alarmIntent(c));
        if (!enabled(c)) { nm.cancel(ONGOING_ID); return; }
        channel(c);
        int leadMin = lead(c); long lead = leadMin * MINUTE;
        List<List<Item>> chains = chains(items(c), leadMin, merge(c));
        JSONObject ended = ended(c);
        List<String> notified = strings(prefs(c).getString("notified", "[]"));
        boolean ongoing = ongoing(c), alerts = alerts(c);
        long next = Long.MAX_VALUE;
        List<Item> current = null;
        for (List<Item> chain : chains) {
            Item first = chain.get(0), last = chain.get(chain.size() - 1);
            long open = first.start - lead;
            if (last.end <= now || ended.has(first.key)) continue;
            if (open <= now && current == null) current = chain;
            if (open > now) next = Math.min(next, open);
            for (Item i : chain) { if (i.start > now) next = Math.min(next, i.start); if (i.end > now) next = Math.min(next, i.end); }
            // Pre-class alert channel: one alert per chain when its window opens.
            if (alerts && open <= now && now < first.start && !notified.contains(first.key)) {
                nm.notify(first.key.hashCode(), alert(c, first, leadMin).build());
                notified.add(first.key);
            }
        }
        if (ongoing && current != null) {
            nm.notify(ONGOING_ID, ongoingNotification(c, current, now).build());
            // The chronometer runs by itself but the progress bar does not: redraw it every few minutes in class.
            for (Item i : current) if (i.start <= now && now < i.end) next = Math.min(next, now + PROGRESS_STEP);
        } else nm.cancel(ONGOING_ID);
        // Only three school days are known: ask to open the app on the last known day's evening.
        String lastDate = "";
        try { JSONArray dates = new JSONObject(prefs(c).getString("schedule", "{}")).getJSONArray("dates"); for (int i = 0; i < dates.length(); i++) if (dates.getString(i).compareTo(lastDate) > 0) lastDate = dates.getString(i); } catch (Exception ignored) {}
        long refreshAt = chinaMillis(lastDate, "20:00");
        if (refreshAt > 0) {
            if (refreshAt > now) next = Math.min(next, refreshAt);
            else if (now - refreshAt < DAY && !notified.contains("refresh:" + lastDate)) {
                nm.notify(REFRESH_ID, new Notification.Builder(c, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle("课程提醒需要更新课表")
                        .setContentText("学校只提供 3 天课表，打开 AMS 刷新后才能继续提醒之后的课程。").setContentIntent(openApp(c)).setAutoCancel(true).build());
                notified.add("refresh:" + lastDate);
            }
        }
        while (notified.size() > 60) notified.remove(0);
        prefs(c).edit().putString("notified", new JSONArray(notified).toString()).apply();
        if (next != Long.MAX_VALUE) {
            if (exactAllowed(c)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarmIntent(c));
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarmIntent(c));
            prefs(c).edit().putLong("nextAlarm", next).apply();
        } else prefs(c).edit().remove("nextAlarm").apply();
    }

    private static Notification.Builder alert(Context c, Item i, int leadMin) {
        return new Notification.Builder(c, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(leadMin + " 分钟后上课 · " + i.title)
                .setContentText((i.room.isEmpty() ? "" : i.room + " · ") + hm(i.start) + " 开始").setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(openApp(c)).setAutoCancel(true).setTimeoutAfter(Math.max(MINUTE, i.end - System.currentTimeMillis()));
    }

    private static Notification.Builder ongoingNotification(Context c, List<Item> chain, long now) {
        Item item = chain.get(chain.size() - 1), next = null; boolean during = false;
        for (int k = 0; k < chain.size(); k++) {
            Item i = chain.get(k);
            if (now < i.start) { item = i; next = k + 1 < chain.size() ? chain.get(k + 1) : null; break; }
            if (now < i.end) { item = i; during = true; next = k + 1 < chain.size() ? chain.get(k + 1) : null; break; }
        }
        Intent end = new Intent(c, CourseReminderReceiver.class).setAction(ACTION_END).setPackage(c.getPackageName()).putExtra("chain", chain.get(0).key);
        PendingIntent endIntent = PendingIntent.getBroadcast(c, 7404, end, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent scan = new Intent(c, MainActivity.class).setAction(ACTION_SCAN).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent scanIntent = PendingIntent.getActivity(c, 7405, scan, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        // No ticking chronometer: minutes are redrawn with the progress refresh (every few minutes in class).
        String room = item.room.isEmpty() ? "地点待确认" : item.room;
        String when = during ? "剩约 " + Math.max(1, (item.end - now + MINUTE - 1) / MINUTE) + " 分钟 · " + hm(item.end) + " 下课" : hm(item.start) + " 上课";
        int left = 0;
        for (Item i : allItems(c)) if (i.date.equals(item.date) && i.start > item.start) left++;
        String sub = left > 0 ? "今日还剩 " + left + " 节" : "今日最后一节";
        if (!during && next != null) sub += " · 下一节 " + hm(next.start) + " " + next.title;
        Notification.Builder b = new Notification.Builder(c, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle((during ? "正在上课" : "即将上课") + (item.code.isEmpty() ? "" : " · " + item.code) + " · " + item.title)
                .setContentText(room + " · " + when).setSubText(sub)
                .setOngoing(true).setOnlyAlertOnce(true).setCategory(Notification.CATEGORY_REMINDER).setContentIntent(openApp(c)).setShowWhen(false)
                .setTimeoutAfter(Math.max(MINUTE, chain.get(chain.size() - 1).end + LINGER - now))
                .addAction(new Notification.Action.Builder(null, "扫码签到", scanIntent).build())
                .addAction(new Notification.Action.Builder(null, "结束提醒", endIntent).build());
        if (during) b.setProgress(1000, (int) Math.max(0, Math.min(1000, (now - item.start) * 1000 / Math.max(1, item.end - item.start))), false);
        if (Build.VERSION.SDK_INT >= 36) {
            // Android 16 Live Updates: progress style plus a short status-bar chip; the system decides promotion.
            Notification.ProgressStyle style = new Notification.ProgressStyle();
            if (during) style.setProgress((int) Math.max(0, Math.min(100, (now - item.start) * 100 / Math.max(1, item.end - item.start))));
            android.os.Bundle promote = new android.os.Bundle();
            promote.putBoolean("android.requestPromotedOngoing", true);  // Notification.EXTRA_REQUEST_PROMOTED_ONGOING (not in the API 36 stub)
            b.setStyle(style).addExtras(promote).setShortCriticalText(during ? hm(item.end) : item.room.isEmpty() ? hm(item.start) : item.room);
        }
        return b;
    }

    // ---- settings bridge ----

    static String webScript(Context c) {
        try {
            JSONObject s = new JSONObject();
            boolean blocked = !notificationsAllowed(c);
            s.put("available", true).put("decided", prefs(c).getBoolean("decided", false) || enabled(c)).put("enabled", enabled(c)).put("leadMin", lead(c)).put("merge", merge(c));
            // D-021 page: two independent channels, both shown as notifications (greyed while system notifications are off).
            s.put("channels", new JSONArray()
                    .put(new JSONObject().put("key", "ongoing").put("label", "通知栏倒计时").put("short", "倒计时").put("detail", "课前与上课中在通知栏显示倒计时和进度，可扫码签到").put("on", ongoing(c)).put("blocked", blocked).put("blockedText", "系统通知已关闭"))
                    .put(new JSONObject().put("key", "notify").put("label", "课前通知").put("short", "通知").put("detail", "上课前弹出一条通知").put("on", alerts(c)).put("blocked", blocked).put("blockedText", "系统通知已关闭")));
            JSONArray courses = new JSONArray(); java.util.Set<String> seen = new java.util.HashSet<>();
            for (Item i : allItems(c)) if (!i.code.isEmpty() && seen.add(i.code)) courses.put(new JSONObject().put("code", i.code).put("title", i.title));
            s.put("mutedCodes", new JSONArray(muted(c))).put("courses", courses).put("upload", new JSONObject().put("available", false).put("enabled", false));
            String status = ""; boolean link = false;
            if (enabled(c)) {
                if (!notificationsAllowed(c)) { status = "系统通知已关闭，课前不会提醒。"; link = true; }
                else if (!prefs(c).contains("schedule")) status = "打开课表后会自动安排提醒。";
                else {
                    long now = System.currentTimeMillis(); int n = 0;
                    for (Item i : items(c)) if (i.end > now) n++;
                    status = n > 0 ? "已安排 " + n + " 节课的提醒（学校只提供 3 天课表，请隔几天打开一次 App）。" : "接下来 3 天内没有需要提醒的课程。";
                    if (!exactAllowed(c)) { status += " 未允许精确闹钟，提醒可能晚几分钟。"; link = true; }
                }
            }
            s.put("status", status).put("settingsLink", link);
            return "window.__amsCourseReminderBridge=true;if(window.__amsSetCourseReminder)window.__amsSetCourseReminder(" + s + ");";
        } catch (Exception e) { return "window.__amsCourseReminderBridge=true;"; }
    }

    /** "去设置": notification settings first, then exact alarm permission. */
    static Intent settingsIntent(Context c) {
        if (!notificationsAllowed(c)) return new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName());
        if (Build.VERSION.SDK_INT >= 31 && !exactAllowed(c)) return new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, android.net.Uri.parse("package:" + c.getPackageName()));
        return null;
    }
}
