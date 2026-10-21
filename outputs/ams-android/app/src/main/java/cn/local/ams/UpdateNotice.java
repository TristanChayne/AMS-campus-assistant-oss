package cn.local.ams;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Typeface;
import android.widget.*;

/** Small native update card; scrollable release notes and explicit download destination. */
final class UpdateNotice {
    static AlertDialog show(Activity activity, String version, String notes, String host, Runnable download) {
        AppTheme theme = AppTheme.read(activity); float density = activity.getResources().getDisplayMetrics().density;
        int pad = Math.round(24 * density);
        LinearLayout card = AppDialog.card(activity);
        TextView label = text(activity, "AMS 校园助手", 13, theme.accent); card.addView(label);
        TextView heading = text(activity, "发现新版本", 25, theme.ink); heading.setTypeface(null, Typeface.BOLD);
        heading.setPadding(0, Math.round(12*density), 0, Math.round(8*density)); card.addView(heading);
        TextView number = text(activity, version.isEmpty() ? "有可用更新" : "版本 " + version, 15, theme.muted); card.addView(number);
        TextView changes = text(activity, "本次更新", 14, theme.ink); changes.setTypeface(null, Typeface.BOLD);
        changes.setPadding(0,pad,0,Math.round(8*density)); card.addView(changes);
        ScrollView scroll = new ScrollView(activity); scroll.setFillViewport(false);
        TextView body = text(activity, notes.isEmpty() ? "新版本已发布，可以前往下载更新。" : notes, 15, theme.ink);
        body.setLineSpacing(4*density,1); scroll.addView(body);
        int maxHeight = Math.min(Math.round(220*density), activity.getResources().getDisplayMetrics().heightPixels / 3);
        body.measure(android.view.View.MeasureSpec.makeMeasureSpec(Math.max(1,activity.getResources().getDisplayMetrics().widthPixels-pad*4),android.view.View.MeasureSpec.AT_MOST),android.view.View.MeasureSpec.makeMeasureSpec(0,android.view.View.MeasureSpec.UNSPECIFIED));
        card.addView(scroll,new LinearLayout.LayoutParams(-1, Math.min(maxHeight,body.getMeasuredHeight())));
        TextView source = text(activity, "前往 " + host + " 下载", 12, theme.muted); source.setPadding(0,Math.round(18*density),0,Math.round(14*density)); card.addView(source);
        Button update = AppDialog.button(activity, "前往更新", "primary");
        card.addView(update,new LinearLayout.LayoutParams(-1,Math.round(50*density)));
        Button later = AppDialog.button(activity, "稍后再说", "plain");
        card.addView(later,new LinearLayout.LayoutParams(-1,Math.round(48*density)));
        AlertDialog dialog = AppDialog.present(activity, card, true);
        update.setOnClickListener(v -> { dialog.dismiss(); download.run(); }); later.setOnClickListener(v -> dialog.dismiss());
        return dialog;
    }
    private static TextView text(Activity a,String value,int size,int color) { TextView t = new TextView(a); t.setText(value); t.setTextSize(size); t.setTextColor(color); return t; }
}
