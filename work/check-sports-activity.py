"""Static guards for WebView transaction, retry, text-scale, and window lifecycle policy."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
activity = (root/'outputs/ams-android/app/src/main/java/cn/local/ams/SportsReservationActivity.java').read_text(encoding='utf-8')
nav = (root/'outputs/ams-android/app/src/main/java/cn/local/ams/SportsNavigation.java').read_text(encoding='utf-8')
load_state = (root/'outputs/ams-android/app/src/main/java/cn/local/ams/SportsWebLoadState.java').read_text(encoding='utf-8')
css = (root/'work/sports-theme.css').read_text(encoding='utf-8')

def section(start, end):
    a = activity.index(start)
    b = activity.index(end, a + len(start))
    return activity[a:b]

configure = section('private void configure(WebView page)', 'private boolean route(')
popup = section('@Override public boolean onCreateWindow(', '@Override public void onCloseWindow(')
close = section('@Override public void onCloseWindow(', 'private boolean route(')
restore = section('private void restoreWindow()', 'private void skin(')
resume = section('@Override protected void onResume()', '@Override protected void onPause()')
pause = section('@Override protected void onPause()', '@Override protected void onSaveInstanceState(')
back = section('@Override public void onBackPressed()', '@Override protected void onDestroy()')
destroy = activity[activity.index('@Override protected void onDestroy()'):]
retry = section('errorAction.setOnClickListener(', 'error.setVisibility(View.GONE); content.addView(error')
load_section = section('private void loadSection(int index)', 'private boolean paying()')
failure = section('private void failure(WebView source, String url, boolean uncertainWrite)', 'private void applyTheme()')
visual_prepare = section('private void prepareCommittedPage(', 'private boolean paying()')
system_bars = section('private void applySportsSystemBars()', 'private int dp(')
ssl_callback = section('@Override public void onReceivedSslError(', '@Override public boolean onCreateWindow(')
http_callback = section('@Override public void onReceivedHttpError(', '@Override public void onReceivedSslError(')
page_finished = section('@Override public void onPageFinished(', '@Override public void onPageCommitVisible(')

assert 'getConfiguration().fontScale * 100f' in activity
assert 's.setTextZoom(systemTextZoom())' in configure and 'getSettings().setTextZoom(systemTextZoom())' in activity
assert 'request.isForMainFrame()' in configure and 'request.getMethod()' in configure
assert 'shouldInterceptRequest' in configure and 'shouldOverrideUrlLoading' in configure
assert 'shouldOverrideUrlLoading for POST' in configure and 'not a universal redirect' in configure
assert 'request.getRequestHeaders()' not in configure and 'postUrl(' not in configure
assert 'WebView popup = new WebView' in popup and 'configure(popup)' in popup
assert 'previousWindows.add(web)' in popup and 'web.onPause()' in popup
assert 'setWebView(popup)' in popup and 'sendToTarget()' in popup
assert 'loadUrl(' not in popup and 'postUrl(' not in popup
assert 'restoreWindow()' in close and 'v.destroy()' in close
assert 'closed.stopLoading()' in restore and 'closed.destroy()' in restore and 'web.onResume()' in restore
assert 'web.onResume()' in resume and 'web.resumeTimers()' in resume
assert 'loadUrl(' not in resume and 'reload()' not in resume and 'postUrl(' not in resume
assert 'web.onPause()' in pause and 'CookieManager.getInstance().flush()' in pause
assert 'leavePayment(' in back and 'web.goBack()' in back and 'restoreWindow()' in back
assert 'previous.stopLoading(); previous.destroy()' in destroy and 'web.destroy()' in destroy
assert 'handler.cancel()' in ssl_callback and ssl_callback.index('handler.cancel()') < ssl_callback.index('shouldFailForSsl(e.getUrl(), v.getUrl())')
assert 'shouldFailForSsl(e.getUrl(), v.getUrl())' in ssl_callback and 'failure(v, e.getUrl(), v.getUrl(), false)' in ssl_callback
assert 'SportsWebLoadState.isMainHttpError(r.isForMainFrame(), response.getStatusCode())' in http_callback
assert 'failure(v, r.getUrl().toString(), v.getUrl()' in http_callback
assert 'showLoading(web, url, "正在加载体育中心…")' in load_section and load_section.index('showLoading(') < load_section.index('web.loadUrl(')
assert 'showLoading(web, retryUrl, "正在重新连接体育中心…")' in retry
assert 'state.failMainDocument(url, currentPageUrl)' in failure and 'loading.setVisibility(View.GONE)' in failure
assert 'web.setVisibility(View.INVISIBLE)' in failure and 'error.setVisibility(View.VISIBLE)' in failure
assert 'SportsNavigation.safeRetryUrl(url)' in activity
assert 'web.loadUrl(retryUrl)' in retry and 'web.loadUrl(url)' not in retry and 'web.postUrl(' not in retry
assert 'paymentFailure || writeFailure' in retry and 'navigate(1)' in retry
assert '避免重复付款' in activity and '不要重复提交' in activity
assert '正在加载体育中心' in activity and '正在连接支付页面' in activity and '正在打开支付页面' in activity
assert 'web.setVisibility(View.INVISIBLE)' in activity and 'page.setVisibility(View.VISIBLE)' in activity
assert 'onPageCommitVisible' in activity and 'prepareCommittedPage(v, url, state)' in activity
assert 'markVisualReady(generation, url)' in visual_prepare and 'postVisualStateCallback(generation' in visual_prepare
assert 'isReadyForVisualPreparation(url)' in visual_prepare
assert 'skin(page, url, waitForVisualState)' in visual_prepare
assert 'state.isContentReady()' in activity
assert 'state.markFinished(url)' in page_finished and 'state.markCommitted(url)' not in page_finished
assert 'showLoadedPage(v, url, state)' not in page_finished and 'prepareCommittedPage(v, url, state)' in page_finished
assert 'state.markCommitted(url)' in section('@Override public void onPageCommitVisible(', '@Override public void onReceivedError(')
assert 'shouldFailForSsl(String errorUrl, String currentPageUrl)' in load_state and '!failed && !committed' in load_state
assert 'sameDocument(errorUrl, currentPageUrl)' in load_state and 'failMainDocument(String requestUrl, String currentPageUrl)' in load_state
assert 'isMainHttpError(boolean isForMainFrame, int statusCode)' in load_state and 'return isForMainFrame && statusCode >= 400;' in load_state
assert 'beginNavigation(String url)' in load_state and 'markVisualReady(long expectedGeneration, String url)' in load_state
assert 'mainLoadFailed' not in activity
assert 'addJavascriptInterface(' not in activity
assert not re.search(r'Log\.[dv iwe]\s*\(.*(?:url|tradeId|prepay|token|cookie)', activity, re.I)
assert 'u.getRawUserInfo() == null' in nav and 'u.getPort() == -1 || u.getPort() == 443' in nav
print('PASS static Activity source guards: main-frame request boundaries, main-document SSL classification, TLS cancel, visual-state reveal barrier, safe retry/no POST replay, system font scale, popup WebViewTransport and close/restore/destroy lifecycle, no JS bridge or URL/payment logging.')
assert 'applySportsSystemBars();' in activity and 'window.setDecorFitsSystemWindows(false)' in system_bars
assert 'SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION' in system_bars and not re.search(r'\bSYSTEM_UI_FLAG_HIDE_NAVIGATION\b', system_bars)
assert 'window.setStatusBarColor(android.graphics.Color.TRANSPARENT)' in system_bars
assert 'window.setNavigationBarColor(android.graphics.Color.TRANSPARENT)' in system_bars
assert 'setNavigationBarContrastEnforced(false)' in system_bars and 'setStatusBarContrastEnforced(false)' in system_bars
assert 'setNavigationBarDividerColor(android.graphics.Color.TRANSPARENT)' in system_bars
insets = section('root.setOnApplyWindowInsetsListener(', 'LinearLayout header =')
assert 'WindowInsets.Builder(insets).setInsets(' in insets and 'android.graphics.Insets.NONE' in insets
assert 'consumeSystemWindowInsets()' in insets and 'getStableInsetBottom()' in insets
assert 'consumeStableInsets()' in insets and 'setInsetsIgnoringVisibility(' in insets
inset_layout = section('private void applySportsInsets(', 'private void applySportsSystemBars()')
assert 'Math.max(0, keyboardBottom - navigationBottom)' in inset_layout
assert 'tabs.setPadding(dp(12), dp(8), dp(12), dp(8) + navigationBottom)' in inset_layout
assert 'b.setStateListAnimator(null); b.setElevation(0);' in activity
assert 'window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(theme.paper))' in system_bars
assert 'tabs.setBackgroundColor(theme.paper)' in activity
assert '.header .service-top-inner.one-line' in css and '.header .service-top .service-top-box' in css
assert '.main-body.list-page{padding-top:calc(var(--ams-order-header-offset,0px) + 16px)!important}' in css
assert '.ams-project-toggle:disabled' in css
assert '.header .head-right,.header .menus-fixed,.header .logo-en,.header .nav{display:none!important}' in css
assert '.header,.court .header{position:relative!important' in css
assert '.ticket-page .page-title:before' in css and '.login .login-name:after{display:none!important;content:none!important}' in css
assert '.header-inner .logo .logo-zh .venues .item.checked' in css and '.header .venues .item:hover' in css
print('PASS sports chrome source guards: natural-flow compact campus header, hidden branding/menu, tabs draw the navigation-area background, consumed WebView safe area, and keyboard remainder only.')
print('LIMIT: Android callback integration, actual POST popup continuity, WebView return, keyboard/insets, external app launch and TLS failures still require Android device or authorized test environment.')
