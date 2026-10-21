package cn.local.ams;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarm target for SportsKeepAlive; continues only while the session is confirmed signed in or the answer is unknown. */
public final class SportsKeepAliveReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!SportsKeepAlive.enabled(context)) { SportsKeepAlive.cancel(context); return; }
        PendingResult pending = goAsync();
        SportsKeepAlive.check(context, signedIn -> {
            try { if (!Boolean.FALSE.equals(signedIn)) SportsKeepAlive.schedule(context); else SportsKeepAlive.cancel(context); }
            finally { pending.finish(); }
        });
    }
}
