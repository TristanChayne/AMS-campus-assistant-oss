package cn.local.ams;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.Toast;
import java.util.Arrays;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

public class MainActivity extends Activity {
    private static final String HOME = "https://ams.xjtlu.edu.cn/";
    private static final int CAMERA_REQUEST = 1;
    private static final int NOTIFY_REQUEST = 4;
    private WebView web, navigationWeb;
    private boolean navigationVisible;
    private int navigationIndex;
    private LinearLayout root;
    private int pageSurface = 0xFFF5F6F8;
    private int insetTop, insetBottom;
    private android.animation.ValueAnimator appearanceAnimator;
    private static final java.util.concurrent.atomic.AtomicBoolean checkingLicense = new java.util.concurrent.atomic.AtomicBoolean();
    private AlertDialog updateDialog;
    private boolean pendingManualUpdate;
    private String manualUpdateError;
    private PermissionRequest pendingCamera;
    private boolean loadFailed;
    private boolean scannerOpen;
    private boolean pendingScan;  // "扫码签到" from the course reminder notification
    private boolean foreground;
    private boolean retryPending;
    private int retryCount;
    private android.widget.TextView connectionNotice;
    private final android.os.Handler retryHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable retryLoad = () -> {
        if (!foreground || !retryPending || scannerOpen || isFinishing() || isDestroyed()) return;
        web.loadUrl(HOME);
    };
    private boolean clearingLogoutHistory;
    private SchoolSession.Bridge schoolSession;
    private boolean assetMissing;
    private String scanEntryScript;
    private String scanSubmitScript = "";
    private android.webkit.ValueCallback<Uri[]> fileSelection;

    private void updateNavigation(){
        if(navigationWeb==null)return;
        android.widget.FrameLayout.LayoutParams layout=(android.widget.FrameLayout.LayoutParams)navigationWeb.getLayoutParams();
        int margin=dpForInsets(insetBottom);if(layout.bottomMargin!=margin){layout.bottomMargin=margin;navigationWeb.setLayoutParams(layout);}
        navigationWeb.setVisibility(navigationVisible&& !loadFailed?android.view.View.VISIBLE:android.view.View.GONE);
        AppTheme palette=AppTheme.read(this);
        navigationWeb.evaluateJavascript(palette.webScript()+"document.documentElement.classList.toggle('ams-dark',"+palette.dark+");var s=document.documentElement.style;s.setProperty('--campus-blue',getComputedStyle(document.documentElement).getPropertyValue('--campus-primary'));s.setProperty('--lecture-wash',getComputedStyle(document.documentElement).getPropertyValue('--campus-wash'));document.querySelectorAll('nav button').forEach((b,i)=>{b.classList.toggle('active',i==="+navigationIndex+");b.setAttribute('aria-current',i==="+navigationIndex+"?'page':'false');});",null);
    }

