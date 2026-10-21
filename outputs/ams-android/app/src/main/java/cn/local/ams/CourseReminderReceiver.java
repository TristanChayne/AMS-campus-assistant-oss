package cn.local.ams;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** REMIND-001: alarm boundary, "结束提醒" action, and re-arming after reboot / clock or time zone changes. */
public final class CourseReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (CourseReminder.ACTION_END.equals(action)) {
            String chain = intent.getStringExtra("chain");
            if (chain != null && !chain.isEmpty() && chain.length() <= 120) CourseReminder.userEnded(context, chain);
            return;
        }
        CourseReminder.refresh(context);
    }
}
