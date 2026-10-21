package cn.local.ams;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.*;
import android.widget.*;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.IdentityHashMap;

/** Official sports service in a dedicated mobile WebView; the service owns all transactions. */
public final class SportsReservationActivity extends Activity {
    private static final String ROOT = "https://sportscentre.xipueduinno.cn/website/";
    private final String[] destinations = {"court", "order#/", "member#/ticket"};
    private final ArrayList<WebView> previousWindows = new ArrayList<>();
    private final IdentityHashMap<WebView, SportsWebLoadState> pageStates = new IdentityHashMap<>();
    private LinearLayout root, tabs;
    private FrameLayout content;
    private WebView web;
    private ProgressBar progress;
    private LinearLayout loading, error;
    private TextView title, loadingMessage, errorMessage;
    private Button backButton;
    private Button errorAction;
    private AppTheme theme;
    private String css = "", presentation = "", retryUrl = ROOT + "court";
    private boolean foreground, paymentFailure, writeFailure, assetMissing, keepAlivePrompting;
    /** Watches for the first official login (presence of the page's display-only loginObj), then asks about keep-alive once. */
    private final Runnable loginWatch = new Runnable() { @Override public void run() {
        if (!foreground || keepAlivePrompting || web == null || SportsKeepAlive.decided(SportsReservationActivity.this)) return;
        if (!SportsNavigation.official(web.getUrl()) || paying()) { root.postDelayed(this, 3000); return; }
        web.evaluateJavascript("Boolean(localStorage.getItem('loginObj'))", value -> {
            if (!foreground || keepAlivePrompting) return;
            if (!"true".equals(value)) { root.postDelayed(this, 3000); return; }
            keepAlivePrompting = true;
            // The server, not the page flag, confirms the session before asking.
            SportsKeepAlive.check(SportsReservationActivity.this, signedIn -> {
                if (Boolean.TRUE.equals(signedIn) && foreground && !SportsKeepAlive.decided(SportsReservationActivity.this)) showKeepAliveChoice();
                else { keepAlivePrompting = false; root.postDelayed(this, 3000); }
            });
        });
    }};

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (!Activation.valid(this)) { startActivity(new Intent(this, ActivationActivity.class)); finish(); return; }
        theme = AppTheme.read(this);
        applySportsSystemBars();
        try (InputStream in = getAssets().open("sports-theme.css")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] b = new byte[4096]; int n;
            while ((n = in.read(b)) != -1) out.write(b, 0, n); css = out.toString("UTF-8");
        } catch (Exception e) { assetMissing = true; }
        try (InputStream in = getAssets().open("sports-ui.js")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] b = new byte[4096]; int n;
            while ((n = in.read(b)) != -1) out.write(b, 0, n); presentation = out.toString("UTF-8");
        } catch (Exception e) { assetMissing = true; }
        if (assetMissing) AppNotice.show(this, "部分界面组件未能加载，请重新安装 App");
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setFitsSystemWindows(false); AppTheme.role(root, "paper"); setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            // Tabs draw through the navigation area; their buttons stay above it. The root only
            // adds the keyboard remainder, so navigation/IME padding is never counted twice.
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
                android.graphics.Insets keyboard = insets.getInsets(android.view.WindowInsets.Type.ime());
                applySportsInsets(bars.left, bars.top, bars.right, bars.bottom, keyboard.bottom);
                return new android.view.WindowInsets.Builder(insets).setInsets(
                        android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout()
                                | android.view.WindowInsets.Type.ime(), android.graphics.Insets.NONE)
                        .setInsetsIgnoringVisibility(android.view.WindowInsets.Type.systemBars()
                                | android.view.WindowInsets.Type.displayCutout(), android.graphics.Insets.NONE).build();
            }
            int bottom = Math.min(insets.getStableInsetBottom(), insets.getSystemWindowInsetBottom());
            applySportsInsets(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), bottom, insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets().consumeStableInsets();
        });
        LinearLayout header = new LinearLayout(this); header.setGravity(android.view.Gravity.CENTER_VERTICAL);
        header.setPadding(dp(12), dp(6), dp(12), dp(6));
        // Web back only appears when there is a page to go back to; "×" always leaves sports.
        backButton = button("‹ 返回", "plain"); backButton.setOnClickListener(v -> onBackPressed()); backButton.setVisibility(View.GONE);
        header.addView(backButton, new LinearLayout.LayoutParams(dp(76), dp(48)));
        title = new TextView(this); title.setText("体育馆预约"); title.setTextSize(19);
        title.setTypeface(null, android.graphics.Typeface.BOLD); AppTheme.role(title, "ink");
        header.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1)); title.setGravity(android.view.Gravity.CENTER_VERTICAL);
        Button close = button("×", "plain"); close.setTextSize(24); close.setContentDescription("关闭体育馆");
        close.setOnClickListener(v -> leavePayment(this::finish));
        header.addView(close, new LinearLayout.LayoutParams(dp(48), dp(48))); root.addView(header);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100); AppTheme.role(progress, "progress"); root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        content = new FrameLayout(this); root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        web = new WebView(this); configure(web); content.addView(web, new FrameLayout.LayoutParams(-1, -1));
        loading = new LinearLayout(this); loading.setOrientation(LinearLayout.VERTICAL); loading.setGravity(android.view.Gravity.CENTER);
        loading.setPadding(dp(24), dp(24), dp(24), dp(24)); AppTheme.role(loading, "paper");
        ProgressBar loadingProgress = new ProgressBar(this, null, android.R.attr.progressBarStyleLarge);
        AppTheme.role(loadingProgress, "progress");
        LinearLayout.LayoutParams loadingProgressParams = new LinearLayout.LayoutParams(dp(36), dp(36));
        loadingProgressParams.bottomMargin = dp(14); loading.addView(loadingProgress, loadingProgressParams);
        loadingMessage = new TextView(this); loadingMessage.setText("正在连接体育中心…");
        loadingMessage.setGravity(android.view.Gravity.CENTER); loadingMessage.setTextSize(16);
        loadingMessage.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        AppTheme.role(loadingMessage, "ink"); loading.addView(loadingMessage);
        content.addView(loading, new FrameLayout.LayoutParams(-1, -1)); loading.setVisibility(View.GONE);
        error = new LinearLayout(this); error.setOrientation(LinearLayout.VERTICAL); error.setGravity(android.view.Gravity.CENTER);
        error.setPadding(dp(28), dp(28), dp(28), dp(28)); AppTheme.role(error, "paper");
        errorMessage = new TextView(this); errorMessage.setText("体育中心暂时无法连接\n请检查网络后重试");
        errorMessage.setGravity(android.view.Gravity.CENTER); errorMessage.setTextSize(16);
        errorMessage.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_ASSERTIVE);
        AppTheme.role(errorMessage, "ink"); error.addView(errorMessage);
        errorAction = button("重新连接", "primary"); error.addView(errorAction);
        errorAction.setOnClickListener(v -> {
            if (paymentFailure || writeFailure) { navigate(1); return; }
            showLoading(web, retryUrl, "正在重新连接体育中心…"); web.loadUrl(retryUrl);
        });
        error.setVisibility(View.GONE); content.addView(error, new FrameLayout.LayoutParams(-1, -1));
        tabs = new LinearLayout(this); tabs.setPadding(dp(12), dp(8), dp(12), dp(8));
        String[] labels = {"场馆预约", "我的订单", "我的票券"};
        for (int i = 0; i < labels.length; i++) {
            final int index = i; Button b = button(labels[i], "plain");
            b.setStateListAnimator(null); b.setElevation(0);
            b.setOnClickListener(v -> navigate(index));
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(48), 1); p.setMargins(dp(3), 0, dp(3), 0); tabs.addView(b, p);
        }
        root.addView(tabs); root.requestApplyInsets(); applyTheme();
        if (saved == null || web.restoreState(saved) == null) navigate(0);
    }
    private void applySportsInsets(int left, int top, int right, int navigationBottom, int keyboardBottom) {
        root.setPadding(left, top, right, Math.max(0, keyboardBottom - navigationBottom));
        if (tabs != null) tabs.setPadding(dp(12), dp(8), dp(12), dp(8) + navigationBottom);
    }
    private void applySportsSystemBars() {
        android.view.Window window = getWindow();
        int sdk = android.os.Build.VERSION.SDK_INT;
        window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(theme.paper));
        if (sdk >= 30) window.setDecorFitsSystemWindows(false);
        else window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
        window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        if (sdk >= 28) window.setNavigationBarDividerColor(android.graphics.Color.TRANSPARENT);
        if (sdk >= 29) {
            window.setNavigationBarContrastEnforced(false);
            window.setStatusBarContrastEnforced(false);
        }
        window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | (theme.dark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR));
    }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private Button button(String label, String role) {
        Button b = new Button(this); b.setText(label); b.setTextSize(14); b.setAllCaps(false);
        b.setPadding(dp(8), 0, dp(8), 0); b.setMinWidth(0); b.setMinimumWidth(0); AppTheme.role(b, role); return b;
    }
    private void navigate(int index) {
        leavePayment(() -> loadSection(index));
    }
    private void leavePayment(Runnable leave) {
        if (paying()) {
            // Staying is the filled default; leaving is the secondary action, as before.
            AppDialog.show(this, "离开支付页面？", "支付结果可在“我的订单”中查看。", "继续支付", null, "离开", leave, null);
        } else leave.run();
    }
    private void loadSection(int index) {
        paymentFailure = false; writeFailure = false;
        retryUrl = SportsNavigation.safeRetryUrl(ROOT + destinations[index]);
        String url = ROOT + destinations[index];
        showLoading(web, url, "正在加载体育中心…");
        web.loadUrl(url);
    }
    private SportsWebLoadState pageState(WebView page) {
        SportsWebLoadState state = pageStates.get(page);
        if (state == null) { state = new SportsWebLoadState(); pageStates.put(page, state); }
        return state;
    }
    private void showLoading(WebView page, String url, String message) {
        pageState(page).beginNavigation(url);
        displayLoading(message);
    }
    private void displayLoading(String message) {
        loadingMessage.setText(message); loading.setVisibility(View.VISIBLE); error.setVisibility(View.GONE);
        progress.setProgress(0); progress.setVisibility(View.VISIBLE);
        if (web != null) web.setVisibility(View.INVISIBLE);
    }
    private void showLoadedPage(WebView page, SportsWebLoadState state) {
        if (page != web || !state.isContentReady()) return;
        loading.setVisibility(View.GONE); error.setVisibility(View.GONE);
        page.setVisibility(View.VISIBLE);
    }
    private void prepareCommittedPage(WebView page, String url, SportsWebLoadState state) {
        if (page != web || !state.isReadyForVisualPreparation(url) || !state.beginVisualPreparation(url)) return;
        long generation = state.generation();
        Runnable waitForVisualState = () -> {
            if (page != web || !state.isCurrent(generation, url)) return;
            page.postVisualStateCallback(generation, new WebView.VisualStateCallback() {
                @Override public void onComplete(long requestId) {
                    if (requestId == generation && page == web && state.markVisualReady(generation, url))
                        showLoadedPage(page, state);
                }
            });
        };
        if (SportsNavigation.official(url)) skin(page, url, waitForVisualState);
        else waitForVisualState.run();
    }
    private boolean paying() {
        String url = web.getUrl();
        return paymentUrl(url);
    }
    private boolean paymentUrl(String url) {
        if (url == null) return false;
        if (SportsNavigation.payment(url)) return true;
        try { return SportsNavigation.official(url) && "/website/pay".equals(Uri.parse(url).getPath()); }
        catch (Exception e) { return false; }
    }
    private int systemTextZoom() {
        return Math.round(getResources().getConfiguration().fontScale * 100f);
    }
    private void updateTabs(String url) {
        if (backButton != null) backButton.setVisibility(web != null && (web.canGoBack() || !previousWindows.isEmpty()) ? View.VISIBLE : View.GONE);
        if (title != null) title.setPadding(backButton != null && backButton.getVisibility() == View.VISIBLE ? 0 : dp(8), 0, 0, 0);
        int selected = url != null && url.contains("/order") ? 1 : url != null && url.contains("/member") ? 2 : 0;
        boolean paying = url != null && ("/website/pay".equals(Uri.parse(url).getPath()) || SportsNavigation.payment(url));
        title.setText(paying ? "确认与支付" : selected == 1 ? "体育馆订单" : selected == 2 ? "运动票券" : "体育馆预约");
        for (int i = 0; i < tabs.getChildCount(); i++) {
            View v = tabs.getChildAt(i); boolean active = !paying && i == selected;
            v.setSelected(active); AppTheme.role(v, active ? "soft" : "plain"); theme.apply(v);
        }
    }
    private void configure(WebView page) {
        final SportsWebLoadState state = new SportsWebLoadState();
        pageStates.put(page, state);
        WebSettings s = page.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(true); s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setUseWideViewPort(true); s.setLoadWithOverviewMode(false); s.setTextZoom(systemTextZoom());
        // Keep the Android mobile UA: the official payment page chooses H5 rather than desktop QR.
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(page, false);
        page.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest request) {
                // WebView skips shouldOverrideUrlLoading for POST. This blocks an untrusted main-frame request;
                // it is not a universal redirect or subresource filter, so URL routing below remains required.
                if (request.isForMainFrame() && !SportsNavigation.trusted(request.getUrl().toString())
                    && !SportsNavigation.app(request.getUrl().toString())) {
                    boolean post = "POST".equalsIgnoreCase(request.getMethod());
                    long observedGeneration = state.generation();
                    String url = request.getUrl().toString();
                    runOnUiThread(() -> {
                        if (v != web || state.generation() != observedGeneration) return;
                        if (!state.isCurrent(observedGeneration, url)) state.beginNavigation(url);
                        failure(v, url, post);
                    });
                    return new WebResourceResponse("text/plain", "UTF-8", new java.io.ByteArrayInputStream(new byte[0]));
                }
                return null;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                if (!request.isForMainFrame()) {
                    if (SportsNavigation.trusted(v.getUrl()) && SportsNavigation.app(request.getUrl().toString()))
                        return route(v, request.getUrl().toString(), false);
                    return !SportsNavigation.trusted(request.getUrl().toString());
                }
                return route(v, request.getUrl().toString(), request.hasGesture());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url) { return route(v, url, false); }
            @Override public void onPageStarted(WebView v, String url, android.graphics.Bitmap icon) {
                if (v == web) {
                    state.onPageStarted(url);
                    if (state.isFailed()) return;
                    if (!paymentUrl(url)) retryUrl = SportsNavigation.safeRetryUrl(url);
                    displayLoading(paymentUrl(url) ? "正在连接支付页面…" : "正在加载体育中心…"); updateTabs(url);
                }
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (v == web) {
                    progress.setVisibility(View.GONE); updateTabs(url);
                    state.markFinished(url); prepareCommittedPage(v, url, state);
                }
                CookieManager.getInstance().flush();
            }
            @Override public void onPageCommitVisible(WebView v, String url) {
                if (v != web) return;
                state.markCommitted(url);
                updateTabs(url); prepareCommittedPage(v, url, state);
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (v == web && r.isForMainFrame()) failure(v, r.getUrl().toString(), v.getUrl(), "POST".equalsIgnoreCase(r.getMethod()));
            }
            @Override public void onReceivedHttpError(WebView v, WebResourceRequest r, WebResourceResponse response) {
                if (v == web && SportsWebLoadState.isMainHttpError(r.isForMainFrame(), response.getStatusCode()))
                    failure(v, r.getUrl().toString(), v.getUrl(), "POST".equalsIgnoreCase(r.getMethod()));
            }
            @Override public void onReceivedSslError(WebView v, SslErrorHandler handler, android.net.http.SslError e) {
                handler.cancel();
                if (v == web && pageState(v).shouldFailForSsl(e.getUrl(), v.getUrl())) failure(v, e.getUrl(), v.getUrl(), false);
            }
        });
        page.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v, int value) { if (v == web) progress.setProgress(value); }
            @Override public void onPermissionRequest(PermissionRequest r) { r.deny(); }
            @Override public boolean onCreateWindow(WebView v, boolean dialog, boolean userGesture, android.os.Message message) {
                if (!foreground || v != web || (!userGesture && !paying()) || !SportsNavigation.trusted(v.getUrl())) return false;
                // Keep the actual target WebView: forwarding a URL would discard an Alipay POST body.
                WebView popup = new WebView(SportsReservationActivity.this); configure(popup);
                previousWindows.add(web); web.onPause(); content.removeView(web); web = popup;
                content.addView(popup, 0, new FrameLayout.LayoutParams(-1, -1));
                showLoading(popup, null, "正在打开支付页面…");
                ((WebView.WebViewTransport) message.obj).setWebView(popup); message.sendToTarget(); return true;
            }
            @Override public void onCloseWindow(WebView v) {
                if (v == web && !previousWindows.isEmpty()) restoreWindow();
                else if (v != web) { previousWindows.remove(v); v.destroy(); }
            }
        });
    }
    private boolean route(WebView source, String url, boolean gesture) {
        if (source != web) return true;
        if (SportsNavigation.trusted(url)) {
            return false;
        }
        String from = source.getUrl();
        boolean emptyPopup = (from == null || "about:blank".equals(from)) && !previousWindows.isEmpty();
        if (emptyPopup) from = previousWindows.get(previousWindows.size() - 1).getUrl();
        if (SportsNavigation.trusted(from) && SportsNavigation.app(url)) {
            if (!foreground) return true;
            // No intent:// parsing, components, arbitrary extras or unsafe browser fallbacks.
            try { Intent launch = new Intent(Intent.ACTION_VIEW, Uri.parse(url)); launch.addCategory(Intent.CATEGORY_BROWSABLE);
                launch.setPackage("weixin".equalsIgnoreCase(Uri.parse(url).getScheme()) ? "com.tencent.mm" : "com.eg.android.AlipayGphone"); startActivity(launch); }
            catch (android.content.ActivityNotFoundException e) { AppDialog.show(this, "未安装对应支付应用", "可以返回支付页，选择其他支付方式。", "知道了", null, null, null); }
            if (emptyPopup) source.post(() -> { if (source == web && !previousWindows.isEmpty()) restoreWindow(); });
        } else if (SportsNavigation.externalHttpsPrompt(from, url, gesture)) {
            AppDialog.show(this, null, "在浏览器打开此链接？", "打开", () -> {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
                    catch (android.content.ActivityNotFoundException e) { AppDialog.show(this, "未找到浏览器", "请安装或启用浏览器后再打开此链接。", "知道了", null, null, null); }
                }, "取消", null, null);
        } else AppDialog.show(this, "暂不支持此跳转", "该链接不在体育中心与支付的允许范围内，请返回体育中心页面继续操作。", "知道了", null, null, null);
        return true;
    }
    private void restoreWindow() {
        WebView closed = web; content.removeView(closed); closed.stopLoading(); pageStates.remove(closed); closed.destroy();
        web = previousWindows.remove(previousWindows.size() - 1); content.addView(web, 0, new FrameLayout.LayoutParams(-1, -1));
        progress.setVisibility(View.GONE);
        if (foreground) web.onResume(); applyTheme();
        showLoadedPage(web, pageState(web)); updateTabs(web.getUrl());
    }
    private void skin(WebView page, String url, Runnable afterInjection) {
        if (!SportsNavigation.official(url)) { if (afterInjection != null) afterInjection.run(); return; }
        String sportsMuted = theme.dark ? "#a4afbf" : "#596476";
        String pageCss = "html{--sports-muted:" + sportsMuted + ";--sports-accent:" + sportsAccent() + ";}" + css;
        String script = theme.webScript() + "(()=>{let s=document.getElementById('ams-sports-theme');if(!s){s=document.createElement('style');s.id='ams-sports-theme';document.head.appendChild(s)}s.textContent=" + JSONObject.quote(pageCss) + ";})();" + presentation;
        page.evaluateJavascript(script, result -> { if (afterInjection != null) afterInjection.run(); });
    }
    private String sportsAccent() {
        int[] backgrounds = {theme.paper, theme.surface, theme.input, theme.wash};
        for (int step = 0; step <= 100; step++) {
            double amount = step / 100.0;
            int candidate = 0xff000000;
            for (int shift : new int[]{16, 8, 0}) {
                int channel = (theme.accent >> shift) & 255;
                candidate |= Math.round(channel * (1.0 - amount)) << shift;
            }
            boolean readable = true;
            for (int background : backgrounds) if (contrast(candidate, background) < 4.5) { readable = false; break; }
            if (readable) return AppTheme.hex(candidate);
        }
        return "#000000";
    }
    private double contrast(int foreground, int background) {
        double a = luminance(foreground), b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    private double luminance(int color) {
        double r = channel(color >> 16), g = channel(color >> 8), b = channel(color);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    private double channel(int value) {
        double n = (value & 255) / 255.0;
        return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    }
    private void failure(WebView source, String url, boolean uncertainWrite) {
        failure(source, url, null, uncertainWrite);
    }
    private void failure(WebView source, String url, String currentPageUrl, boolean uncertainWrite) {
        if (source != web) return;
        SportsWebLoadState state = pageState(source);
        if (!state.failMainDocument(url, currentPageUrl)) return;
        paymentFailure = paymentUrl(url) || paying(); writeFailure = !paymentFailure && uncertainWrite;
        if (paymentFailure) {
            errorMessage.setText("支付状态暂时无法核实\n请到“我的订单”查看当前状态，避免重复付款");
            errorAction.setText("查看我的订单");
        } else if (writeFailure) {
            errorMessage.setText("提交状态暂时无法核实\n请先到“我的订单”查看，不要重复提交");
            errorAction.setText("查看我的订单");
        } else {
            errorMessage.setText("体育中心暂时无法连接\n请检查网络后重试");
            errorAction.setText("重新连接");
        }
        progress.setVisibility(View.GONE); loading.setVisibility(View.GONE);
        if (web != null) web.setVisibility(View.INVISIBLE);
        error.setVisibility(View.VISIBLE);
    }
    private void applyTheme() {
        theme = AppTheme.read(this); theme.window(this); applySportsSystemBars(); theme.apply(root);
        if (tabs != null) tabs.setBackgroundColor(theme.paper);
        if (web != null) {
            web.setBackgroundColor(theme.paper); web.getSettings().setTextZoom(systemTextZoom());
            SportsWebLoadState state = pageState(web);
            if (state.isContentReady()) skin(web, web.getUrl(), null);
            updateTabs(web.getUrl());
        }
    }
    @Override public void onConfigurationChanged(android.content.res.Configuration c) { super.onConfigurationChanged(c); applyTheme(); }
    @Override protected void onResume() {
        super.onResume(); foreground = true;
        if (!Activation.valid(this)) { startActivity(new Intent(this, ActivationActivity.class)); finish(); return; }
        if (web != null) { web.onResume(); web.resumeTimers(); applyTheme(); }
        // Do not submit, reload or report success on return from a payment app; official polling owns the result.
        // While visible the official page polls itself; the background keep-alive only runs after leaving.
        SportsKeepAlive.sportsOpened(this); SportsKeepAlive.cancel(this);
        root.removeCallbacks(loginWatch); if (!SportsKeepAlive.decided(this)) root.postDelayed(loginWatch, 3000);
        if (SportsKeepAlive.consumeExpired(this)) showSessionExpired();
        else if (SportsKeepAlive.wasSignedIn(this)) SportsKeepAlive.check(this, signedIn -> {
            if (foreground && !isFinishing() && Boolean.FALSE.equals(signedIn) && SportsKeepAlive.consumeExpired(this)) showSessionExpired();
        });
    }
    private void showKeepAliveChoice() {
        float density = getResources().getDisplayMetrics().density; AppTheme palette = AppTheme.read(this);
        LinearLayout card = AppDialog.card(this);
        TextView heading = new TextView(this); heading.setText("保持体育中心登录？"); heading.setTextSize(20); heading.setTypeface(null, android.graphics.Typeface.BOLD);
        heading.setTextColor(palette.ink); heading.setPadding(0, 0, 0, Math.round(10 * density)); card.addView(heading);
        TextView body = new TextView(this); body.setTextSize(15); body.setTextColor(palette.ink); body.setLineSpacing(4 * density, 1);
        body.setText("体育中心闲置约 30 分钟就会自动退出，重新登录需要图片验证码和一次性验证码。\n\n开启后，离开体育馆时 App 会约每 10 分钟向体育中心确认一次登录状态，让登录不因闲置过期。不保存密码或验证码；手机深度休眠时仍可能退出。");
        card.addView(body);
        TextView label = new TextView(this); label.setText("连续多少天未打开体育馆后自动停止"); label.setTextSize(13); label.setTextColor(palette.muted);
        label.setPadding(0, Math.round(18 * density), 0, Math.round(8 * density)); card.addView(label);
        LinearLayout row = new LinearLayout(this); final int[] chosen = {3}; final Button[] options = new Button[3];
        for (int i = 0; i < 3; i++) {
            final int days = new int[]{3, 5, 7}[i]; Button option = AppDialog.button(this, days + " 天", days == 3 ? "soft" : "plain");
            option.setContentDescription(days + " 天未打开体育馆后自动停止"); options[i] = option;
            LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(0, Math.round(48 * density), 1); layout.setMargins(i == 0 ? 0 : Math.round(4 * density), 0, i == 2 ? 0 : Math.round(4 * density), 0);
            row.addView(option, layout);
            option.setOnClickListener(v -> { chosen[0] = days; for (Button b : options) { AppTheme.role(b, b == option ? "soft" : "plain"); palette.apply(b); b.setSelected(b == option); } });
        }
        options[0].setSelected(true); card.addView(row);
        Button enable = AppDialog.button(this, "开启保持登录", "primary");
        LinearLayout.LayoutParams enableLayout = new LinearLayout.LayoutParams(-1, Math.round(50 * density)); enableLayout.topMargin = Math.round(22 * density);
        card.addView(enable, enableLayout);
        Button skip = AppDialog.button(this, "暂不开启", "plain"); card.addView(skip, new LinearLayout.LayoutParams(-1, Math.round(48 * density)));
        TextView note = new TextView(this); note.setText("可随时在“设置 › 体育馆保持登录”中更改。"); note.setTextSize(12); note.setTextColor(palette.muted);
        note.setGravity(android.view.Gravity.CENTER); note.setPadding(0, Math.round(6 * density), 0, 0); card.addView(note);
        android.app.AlertDialog dialog = AppDialog.present(this, card, false);
        enable.setOnClickListener(v -> { dialog.dismiss(); keepAlivePrompting = false; SportsKeepAlive.setPreference(this, true, chosen[0]);
            AppNotice.show(this, "已开启，连续 " + chosen[0] + " 天未打开体育馆后自动停止"); });
        skip.setOnClickListener(v -> { dialog.dismiss(); keepAlivePrompting = false; SportsKeepAlive.setPreference(this, false, chosen[0]); });
    }
    private void showSessionExpired() {
        if (paying()) return;
        // "我的订单" requires a session, so the official page opens its own login dialog there.
        AppDialog.show(this, "体育中心登录已过期", "较长时间未使用后，体育中心会结束登录。重新登录需要账号、图片验证码和一次性验证码。",
                "去登录", () -> navigate(1), "稍后", null);
    }
    @Override protected void onPause() {
        foreground = false; root.removeCallbacks(loginWatch); if (web != null) web.onPause(); CookieManager.getInstance().flush();
        // One immediate state check doubles as the first keep-alive; alarms continue only for a signed-in session.
        SportsKeepAlive.check(this, signedIn -> { if (!Boolean.FALSE.equals(signedIn)) SportsKeepAlive.schedule(this); });
        super.onPause();
    }
    @Override protected void onSaveInstanceState(Bundle state) { if (web != null) web.saveState(state); super.onSaveInstanceState(state); }
    @Override public void onBackPressed() {
        if (web == null) { finish(); return; }
        leavePayment(() -> { if (web.canGoBack()) web.goBack(); else if (!previousWindows.isEmpty()) restoreWindow(); else finish(); });
    }
    @Override protected void onDestroy() {
        for (WebView previous : previousWindows) { previous.stopLoading(); previous.destroy(); } previousWindows.clear();
        if (web != null) { web.stopLoading(); content.removeView(web); web.destroy(); web = null; } super.onDestroy();
    }
}
