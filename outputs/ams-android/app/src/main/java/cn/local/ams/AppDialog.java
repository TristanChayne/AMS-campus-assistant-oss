package cn.local.ams;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.*;

/** Themed native dialogs in the same card language as UpdateNotice; replaces the platform AlertDialog look. */
final class AppDialog {
    private AppDialog() {}

    /** Title may be null. The primary action is the filled button; a null secondary label shows a single button. */
    static AlertDialog show(Activity activity, String title, String message, String primary, Runnable onPrimary,
                            String secondary, Runnable onSecondary) {
        return show(activity, title, message, primary, onPrimary, secondary, onSecondary, onSecondary);
    }

    /** onCancel runs when the dialog is dismissed by Back or an outside tap. */
    static AlertDialog show(Activity activity, String title, String message, String primary, Runnable onPrimary,
                            String secondary, Runnable onSecondary, Runnable onCancel) {
        AppTheme theme = AppTheme.read(activity); float density = activity.getResources().getDisplayMetrics().density;
        LinearLayout card = card(activity);
        if (title != null) {
            TextView heading = text(activity, title, 20, theme.ink); heading.setTypeface(null, Typeface.BOLD);
            heading.setPadding(0, 0, 0, Math.round(10 * density)); card.addView(heading);
        }
        TextView body = text(activity, message, 16, theme.ink); body.setLineSpacing(4 * density, 1);
        card.addView(body);
        Button main = button(activity, primary, "primary");
        LinearLayout.LayoutParams mainLayout = new LinearLayout.LayoutParams(-1, Math.round(50 * density));
        mainLayout.topMargin = Math.round(22 * density); card.addView(main, mainLayout);
        Button other = null;
        if (secondary != null) { other = button(activity, secondary, "plain"); card.addView(other, new LinearLayout.LayoutParams(-1, Math.round(48 * density))); }
        AlertDialog dialog = present(activity, card, true);
        main.setOnClickListener(v -> { dialog.dismiss(); if (onPrimary != null) onPrimary.run(); });
        if (other != null) other.setOnClickListener(v -> { dialog.dismiss(); if (onSecondary != null) onSecondary.run(); });
        if (onCancel != null) dialog.setOnCancelListener(d -> onCancel.run());
        return dialog;
    }

    /** Non-cancellable waiting card with a theme-tinted spinner. */
    static AlertDialog progress(Activity activity, String message) {
        AppTheme theme = AppTheme.read(activity); float density = activity.getResources().getDisplayMetrics().density;
        LinearLayout card = card(activity); card.setOrientation(LinearLayout.HORIZONTAL); card.setGravity(Gravity.CENTER_VERTICAL);
        ProgressBar spinner = new ProgressBar(activity); spinner.setIndeterminateTintList(ColorStateList.valueOf(theme.accent));
        card.addView(spinner, new LinearLayout.LayoutParams(Math.round(32 * density), Math.round(32 * density)));
        TextView text = text(activity, message, 16, theme.ink); text.setPadding(Math.round(16 * density), 0, 0, 0); card.addView(text);
        return present(activity, card, false);
    }

    /** Shows a prepared card with the shared rounded surface, width and theme roles. */
    static AlertDialog present(Activity activity, LinearLayout card, boolean cancelable) {
        AppTheme theme = AppTheme.read(activity); float density = activity.getResources().getDisplayMetrics().density;
        AlertDialog dialog = new AlertDialog.Builder(activity).setView(card).setCancelable(cancelable).create();
        theme.apply(card); dialog.show();
        GradientDrawable background = new GradientDrawable(); background.setColor(theme.surface); background.setCornerRadius(24 * density);
        dialog.getWindow().setBackgroundDrawable(background);
        dialog.getWindow().setLayout(Math.min(activity.getResources().getDisplayMetrics().widthPixels - Math.round(40 * density), Math.round(420 * density)), -2);
        return dialog;
    }

    static LinearLayout card(Activity activity) {
        int pad = Math.round(24 * activity.getResources().getDisplayMetrics().density);
        LinearLayout card = new LinearLayout(activity); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(pad, pad, pad, pad);
        return card;
    }

    static Button button(Activity activity, String label, String role) {
        Button b = new Button(activity); b.setText(label); b.setAllCaps(false); b.setTextSize(15);
        b.setStateListAnimator(null); b.setElevation(0); AppTheme.role(b, role); return b;
    }

    private static TextView text(Activity activity, String value, int size, int color) {
        TextView t = new TextView(activity); t.setText(value); t.setTextSize(size); t.setTextColor(color); return t;
    }
}
