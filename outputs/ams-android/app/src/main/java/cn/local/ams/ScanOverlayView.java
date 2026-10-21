package cn.local.ams;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;
import android.view.animation.LinearInterpolator;

/** Decorative guide only; the decoder continues to examine the camera image. */
final class ScanOverlayView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final ValueAnimator sweep = ValueAnimator.ofFloat(0, 1);
    private float progress;
    private boolean scanning;

    ScanOverlayView(Context context) {
        super(context);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
        sweep.setDuration(2000);
        sweep.setRepeatCount(ValueAnimator.INFINITE);
        sweep.setInterpolator(new LinearInterpolator());
        sweep.addUpdateListener(a -> { progress = (float)a.getAnimatedValue(); invalidate(); });
    }

    void setScanning(boolean value) {
        scanning = value;
        if (value && isAttachedToWindow() && ValueAnimator.areAnimatorsEnabled()) sweep.start();
        else sweep.cancel();
        invalidate();
    }

    @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); if (scanning) setScanning(true); }
    @Override protected void onDetachedFromWindow() { sweep.cancel(); super.onDetachedFromWindow(); }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float density = getResources().getDisplayMetrics().density;
        float size = Math.min(getWidth() * .76f, getHeight() * .48f);
        float left = (getWidth() - size) / 2, top = (getHeight() - size) / 2;
        RectF box = new RectF(left, top, left + size, top + size);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(0x65070F1C);
        canvas.drawRect(0, 0, getWidth(), box.top, paint);
        canvas.drawRect(0, box.bottom, getWidth(), getHeight(), paint);
        canvas.drawRect(0, box.top, box.left, box.bottom, paint);
        canvas.drawRect(box.right, box.top, getWidth(), box.bottom, paint);
        paint.setColor(0xFFD3E3FF);
        paint.setStrokeWidth(3 * density);
        paint.setStrokeCap(Paint.Cap.ROUND);
        float arm = 24 * density;
        for (int x = 0; x < 2; x++) for (int y = 0; y < 2; y++) {
            float cx = x == 0 ? box.left : box.right, cy = y == 0 ? box.top : box.bottom;
            canvas.drawLine(cx, cy, cx + (x == 0 ? arm : -arm), cy, paint);
            canvas.drawLine(cx, cy, cx, cy + (y == 0 ? arm : -arm), paint);
        }
        if (scanning) {
            float line = box.top + 8 * density + progress * (size - 16 * density);
            paint.setStrokeWidth(2 * density);
            paint.setColor(0xCC9CC5FF);
            canvas.drawLine(box.left + 8 * density, line, box.right - 8 * density, line, paint);
        }
    }
}
