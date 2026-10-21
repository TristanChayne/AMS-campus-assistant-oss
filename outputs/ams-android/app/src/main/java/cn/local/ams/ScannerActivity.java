package cn.local.ams;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.Camera;
import android.os.Bundle;
import android.os.Handler;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.Surface;
import android.view.Gravity;
import android.view.ScaleGestureDetector;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.os.SystemClock;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Returns one scan result; submission remains in the authenticated AMS page. */
public class ScannerActivity extends Activity implements SurfaceHolder.Callback {
    private Camera camera;
    private SurfaceView preview;
    private FrameLayout viewfinder;
    private double previewRatio = 9.0 / 16;
    private TextView message;
    private ScanOverlayView overlay;
    private boolean resumed;
    private boolean surfaceReady;
    private boolean finished;
    private boolean decoding;
    private boolean openingCamera;
    private long lastFrameTime;
    private float desiredZoom = 100;
    private boolean pinching;
    private final Handler handler = new Handler();
    private final ExecutorService decoder = Executors.newSingleThreadExecutor();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xFF101826);
        getWindow().setNavigationBarColor(0xFF101826);
        if (android.os.Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        getWindow().getDecorView().setSystemUiVisibility(0);
        if (android.os.Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF101826);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        message = new TextView(this);
        message.setText("正在打开相机…");
        message.setTextColor(android.graphics.Color.WHITE);
        message.setTextSize(14);
        message.setGravity(Gravity.CENTER);
        message.setPadding(24, 20, 24, 32);
        message.setBackgroundColor(0xB0101826);
        viewfinder = new FrameLayout(this);
        viewfinder.setBackgroundColor(android.graphics.Color.BLACK);
        viewfinder.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> fitPreview());
        preview = new SurfaceView(this);
        preview.setOnClickListener(v -> {
            if (camera != null) {
                try {
                    Camera.Parameters p = camera.getParameters();
                    if (p.getSupportedFocusModes().contains(Camera.Parameters.FOCUS_MODE_AUTO)) {
                        p.setFocusMode(Camera.Parameters.FOCUS_MODE_AUTO);
                        camera.setParameters(p);
                        camera.autoFocus((success, source) -> { });
                    }
                } catch (RuntimeException ignored) { }
            }
        });
        ScaleGestureDetector scale = new ScaleGestureDetector(this, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            @Override public boolean onScaleBegin(ScaleGestureDetector detector) {
                pinching = true;
                if (camera != null) {
                    Camera.Parameters params = camera.getParameters();
                    if (params.isZoomSupported()) desiredZoom = params.getZoomRatios().get(params.getZoom());
                }
                return true;
            }
            @Override public boolean onScale(ScaleGestureDetector detector) {
                changeZoom(detector.getScaleFactor());
                return true;
            }
        });
        GestureDetector taps = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent event) { return true; }
            @Override public boolean onSingleTapUp(MotionEvent event) {
                if (!pinching) preview.performClick();
                return true;
            }
        });
        preview.setOnTouchListener((v, event) -> {
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) pinching = false;
            scale.onTouchEvent(event);
            taps.onTouchEvent(event);
            return true;
        });
        preview.getHolder().addCallback(this);
        viewfinder.addView(preview, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
        root.addView(viewfinder, new FrameLayout.LayoutParams(-1, -1));
        overlay = new ScanOverlayView(this);
        root.addView(overlay, new FrameLayout.LayoutParams(-1, -1));
        root.addView(message, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM));
        TextView close = new TextView(this);
        close.setText("‹ 返回");
        close.setTextColor(android.graphics.Color.WHITE);
        close.setTextSize(16);
        close.setPadding(24, 20, 24, 20);
        close.setOnClickListener(v -> finish());
        root.addView(close, new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.LEFT));
        setContentView(root);
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.CAMERA}, 1);
    }

    @Override public void surfaceCreated(SurfaceHolder holder) { surfaceReady = true; startCamera(); }
    @Override public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) { }
    @Override public void surfaceDestroyed(SurfaceHolder holder) { surfaceReady = false; stopCamera(); }
    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused && android.os.Build.VERSION.SDK_INT >= 30 && getWindow().getInsetsController() != null) {
            getWindow().getInsetsController().hide(android.view.WindowInsets.Type.statusBars());
            getWindow().getInsetsController().setSystemBarsBehavior(
                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }
    @Override protected void onResume() { super.onResume(); resumed = true; startCamera(); }
    @Override protected void onPause() { resumed = false; stopCamera(); super.onPause(); }
    @Override protected void onDestroy() { decoder.shutdownNow(); super.onDestroy(); }
    @Override public void finish() { super.finish(); overridePendingTransition(0, 0); }

    private void startCamera() {
        if (!resumed || !surfaceReady || camera != null || openingCamera || finished
                || checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) return;
        try {
            int cameraId = -1;
            Camera.CameraInfo info = new Camera.CameraInfo();
            for (int i = 0; i < Camera.getNumberOfCameras(); i++) {
                Camera.getCameraInfo(i, info);
                if (info.facing == Camera.CameraInfo.CAMERA_FACING_BACK) { cameraId = i; break; }
            }
            if (cameraId < 0) throw new IllegalStateException("No rear camera");
            openingCamera = true;
            final int selectedCamera = cameraId;
            decoder.execute(() -> {
                try {
                    Camera opened = Camera.open(selectedCamera);
                    handler.post(() -> {
                        openingCamera = false;
                        if (!resumed || !surfaceReady || finished || isFinishing()) { opened.release(); return; }
                        camera = opened;
                        configureCamera(selectedCamera);
                    });
                } catch (RuntimeException e) {
                    handler.post(() -> { openingCamera = false; message.setText("无法打开相机，请返回后重试。"); });
                }
            });
        } catch (Exception e) {
            openingCamera = false;
            message.setText("无法打开后置相机，请返回后重试。");
        }
    }

    private void configureCamera(int cameraId) {
        try {
            Camera.CameraInfo info = new Camera.CameraInfo();
            Camera.getCameraInfo(cameraId, info);
            int rotation = getWindowManager().getDefaultDisplay().getRotation();
            int degrees = rotation == Surface.ROTATION_90 ? 90 : rotation == Surface.ROTATION_180 ? 180
                    : rotation == Surface.ROTATION_270 ? 270 : 0;
            int orientation = (info.orientation - degrees + 360) % 360;
            camera.setDisplayOrientation(orientation);
            Camera.Parameters params = camera.getParameters();
            Camera.Size chosen = params.getSupportedPreviewSizes().get(0);
            for (Camera.Size size : params.getSupportedPreviewSizes())
                if (Math.abs(size.width * size.height - 1920 * 1080) < Math.abs(chosen.width * chosen.height - 1920 * 1080)) chosen = size;
            params.setPreviewSize(chosen.width, chosen.height);
            previewRatio = orientation == 90 || orientation == 270
                    ? (double)chosen.height / chosen.width : (double)chosen.width / chosen.height;
            fitPreview();
            params.setPreviewFormat(android.graphics.ImageFormat.NV21);
            if (params.getSupportedFocusModes().contains(Camera.Parameters.FOCUS_MODE_CONTINUOUS_VIDEO))
                params.setFocusMode(Camera.Parameters.FOCUS_MODE_CONTINUOUS_VIDEO);
            else if (params.getSupportedFocusModes().contains(Camera.Parameters.FOCUS_MODE_CONTINUOUS_PICTURE))
                params.setFocusMode(Camera.Parameters.FOCUS_MODE_CONTINUOUS_PICTURE);
            camera.setParameters(params);
            camera.setPreviewDisplay(preview.getHolder());
            camera.startPreview();
            overlay.setScanning(true);
            message.setText("对准二维码，识别后自动签到\n双指缩放 · 点击对焦");
            camera.setPreviewCallback(this::readFrame);
        } catch (Exception e) {
            stopCamera();
            message.setText("无法打开后置相机。请关闭其他占用相机的应用后，返回重新扫码。");
        }
    }

    private void readFrame(byte[] data, Camera source) {
            if (camera != source || !resumed || finished || decoding) return;
            long now = SystemClock.elapsedRealtime();
            if (now - lastFrameTime < 200) return;
            lastFrameTime = now;
            decoding = true;
            Camera.Size size = source.getParameters().getPreviewSize();
            byte[] frame = data.clone();
            decoder.execute(() -> {
                String text = null;
                try {
                    text = QrDecoder.decode(frame, size.width, size.height);
                } catch (Exception ignored) { }
                final String scanned = text;
                handler.post(() -> {
                    decoding = false;
                    if (camera != source || !resumed || finished) return;
                    if (scanned != null) {
                        finished = true;
                        setResult(RESULT_OK, new Intent().putExtra("qr", scanned));
                        finish();
                    }
                });
            });
    }

    private void fitPreview() {
        int width = viewfinder.getWidth();
        int height = viewfinder.getHeight();
        if (width <= 0 || height <= 0) return;
        int fitWidth = Math.min(width, (int)(height * previewRatio));
        int fitHeight = (int)(fitWidth / previewRatio);
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams)preview.getLayoutParams();
        if (params.width != fitWidth || params.height != fitHeight) {
            params.width = fitWidth;
            params.height = fitHeight;
            preview.setLayoutParams(params);
        }
    }

    private void changeZoom(float factor) {
        if (camera == null) return;
        try {
            Camera.Parameters params = camera.getParameters();
            if (!params.isZoomSupported()) {
                message.setText("此相机不支持缩放，请靠近二维码\n点击画面对焦");
                return;
            }
            java.util.List<Integer> ratios = params.getZoomRatios();
            desiredZoom = Math.max(ratios.get(0), Math.min(ratios.get(ratios.size() - 1), desiredZoom * factor));
            int best = 0;
            for (int i = 1; i < ratios.size(); i++)
                if (Math.abs(ratios.get(i) - desiredZoom) < Math.abs(ratios.get(best) - desiredZoom)) best = i;
            if (params.getZoom() == best) return;
            params.setZoom(best);
            camera.setParameters(params);
        } catch (RuntimeException e) {
            AppNotice.show(this, "暂时无法调整放大，请靠近二维码");
        }
    }

    private void stopCamera() {
        if (overlay != null) overlay.setScanning(false);
        decoding = false;
        if (camera != null) {
            camera.setPreviewCallback(null);
            camera.stopPreview();
            camera.release();
            camera = null;
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) startCamera();
        else { message.setText("相机权限未允许，请返回后重新打开扫码并授权。"); }
    }
}