    private String appearanceMode() {
        return getSharedPreferences("amsAppearance", MODE_PRIVATE).getString("mode", "system");
    }
    private boolean darkAppearance() {
        String mode = appearanceMode();
        return "dark".equals(mode) || ("system".equals(mode)
                && (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES);
    }
    private String appearanceScript() {
        return "window.__amsNativeNavigation=true;window.__amsAppearance={appearance:" + JSONObject.quote(appearanceMode())
                + ",dark:" + darkAppearance() + "};";
    }
    /** Sports keep-alive preference for the managed settings page (Android only; iOS never sets it). */
    private String keepAliveScript() {
        return "if(window.__amsSetKeepAlive)window.__amsSetKeepAlive({available:true,enabled:" + SportsKeepAlive.enabled(this)
                + ",days:" + SportsKeepAlive.days(this) + ",last:" + JSONObject.quote(SportsKeepAlive.lastSummary(this)) + "});";
    }
    private int dpForInsets(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private String insetScript() {
        return "window.__amsInsets={top:" + insetTop + ",bottom:" + insetBottom + "};";
    }
    private void updateAppearance(boolean animate) { updateAppearance(animate, 300); }
    private void updateAppearance(boolean animate, int duration) { updateAppearance(animate, duration, true); }
    private void updateAppearance(boolean animate, int duration, boolean publishTheme) {
        if (web == null || root == null) return;
        boolean dark = darkAppearance();
        int paper = dark ? 0xFF15191F : 0xFFF5F6F8;
        int navigation = paper;
        if (appearanceAnimator != null) appearanceAnimator.cancel();
        int oldPaper = pageSurface, oldNavigation = pageSurface;
        appearanceAnimator = android.animation.ValueAnimator.ofFloat(0f, 1f);
        appearanceAnimator.setDuration(animate ? duration : 0);
        appearanceAnimator.setInterpolator(new android.view.animation.AccelerateDecelerateInterpolator());
        appearanceAnimator.addUpdateListener(animation -> {
            float progress = (float) animation.getAnimatedValue();
            android.animation.ArgbEvaluator colors = new android.animation.ArgbEvaluator();
            int background = (int) colors.evaluate(progress, oldPaper, paper);
            pageSurface = background;
            root.setBackgroundColor(background);
            web.setBackgroundColor(background);
            getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
            getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        });
        appearanceAnimator.start();
        getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | (dark ? 0 : android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR | android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR));
        connectionNotice.setTextColor(dark ? 0xFFA4AFBF : 0xFF69758A);
        updateNavigation();
        if (publishTheme && amsMobilePage()) web.evaluateJavascript(appearanceScript()
                + "if(window.__amsSetAppearance)window.__amsSetAppearance(window.__amsAppearance.appearance,window.__amsAppearance.dark);", null);
    }
    @Override public void onConfigurationChanged(android.content.res.Configuration configuration) {
        super.onConfigurationChanged(configuration);
        updateAppearance(true);
    }

    private boolean schoolPage(Uri uri) {
        String host = uri.getHost();
        return "https".equalsIgnoreCase(uri.getScheme())
                && ("ams.xjtlu.edu.cn".equalsIgnoreCase(host)
                || "uim.xjtlu.edu.cn".equalsIgnoreCase(host));
    }

    @Override public void onCreate(Bundle saved) {
        if ((getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES) setTheme(android.R.style.Theme_Material_NoActionBar);
        super.onCreate(saved);
        if (getIntent() != null && CourseReminder.ACTION_SCAN.equals(getIntent().getAction())) pendingScan = true;
        if (!Activation.valid(this)) { startActivity(new Intent(this, ActivationActivity.class)); finish(); return; }
        scanEntryScript = "";
        for (String asset : new String[]{"ams-scan-entry.js", "ams-modern-ui.js", "ams-submit-scan.js"}) {
        try (InputStream input = getAssets().open(asset)) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            if ("ams-submit-scan.js".equals(asset)) scanSubmitScript = bytes.toString("UTF-8");
            else scanEntryScript += bytes.toString("UTF-8") + "\n";
        } catch (IOException e) {
            assetMissing = true;
        }
        }
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        if (assetMissing) root.post(() -> AppNotice.show(this, "部分界面组件未能加载，请重新安装 App"));
        boolean night = darkAppearance();
        pageSurface = night ? 0xFF15191F : 0xFFF5F6F8;
        root.setBackgroundColor(pageSurface);
        if (android.os.Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | (night ? 0 : android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR | android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR));
        if (android.os.Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                android.graphics.Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                float density = getResources().getDisplayMetrics().density;
                insetTop = Math.round(bars.top / density); insetBottom = Math.round(bars.bottom / density);
                v.setPadding(bars.left, 0, bars.right, keyboard.bottom > bars.bottom ? keyboard.bottom : 0);
            } else {
                float density = getResources().getDisplayMetrics().density;
                insetTop = Math.round(insets.getSystemWindowInsetTop() / density);
                int bottom = insets.getSystemWindowInsetBottom();
                boolean keyboard = bottom > dpForInsets(100);
                if (!keyboard) insetBottom = Math.round(bottom / density);
                v.setPadding(insets.getSystemWindowInsetLeft(), 0, insets.getSystemWindowInsetRight(), keyboard ? bottom : 0);
            }
            if (web != null && amsMobilePage()) web.evaluateJavascript(insetScript()
                    + "if(window.__amsSetInsets)window.__amsSetInsets(window.__amsInsets);", null);
            updateNavigation();
            return insets;
        });
        connectionNotice = new android.widget.TextView(this);
        connectionNotice.setText("连接暂时中断，正在自动重试…\n点击可立即重试");
        connectionNotice.setTextColor(0xFF69758A);
        connectionNotice.setTextSize(15);
        connectionNotice.setGravity(android.view.Gravity.CENTER);
        connectionNotice.setVisibility(android.view.View.GONE);
        connectionNotice.setOnClickListener(v -> { retryHandler.removeCallbacks(retryLoad); if (retryPending) retryLoad.run(); });
        root.addView(connectionNotice, new LinearLayout.LayoutParams(-1, 0, 1));
        web = new WebView(this);
        web.setOverScrollMode(android.view.View.OVER_SCROLL_IF_CONTENT_SCROLLS);
        web.setBackgroundColor(night ? 0xFF15191F : 0xFFF5F6F8);
        android.widget.FrameLayout contentLayer=new android.widget.FrameLayout(this);
        contentLayer.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));
        navigationWeb=new WebView(this);navigationWeb.setBackgroundColor(android.graphics.Color.TRANSPARENT);
        navigationWeb.setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
        navigationWeb.getSettings().setJavaScriptEnabled(true);
        navigationWeb.getSettings().setAllowFileAccess(false);navigationWeb.getSettings().setAllowContentAccess(false);
        navigationWeb.setVisibility(android.view.View.GONE);
        // Tall enough for the floating bar and its shadow, so the shadow is never clipped into a full-width band.
        android.widget.FrameLayout.LayoutParams navigationLayout=new android.widget.FrameLayout.LayoutParams(-1,dpForInsets(92),android.view.Gravity.BOTTOM);
        contentLayer.addView(navigationWeb,navigationLayout);
        navigationWeb.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView v,String url){updateNavigation();}
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){
                Uri uri=request.getUrl();
                if("ams-nav".equals(uri.getScheme())&&"select".equals(uri.getHost())&&navigationVisible&&amsMobilePage()){
                    String index=uri.getQueryParameter("index");
                    if(index!=null&&index.matches("[0-3]"))web.evaluateJavascript("var f=document.getElementById('ams-managed-ui');if(f)f.contentWindow.postMessage({navIndex:"+index+"},'*');",null);
                }return true;
            }
        });
        try(InputStream in=getAssets().open("navigation.html")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);navigationWeb.loadDataWithBaseURL("https://navigation.local/",out.toString("UTF-8"),"text/html","UTF-8",null);}catch(IOException e){throw new IllegalStateException("Navigation asset missing",e);}
        root.addView(contentLayer, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Read only content URIs granted by the system file picker.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        schoolSession = new SchoolSession.Bridge(this, web);
        schoolSession.onSaved(this::schoolAccountChanged);
        web.addJavascriptInterface(schoolSession, SchoolSession.BRIDGE);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                // Mail links inside the managed iframe must never load in WebView.
                if ("mailto".equalsIgnoreCase(uri.getScheme())) {
                    if (amsMobilePage() && "mailto:linlantc@gmail.com".equalsIgnoreCase(uri.toString())) openCreatorEmail();
                    return true;
                }
                if (!request.isForMainFrame()) return false;
                if ("ams-local".equals(uri.getScheme())) {
                    if("navstate".equals(uri.getHost())&&amsMobilePage()){
                        String index=uri.getQueryParameter("index");
                        if(index!=null&&index.matches("[0-3]")){navigationIndex=Integer.parseInt(index);navigationVisible="true".equals(uri.getQueryParameter("visible"));updateNavigation();}
                    }
                    if ("reservations".equals(uri.getHost()) && amsMobilePage()) {
                        String service=uri.getQueryParameter("service");
                        if ("seat".equals(service)||"room".equals(service)||"fb".equals(service)||"sports".equals(service)||"bus".equals(service)||"records".equals(service)||"seatRecords".equals(service)||"roomRecords".equals(service)) {
                            boolean records="records".equals(service)||"seatRecords".equals(service)||"roomRecords".equals(service);
                            Class<?> screen="sports".equals(service)?SportsReservationActivity.class:"seat".equals(service)?SeatReservationActivity.class:"room".equals(service)?RoomReservationActivity.class:"fb".equals(service)?FbReservationActivity.class:records?RecordsReservationActivity.class:ReservationActivity.class;
                            startActivity(new Intent(MainActivity.this,screen).putExtra("service",service).addFlags("bus".equals(service)?0:Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
                        }
                    }
                    if ("hhtcode".equals(uri.getHost()) && amsMobilePage()) {
                        startActivity(new Intent(MainActivity.this,HhtActivity.class));
                    }
                    if ("xjcode".equals(uri.getHost()) && amsMobilePage()) {
                        startActivity(new Intent(MainActivity.this,XipuCodeActivity.class));
                    }
                    if ("logout".equals(uri.getHost()) && amsMobilePage()) logoutSchool();
                    if ("scan".equals(uri.getHost()) && amsMobilePage() && !scannerOpen) {
                        openScanner();
                    }
                    if ("theme".equals(uri.getHost()) && amsMobilePage()) {
                        String key=uri.getQueryParameter("key");if(AppTheme.validKey(key)){getSharedPreferences("amsAppearance",MODE_PRIVATE).edit().putString("theme",key).apply();updateNavigation();}
                    }
                    if ("appearance".equals(uri.getHost()) && amsMobilePage()) {
                        String mode = uri.getQueryParameter("mode");
                        if ("system".equals(mode) || "light".equals(mode) || "dark".equals(mode)) {
                            getSharedPreferences("amsAppearance", MODE_PRIVATE).edit().putString("mode", mode).apply();
                            updateAppearance(true);
                        }
                    }
                    if ("supportcreator".equals(uri.getHost()) && amsMobilePage()) openBrowser("https://afdian.com/a/tristanchayne");
                    if ("checkupdate".equals(uri.getHost()) && amsMobilePage()) checkUpdateManually();
                    if ("keepalive".equals(uri.getHost()) && amsMobilePage()) {
                        String days = uri.getQueryParameter("days");
                        if (("true".equals(uri.getQueryParameter("enabled")) || "false".equals(uri.getQueryParameter("enabled"))) && days != null && days.matches("[357]")) {
                            SportsKeepAlive.setPreference(MainActivity.this, "true".equals(uri.getQueryParameter("enabled")), Integer.parseInt(days));
                            view.evaluateJavascript(keepAliveScript(), null);
                        }
                    }
                    if ("email".equals(uri.getHost()) && amsMobilePage()) openCreatorEmail();
                    if ("schedule".equals(uri.getHost()) && amsMobilePage()) {
                        view.evaluateJavascript("JSON.stringify(window.__amsSchedule||null)", value -> {
                            try { String json = new org.json.JSONArray("[" + value + "]").getString(0); if (CourseReminder.receiveSchedule(MainActivity.this, json) && amsMobilePage()) web.evaluateJavascript(CourseReminder.webScript(MainActivity.this), null); } catch (Exception ignored) {}
                        });
                    }
                    if ("coursereminder".equals(uri.getHost()) && amsMobilePage()) {
                        String change = uri.getQueryParameter("change");
                        if (change != null && change.contains("\"openSettings\":true")) {
                            Intent settings = CourseReminder.settingsIntent(MainActivity.this);
                            if (settings != null) try { startActivity(settings); } catch (ActivityNotFoundException ignored) {}
                        } else if (CourseReminder.receiveChange(MainActivity.this, change) && Build.VERSION.SDK_INT >= 33
                                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFY_REQUEST);
                        }
                        view.evaluateJavascript(CourseReminder.webScript(MainActivity.this), null);
                    }
                    return true;
                }
                if (schoolPage(uri)) return false;
                if ("https".equalsIgnoreCase(uri.getScheme())) openBrowser(uri.toString());
                else AppDialog.show(MainActivity.this, "无法打开此链接", "只支持加密的 HTTPS 链接，已阻止打开。", "知道了", null, null, null);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                navigationVisible=false;updateNavigation();
                cancelCamera();
                loadFailed = false;


            }
            @Override public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                if (!loadFailed) recovered();
                if (clearingLogoutHistory) { view.clearHistory(); clearingLogoutHistory = false; }
                if (!loadFailed) schoolSession.install();

                if(!loadFailed&&amsMobilePage())view.evaluateJavascript("localStorage.getItem('amsTheme')||'blue'",value->{
                    if(!amsMobilePage())return;
                    try{String key=new org.json.JSONArray("["+value+"]").getString(0);if("orange".equals(key))key="smoke";if(AppTheme.validKey(key)){getSharedPreferences("amsAppearance",MODE_PRIVATE).edit().putString("theme",key).apply();updateNavigation();}}catch(Exception ignored){}
                });
                if (!loadFailed && amsMobilePage() && scanEntryScript != null)
                    view.evaluateJavascript(appearanceScript() + insetScript() + scanEntryScript + ";if(window.__amsSetAppearance)window.__amsSetAppearance(window.__amsAppearance.appearance,window.__amsAppearance.dark);" + keepAliveScript() + CourseReminder.webScript(MainActivity.this), null);
                if (!loadFailed && amsMobilePage()) consumeScan();

            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                int code = error.getErrorCode();
                boolean transientError = code == ERROR_HOST_LOOKUP || code == ERROR_CONNECT
                        || code == ERROR_TIMEOUT || code == ERROR_IO;
                if (transientError && "GET".equals(request.getMethod()) && schoolPage(request.getUrl())) retryConnection();
                else showFailure("加载失败，请检查网络后重试");
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (!request.isForMainFrame()) return;
                if (response.getStatusCode() >= 500 && "GET".equals(request.getMethod()) && schoolPage(request.getUrl())) retryConnection();
                else showFailure("学校页面返回错误：" + response.getStatusCode());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();
                WebResourceResponse restore = SchoolSession.restoreResponse(request);
                if (restore != null) return restore;
                if ("https".equals(uri.getScheme()) && "ams.xjtlu.edu.cn".equals(uri.getHost()) && "/__campus/daily-lines.json".equals(uri.getPath())) {
                    try { return new WebResourceResponse("application/json", "UTF-8", getAssets().open("daily-lines.json")); }
                    catch (IOException e) { return null; }
                }
                if ("https".equals(uri.getScheme()) && "ams.xjtlu.edu.cn".equals(uri.getHost())) {
                    String asset = "/__campus/maps/tc.jpg".equals(uri.getPath()) ? "maps/tc.jpg"
                            : "/__campus/maps/sip.png".equals(uri.getPath()) ? "maps/sip.png" : null;
                    if (asset != null) {
                        try { return new WebResourceResponse(asset.endsWith(".png") ? "image/png" : "image/jpeg", null, getAssets().open(asset)); }
                        catch (IOException e) { return null; }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                showFailure("连接证书验证失败，请检查设备时间后重试");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> callback,
                                                       FileChooserParams params) {
                if (!amsMobilePage()) return false;
                if (fileSelection != null) fileSelection.onReceiveValue(null);
                fileSelection = callback;
                Intent picker = new Intent(Intent.ACTION_GET_CONTENT);
                picker.setType("*/*");
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/jpeg", "image/png", "application/pdf",
                        "application/zip", "application/x-zip-compressed", "application/x-rar-compressed",
                        "application/vnd.rar", "application/octet-stream"});
                try { startActivityForResult(Intent.createChooser(picker, "选择请假证明"), 3); }
                catch (ActivityNotFoundException e) { fileSelection.onReceiveValue(null); fileSelection = null; }
                return true;
            }

            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!schoolPage(request.getOrigin()) || web.getUrl() == null
                            || !schoolPage(Uri.parse(web.getUrl()))
                            || !Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                        request.deny();
                        return;
                    }
                    cancelCamera();
                    pendingCamera = request;
                    AppDialog.show(MainActivity.this, null, "允许 " + request.getOrigin().getHost() + " 使用相机扫码？",
                            "允许", () -> {
                                if (pendingCamera != request) return;
                                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
                                    grantCamera();
                                else requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST);
                            }, "取消", () -> cancelCamera());
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                runOnUiThread(() -> { if (pendingCamera == request) pendingCamera = null; });
            }
        });
        // A new WebView has empty sessionStorage; put the school's saved session back before AMS starts.
        String restore = SchoolSession.amsRestoreUrl(this);
        if (restore != null) web.loadUrl(restore);
        else if (saved == null || web.restoreState(saved) == null) web.loadUrl(HOME);
    }

    private void showVersionNotice() { showVersionNotice(false); }
    private boolean showVersionNotice(boolean force) {
        if (!foreground || scannerOpen || isFinishing() || isDestroyed() || (updateDialog != null && updateDialog.isShowing())) return false;
        try {
            android.content.SharedPreferences p = getSharedPreferences("activation", 0);
            String release = p.getString("release", ""); if (release.isEmpty()) return false;
            JSONObject info = new JSONObject(release); int version = info.getInt("versionCode");
            if (version <= getPackageManager().getPackageInfo(getPackageName(), 0).versionCode) return false;
            Uri uri = Uri.parse(info.getString("url"));
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) throw new IllegalArgumentException();
            long now = System.currentTimeMillis();
            if (!force && p.getInt("promptVersion", 0) == version && now - p.getLong("promptTime", 0) < 86400000L) return false;
            p.edit().putInt("promptVersion", version).putLong("promptTime", now).apply();
            updateDialog = UpdateNotice.show(this, info.optString("versionName", ""), info.optString("notes", ""), uri.getHost(), () -> openBrowser(uri.toString()));
            return true;
        } catch (Exception ignored) { if(force) AppDialog.show(this,"更新信息暂不可用","暂时无法读取更新信息，请稍后重试。","知道了",null,null,null); return false; }
    }
    /**
     * Server check on every cold start and return to foreground (ADMIN-BE-001 / D-020), one at a time. A request made
     * while one is running (e.g. the school account changed meanwhile) runs once more afterwards. Network failure never
     * blocks the app; only an explicit disable from the server does.
     */
    private boolean licenseRecheck;
    private void runLicenseCheck() {
        if (!getSharedPreferences("activation", 0).getBoolean("accountSyncNoticeSeen", false)) return;
        if (!checkingLicense.compareAndSet(false, true)) { licenseRecheck = true; return; }
        licenseRecheck = false;
        new Thread(() -> {
            try { Activation.refresh(getApplicationContext()); } catch (Exception ignored) { /* Network failure does not block the app. */ }
            finally { checkingLicense.set(false); }
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                if (!Activation.valid(this)) { startActivity(new Intent(this, ActivationActivity.class)); finish(); return; }
                if (licenseRecheck) { runLicenseCheck(); return; }
                if (foreground && !showInboxMessage() && !showAnnouncement()) showVersionNotice();
            });
        }).start();
    }
    /** Once per installation, including upgrades that already hold an activation grant. */
    private boolean showAccountSyncNotice() {
        android.content.SharedPreferences p = getSharedPreferences("activation", 0);
        if (p.getBoolean("accountSyncNoticeSeen", false)) return false;
        if (updateDialog != null && updateDialog.isShowing()) return true;
        updateDialog = AppDialog.show(this, "设备账户同步",
                "当前学校账户名会同步到服务器，用于设备管理；密码和登录凭证不会上传。",
                "知道了", () -> {
                    p.edit().putBoolean("accountSyncNoticeSeen", true).apply();
                    Activation.noteAccount(this, Activation.account(SchoolSession.read(this)));
                    runLicenseCheck();
                }, null, null);
        updateDialog.setCancelable(false);
        updateDialog.setCanceledOnTouchOutside(false);
        return true;
    }
    /** Login, account switch or logout: the device record follows the current school account. */
    void schoolAccountChanged() {
        if (Activation.noteAccount(this, Activation.account(SchoolSession.read(this)))) runLicenseCheck();
    }
    /** Displays the next unread device message obtained by the signed foreground check. */
    private boolean showInboxMessage() {
        if (!foreground || scannerOpen || isFinishing() || isDestroyed() || (updateDialog != null && updateDialog.isShowing())) return false;
        android.content.SharedPreferences prefs = getSharedPreferences("activation", 0);
        JSONObject message = MessageInbox.next(prefs, System.currentTimeMillis());
        if (message == null) return false;
        String id = message.optString("id");
        Runnable confirm = () -> { MessageInbox.confirm(prefs, id); runLicenseCheck(); };
        Uri link = message.isNull("url") ? null : Uri.parse(message.optString("url", ""));
        boolean openable = link != null && "https".equalsIgnoreCase(link.getScheme()) && link.getHost() != null && link.getUserInfo() == null;
        updateDialog = AppDialog.show(this, message.optString("title", "AMS 消息"), message.optString("body", ""), "知道了", confirm,
                openable ? "查看详情" : null, openable ? () -> { confirm.run(); openBrowser(link.toString()); } : null);
        return true;
    }
    /** Shows the newest active announcement not yet confirmed (delivered with the per-open check). */
    private boolean showAnnouncement() {
        if (!foreground || scannerOpen || isFinishing() || isDestroyed() || (updateDialog != null && updateDialog.isShowing())) return false;
        try {
            android.content.SharedPreferences p = getSharedPreferences("activation", 0);
            org.json.JSONArray list = new org.json.JSONArray(p.getString("announcements", "[]"));
            java.util.Set<String> seen = new java.util.HashSet<>(p.getStringSet("announcementSeen", new java.util.HashSet<>()));
            for (int i = 0; i < list.length(); i++) {
                JSONObject a = list.getJSONObject(i); String id = a.optString("id", "");
                if (id.isEmpty() || seen.contains(id)) continue;
                String expires = a.optString("expiresAt", "");
                if (!expires.isEmpty() && java.time.Instant.parse(expires).toEpochMilli() <= System.currentTimeMillis()) continue;
                Runnable confirm = () -> { if (seen.size() > 30) seen.clear(); seen.add(id); p.edit().putStringSet("announcementSeen", new java.util.HashSet<>(seen)).apply(); };
                Uri link = a.has("url") ? Uri.parse(a.getString("url")) : null;
                boolean openable = link != null && "https".equalsIgnoreCase(link.getScheme()) && link.getHost() != null && link.getUserInfo() == null;
                updateDialog = AppDialog.show(this, a.optString("title", "公告"), a.optString("message", ""), "知道了", confirm,
                        openable ? "查看详情" : null, openable ? () -> { confirm.run(); openBrowser(link.toString()); } : null);
                return true;
            }
        } catch (Exception ignored) {}
        return false;
    }    private void checkUpdateManually() {
        if (!Activation.valid(this)) { startActivity(new Intent(this,ActivationActivity.class)); finish(); return; }
        if (!checkingLicense.compareAndSet(false,true)) { AppNotice.show(this,"正在与服务器通讯，请稍后再试"); return; }
        if (updateDialog != null && updateDialog.isShowing()) updateDialog.dismiss();
        updateDialog = AppDialog.progress(this, "正在检查更新…");
        new Thread(() -> {
            String error = null;
            try { Activation.refresh(getApplicationContext()); }
            catch (Exception e) { error = "无法连接更新服务器，请检查网络后重试。"; }
            final String result = error;
            runOnUiThread(() -> {
                checkingLicense.set(false);
                if (isFinishing() || isDestroyed()) return;
                if (updateDialog != null && updateDialog.isShowing()) updateDialog.dismiss();
                pendingManualUpdate = true; manualUpdateError = result;
                if (foreground) finishManualUpdate();
            });
        }).start();
    }
    private void finishManualUpdate() {
        pendingManualUpdate = false;
        if (!Activation.valid(this)) { startActivity(new Intent(this,ActivationActivity.class)); finish(); return; }
        if (manualUpdateError != null) {
            updateDialog = AppDialog.show(this, "检查更新失败", manualUpdateError, "重试", this::checkUpdateManually, "关闭", null);
        } else if (!showVersionNotice(true)) {
            try {
                JSONObject release = new JSONObject(getSharedPreferences("activation",0).getString("release","{}"));
                if(release.getInt("versionCode") <= getPackageManager().getPackageInfo(getPackageName(),0).versionCode) {
                    updateDialog = AppDialog.show(this, "已是最新版本", "当前版本 " + getPackageManager().getPackageInfo(getPackageName(),0).versionName, "知道了", null, null, null);
                }
            } catch (Exception ignored) { AppDialog.show(this,"更新信息暂不可用","暂时无法读取更新信息，请稍后重试。","知道了",null,null,null); }
        }
    }
    private void recovered() {
        retryPending = false;
        retryCount = 0;
        retryHandler.removeCallbacks(retryLoad);
        connectionNotice.setVisibility(android.view.View.GONE);
        web.setVisibility(android.view.View.VISIBLE);
    }
    private void retryConnection() {
        if (isFinishing() || isDestroyed()) return;
        loadFailed = true;
        retryPending = true;
        retryHandler.removeCallbacks(retryLoad);
        connectionNotice.setVisibility(android.view.View.VISIBLE);
        web.setVisibility(android.view.View.GONE);
        long delay = Math.min(30000L, 2000L << Math.min(retryCount++, 4));
        if (foreground) retryHandler.postDelayed(retryLoad, delay);
    }
    private void showFailure(String message) {
        retryPending = false;
        retryHandler.removeCallbacks(retryLoad);
        connectionNotice.setVisibility(android.view.View.GONE);
        web.setVisibility(android.view.View.VISIBLE);
        if (loadFailed || isFinishing()) return;
        loadFailed = true;
        AppDialog.show(this, null, message, "重试", () -> web.loadUrl(HOME), "关闭", null);
    }
    private void openScanner() {
        if (!amsMobilePage() || scannerOpen || isFinishing()) return;
        scannerOpen = true;
        startActivityForResult(new Intent(this, ScannerActivity.class), 2);
        overridePendingTransition(0, 0);
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && CourseReminder.ACTION_SCAN.equals(intent.getAction())) { setIntent(intent); pendingScan = true; consumeScan(); }
    }
    /** Opens the scanner once the signed-in AMS page is up, from the home route like the in-app scan button. */
    private void consumeScan() {
        if (!pendingScan || web == null || loadFailed || scannerOpen || !amsMobilePage() || isFinishing()) return;
        pendingScan = false;
        web.evaluateJavascript("if(!/#\\/home/.test(location.hash))location.hash='#/home';", null);
        web.postDelayed(() -> { if (!isFinishing() && !isDestroyed()) openScanner(); }, 300);
    }
    private void logoutSchool() {
        SchoolSession.clearAll(this);
        schoolAccountChanged();
        schoolSession.renew();
        SportsKeepAlive.reset(this);
        CourseReminder.clear(this);
        CookieManager.getInstance().removeAllCookies(done -> {
            CookieManager.getInstance().flush();
            web.clearCache(true);
            web.clearHistory();
            android.webkit.WebStorage.getInstance().deleteOrigin("https://uim.xjtlu.edu.cn");
            clearingLogoutHistory = true;
            web.loadUrl(HOME);
        });
    }
    private void openCreatorEmail() {
        try { startActivity(new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:linlantc@gmail.com"))); }
        catch (ActivityNotFoundException e) {
            AppDialog.show(this, "未找到邮件应用", "可以复制邮箱地址，在邮件应用中联系作者。\nlinlantc@gmail.com", "复制邮箱", () -> {
                    android.content.ClipboardManager clipboard = (android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("作者邮箱", "linlantc@gmail.com"));
                    AppNotice.show(this, "邮箱已复制");
                }, "关闭", null);
        }
    }
    private void openBrowser(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (ActivityNotFoundException e) { AppDialog.show(this, "未找到浏览器", "请安装或启用浏览器后再打开此链接。", "知道了", null, null, null); }
    }
    private void grantCamera() {
        if (pendingCamera != null) {
            pendingCamera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            pendingCamera = null;
        }
    }
    private boolean amsMobilePage() {
        if (web.getUrl() == null) return false;
        Uri uri = Uri.parse(web.getUrl());
        return "https".equalsIgnoreCase(uri.getScheme()) && "ams.xjtlu.edu.cn".equalsIgnoreCase(uri.getHost())
                && uri.getPath() != null && uri.getPath().startsWith("/studenth5/");
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 3) {
            if (fileSelection != null) fileSelection.onReceiveValue(
                    result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
            fileSelection = null;
            return;
        }
        if (request == 2) scannerOpen = false;
        if (request != 2 || result != RESULT_OK || data == null) return;
        String qr = data.getStringExtra("qr");
        // Matches the existing AMS WeChat scanner's resultStr.split('=')[1].
        String[] pieces = qr == null ? new String[0] : qr.split("=", -1);
        String code = pieces.length > 1 ? pieces[1] : "";
        if (code.isEmpty() || code.length() > 2048) {
            AppDialog.show(this, null, "二维码格式不符合当前 AMS 网页的签到格式，请检查是否为课堂签到二维码。", "知道了", null, null, null);
            return;
        }
        submitScannedCode(code);
    }
    private void submitScannedCode(String code) {
        submitScannedCode(code, 0);
    }
    private void submitScannedCode(String code, int attempt) {
        if (!amsMobilePage()) return;
        String script = scanSubmitScript + "\nwindow.__amsSubmitScan(" + JSONObject.quote(code) + ");";
        web.evaluateJavascript(script, result -> {
            if (isFinishing() || isDestroyed()) return;
            if ("\"unavailable\"".equals(result) && attempt < 3) {
                web.postDelayed(() -> { if (!isFinishing() && !isDestroyed()) submitScannedCode(code, attempt + 1); }, 100);
                return;
            }
            if (!"\"submitted\"".equals(result)) AppDialog.show(this, null, "\"handler-error\"".equals(result)
                            ? "学校签到处理发生异常，请先查看签到记录，避免重复提交。"
                            : "学校签到主页尚未就绪，请返回课表后重试；本次未提交。", "知道了", null, null, null);
        });
    }
    private void cancelCamera() {
        if (pendingCamera != null) { pendingCamera.deny(); pendingCamera = null; }
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == CAMERA_REQUEST) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) grantCamera();
            else cancelCamera();
        }
        if (code == NOTIFY_REQUEST && web != null && amsMobilePage()) { CourseReminder.refresh(this); web.evaluateJavascript(CourseReminder.webScript(this), null); }
    }
    @Override public void onBackPressed() {
        if (web == null) { finishAffinity(); return; }
        web.evaluateJavascript("Boolean(window.__amsHandleBack && window.__amsHandleBack())", handled -> {
            if (isFinishing() || isDestroyed() || "true".equals(handled)) return;
            if (web.canGoBack()) web.goBack(); else finishAffinity();
        });
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        if (web != null) web.saveState(state);
        super.onSaveInstanceState(state);
    }
    @Override protected void onPause() { foreground = false; retryHandler.removeCallbacksAndMessages(null); if (web != null) { schoolSession.sync(); web.onPause(); } super.onPause(); }
    @Override protected void onResume() {
        super.onResume();
        foreground = true;
        if (web == null) return;
        web.onResume();
        web.evaluateJavascript("window.__amsRefreshClock && window.__amsRefreshClock();", null);
        // The choice may have been made in the sports screen meanwhile; settings must show the stored state.
        if (amsMobilePage()) web.evaluateJavascript(keepAliveScript(), null);
        // Alarms vanish after force-stop or update; reopening re-arms reminders and refreshes the settings state.
        CourseReminder.refresh(this);
        if (amsMobilePage()) web.evaluateJavascript(CourseReminder.webScript(this), null);
        consumeScan();
        updateAppearance(false);
        if (!Activation.valid(this)) { startActivity(new Intent(this, ActivationActivity.class)); finish(); return; }
        SportsKeepAlive.ensureScheduled(this);
        if (!showAccountSyncNotice()) {
            if (pendingManualUpdate) finishManualUpdate(); else if (!showInboxMessage() && !showAnnouncement()) showVersionNotice();
            Activation.noteAccount(this, Activation.account(SchoolSession.read(this)));
            runLicenseCheck();
        }
        if (retryPending) retryHandler.postDelayed(retryLoad, 500);
        if (!loadFailed && amsMobilePage() && scanEntryScript != null) web.evaluateJavascript(appearanceScript() + insetScript() + scanEntryScript + ";if(window.__amsSetAppearance)window.__amsSetAppearance(window.__amsAppearance.appearance,window.__amsAppearance.dark);", null);
    }
    @Override protected void onDestroy() { retryHandler.removeCallbacksAndMessages(null); if (updateDialog != null) updateDialog.dismiss(); if (fileSelection != null) fileSelection.onReceiveValue(null); cancelCamera(); if (web != null) { web.removeJavascriptInterface(SchoolSession.BRIDGE); web.destroy(); } if(navigationWeb!=null)navigationWeb.destroy(); super.onDestroy(); }
}

