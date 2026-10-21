package cn.local.ams;

import android.app.Activity;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.TextView;

/** Short themed notice above the bottom navigation; replaces the platform Toast for messages that need no action. */
final class AppNotice {
    private static final String TAG = "ams:notice";
    private AppNotice() {}

    static void show(Activity activity, String message) {
        if (activity.isFinishing() || activity.isDestroyed()) return;
        View host = activity.findViewById(android.R.id.content);
        if (!(host instanceof FrameLayout)) return;
        FrameLayout frame = (FrameLayout) host;
        View previous = frame.findViewWithTag(TAG);
        if (previous != null) frame.removeView(previous);
        AppTheme theme = AppTheme.read(activity); float density = activity.getResources().getDisplayMetrics().density;
        TextView notice = new TextView(activity); notice.setTag(TAG); notice.setText(message); notice.setTextSize(14);
        notice.setTextColor(theme.ink); notice.setGravity(Gravity.CENTER_VERTICAL); notice.setMinHeight(Math.round(48 * density));
        notice.setPadding(Math.round(18 * density), Math.round(12 * density), Math.round(18 * density), Math.round(12 * density));
        GradientDrawable shape = new GradientDrawable(); shape.setColor(theme.surface); shape.setCornerRadius(16 * density);
        shape.setStroke(Math.round(density), theme.line); notice.setBackground(shape); notice.setElevation(8 * density);
        notice.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        int navigation = 0;
        if (frame.getRootWindowInsets() != null) navigation = frame.getRootWindowInsets().getSystemWindowInsetBottom();
        FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        int side = Math.round(24 * density);
        // Clear the floating campus navigation (about 80dp) and the system navigation area.
        layout.setMargins(side, 0, side, navigation + Math.round(96 * density));
        notice.setAlpha(0f); frame.addView(notice, layout);
        notice.animate().alpha(1f).setDuration(160).start();
        notice.postDelayed(() -> notice.animate().alpha(0f).setDuration(200).withEndAction(() -> frame.removeView(notice)).start(), 2500);
    }
}
