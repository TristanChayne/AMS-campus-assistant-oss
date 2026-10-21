package cn.local.ams;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.widget.*;
import java.io.*;

public class ReservationActivity extends Activity {
    private WebView web;
    private AppTheme theme;
    private String themeCss="";
    private LinearLayout root;
    private TextView loading;
    private LinearLayout loadingPanel, loadingActions;
    private boolean assetMissing;
    // Readiness depends on the school page; never leave the user behind an endless spinner.
    private final Runnable loadingTimeout=()->{if(loadingPanel!=null&&loadingPanel.getVisibility()==android.view.View.VISIBLE)showLoadProblem("预约页面加载时间较长。可以重试，或返回后稍后再试。");};
    private String seatScript = "";
    private String roomScript = "";
    private String recordsScript = "";
    private boolean recordsMode;
    private TextView seatRecordsTab,roomRecordsTab;
    private String destination;
    private boolean recordsRequested;
    private boolean homeRequested;
    private FrameLayout content;
    private String resetScript="";
    private final java.util.HashMap<String,WebView> recordPages=new java.util.HashMap<>();
    private boolean loadFailed;
    private final java.util.HashSet<WebView> failedPages=new java.util.HashSet<>();
    private int paper, ink, muted, surface, accent;
    private final java.util.ArrayList<WebView> popups = new java.util.ArrayList<>();
    private final android.os.Handler uiHandler=new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable ensureSeatUi=new Runnable(){public void run(){
        if(web==null||isFinishing()||isDestroyed())return;
        String url=web.getUrl();
        if(url!=null&&("seatbookings.xjtlu.edu.cn".equals(Uri.parse(url).getHost())||"roombookings.xjtlu.edu.cn".equals(Uri.parse(url).getHost())))installSeatUi(url);
        uiHandler.postDelayed(this,1500);
    }};
    private void installSeatUi(String pageUrl) {
        if(web==null||pageUrl==null)return;
        boolean room="roombookings.xjtlu.edu.cn".equals(Uri.parse(pageUrl).getHost());
        String target=recordsRequested?"/ic/userinfo":homeRequested?"/ic/home":"";
        String routeRestore=target.isEmpty()?"":"(function(){var app=document.querySelector('#app');var vm=app&&app.__vue__;if(vm&&vm.$router&&vm.$store&&vm.$store.state.isLogin&&vm.$router.currentRoute.path!=='"+target+"')vm.$router.replace('"+target+"');})();";
        applyWebTheme(web);
        web.evaluateJavascript(routeRestore+(room?roomScript:seatScript)+recordsScript, ignored -> {
            if(web==null||!pageUrl.equals(web.getUrl()))return;
            web.evaluateJavascript((target.isEmpty()?"":"location.hash==='#"+target+"'&&")+(recordsMode?"document.body.classList.contains('campus-records-managed')&&document.getElementById('campus-records-panel')&&":"")+"Boolean((document.body.classList.contains('campus-seat-managed')&&(document.getElementById('campus-seat-panel')||document.getElementById('campus-seat-home')||location.hash.startsWith('#/ic/userinfo')))||(document.body.classList.contains('campus-room-managed')&&(document.getElementById('campus-room-panel')||document.getElementById('campus-room-welcome')||location.hash.startsWith('#/ic/userinfo'))))",ready -> {
                if(web!=null&&pageUrl.equals(web.getUrl())&&"true".equals(ready)){recordsRequested=false;homeRequested=false;web.setAlpha(1f);hideLoading();uiHandler.postDelayed(this::matchNavigationBar,350);}
            });
        });
    }
    private boolean allowed(Uri uri) {
        String host = uri.getHost();
        return "https".equalsIgnoreCase(uri.getScheme()) && host != null
                && (host.equalsIgnoreCase("xjtlu.edu.cn") || host.toLowerCase(java.util.Locale.ROOT).endsWith(".xjtlu.edu.cn"));
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (!Activation.valid(this)) { finish(); return; }
        try (InputStream in = getAssets().open("library-seat-ui.js")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
            seatScript = out.toString("UTF-8");
        } catch (IOException e) { assetMissing=true; }
        try (InputStream in = getAssets().open("library-room-ui.js")) {ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int count;while((count=in.read(buffer))!=-1)out.write(buffer,0,count);roomScript=out.toString("UTF-8");}catch(IOException e){assetMissing=true;}
        try (InputStream in=getAssets().open("reservation-records-ui.js")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int count;while((count=in.read(buffer))!=-1)out.write(buffer,0,count);recordsScript=out.toString("UTF-8");}catch(IOException e){assetMissing=true;}
        try(InputStream in=getAssets().open("reservation-reset-ui.js")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] bytes=new byte[4096];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);resetScript=out.toString("UTF-8");}catch(IOException e){assetMissing=true;}
        theme=AppTheme.read(this);updatePalette();
        try(InputStream in=getAssets().open("reservation-theme.css")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] bytes=new byte[4096];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);themeCss=out.toString("UTF-8");}catch(IOException e){assetMissing=true;}
        if(assetMissing)getWindow().getDecorView().post(()->AppNotice.show(this,"部分界面组件未能加载，请重新安装 App"));
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);AppTheme.role(root,"paper"); root.setFitsSystemWindows(true);
        root.addOnLayoutChangeListener((v,l,t,r,b2,ol,ot,or,ob)->{if(b2-t!=ob-ot)root.post(this::paintBottomInset);});
        root.setBackgroundColor(paper); getWindow().setStatusBarColor(paper);getWindow().setNavigationBarColor(paper);
        theme.window(this);
        setContentView(root);
        String service=getIntent().getStringExtra("service");
        recordsMode="records".equals(service)||"seatRecords".equals(service)||"roomRecords".equals(service);recordsRequested=recordsMode;
        if("seat".equals(service))open("https://seatbookings.xjtlu.edu.cn/");
        else if("records".equals(service)||"seatRecords".equals(service))open("https://seatbookings.xjtlu.edu.cn/#/ic/userinfo");
        else if("roomRecords".equals(service))open("https://roombookings.xjtlu.edu.cn/#/ic/userinfo");
        else if("room".equals(service))open("https://roombookings.xjtlu.edu.cn/");
        else if("fb".equals(service))open("https://gsrb.xjtlu.edu.cn/");
        else if("bus".equals(service))open("https://shuttlebus.xjtlu.edu.cn/");
        else finish();
    }
    private void updatePalette(){paper=theme.paper;surface=theme.surface;ink=theme.ink;muted=theme.muted;accent=theme.accent;}
    private void applyWebTheme(WebView page){
        if(page==null)return;
        page.setBackgroundColor(theme.paper);
        page.evaluateJavascript(theme.webScript()+"(function(){if(document.getElementById('campus-shared-theme'))return;var style=document.createElement('style');style.id='campus-shared-theme';style.textContent="+org.json.JSONObject.quote(themeCss)+";document.head.appendChild(style);})();",null);
    }
    private void updateTheme(){
        theme=AppTheme.read(this);updatePalette();theme.window(this);theme.apply(root);
        if(recordsMode){for(WebView page:recordPages.values())applyWebTheme(page);if(destination!=null)updateRecordsTabs(destination);}else applyWebTheme(web);
        if(loadingPanel!=null&&loadingPanel.getVisibility()!=android.view.View.VISIBLE)uiHandler.postDelayed(this::matchNavigationBar,300);
    }
    @Override public void onConfigurationChanged(android.content.res.Configuration configuration){super.onConfigurationChanged(configuration);updateTheme();}
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    private android.graphics.drawable.Drawable background(int color,int radius) {
        android.graphics.drawable.GradientDrawable shape=new android.graphics.drawable.GradientDrawable();shape.setColor(color);shape.setCornerRadius(dp(radius));
        return new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x20254E9B),shape,null);
    }
    private TextView text(String value,int size,int color) {
        TextView t=new TextView(this);AppTheme.role(t,"ink");t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setTypeface(android.graphics.Typeface.create("sans-serif",android.graphics.Typeface.NORMAL));return t;
    }
    private TextView button(String text, Runnable action) {
        TextView b = text(text,15,accent);b.setGravity(android.view.Gravity.CENTER);b.setMinHeight(dp(48));b.setPadding(dp(16),dp(8),dp(16),dp(8));
        AppTheme.role(b,"soft");b.setBackground(background(surface,12));b.setOnClickListener(v -> action.run());return b;
    }
    private void open(String url) {
        destination = url; root.removeAllViews();
        LinearLayout tools = new LinearLayout(this);
        AppTheme.role(tools,"paper");tools.setGravity(android.view.Gravity.CENTER_VERTICAL);tools.setPadding(dp(16),dp(4),dp(16),dp(4));tools.setBackgroundColor(paper);
        String title="gsrb.xjtlu.edu.cn".equals(Uri.parse(url).getHost())?"FB 讨论室（SIP）":"seatbookings.xjtlu.edu.cn".equals(Uri.parse(url).getHost())?"图书馆座位":"roombookings.xjtlu.edu.cn".equals(Uri.parse(url).getHost())?"讨论室预约":"区间车预约";
        if(url.contains("#/ic/userinfo"))title="我的预约";
        TextView heading=text(title,18,ink);heading.setTypeface(android.graphics.Typeface.create("sans-serif-medium",android.graphics.Typeface.NORMAL));
        tools.addView(heading,new LinearLayout.LayoutParams(0,dp(48),1));heading.setGravity(android.view.Gravity.CENTER_VERTICAL);
        TextView exit=button("退出  ×",()->returnHome());exit.setContentDescription("退出预约，返回预约首页");exit.setBackground(background(surface,24));
        tools.addView(exit,new LinearLayout.LayoutParams(dp(84),dp(48)));root.addView(tools);
        if(recordsMode){LinearLayout tabs=new LinearLayout(this);tabs.setPadding(dp(16),dp(4),dp(16),dp(4));TextView seats=button("图书馆座位",()->loadRecords(false));TextView rooms=button("讨论室",()->loadRecords(true));seatRecordsTab=seats;roomRecordsTab=rooms;updateRecordsTabs(url);tabs.addView(seats,new LinearLayout.LayoutParams(0,dp(44),1));LinearLayout.LayoutParams roomParams=new LinearLayout.LayoutParams(0,dp(44),1);roomParams.leftMargin=dp(8);tabs.addView(rooms,roomParams);root.addView(tabs);}
        content=new FrameLayout(this);root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
        web = new WebView(this);web.setBackgroundColor(paper);content.addView(web,new FrameLayout.LayoutParams(-1,-1));
        loadingPanel=new LinearLayout(this);loadingPanel.setOrientation(LinearLayout.VERTICAL);loadingPanel.setGravity(android.view.Gravity.CENTER);AppTheme.role(loadingPanel,"loading");loadingPanel.setBackgroundColor(paper);loadingPanel.setPadding(dp(28),dp(28),dp(28),dp(28));
        loading=text("正在准备预约界面…",15,muted);AppTheme.role(loading,"muted");loading.setGravity(android.view.Gravity.CENTER);loading.setAccessibilityLiveRegion(android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE);loadingPanel.addView(loading);
        loadingActions=new LinearLayout(this);loadingActions.setGravity(android.view.Gravity.CENTER);loadingActions.setVisibility(android.view.View.GONE);
        TextView retry=button("重试",()->{web.setAlpha(0f);showLoading("正在重新加载…");web.loadUrl(destination);});TextView leave=button("返回",()->returnHome());
        LinearLayout.LayoutParams actionLayout=new LinearLayout.LayoutParams(dp(112),dp(48));actionLayout.setMargins(dp(6),dp(20),dp(6),0);loadingActions.addView(retry,actionLayout);loadingActions.addView(leave,new LinearLayout.LayoutParams(actionLayout));loadingPanel.addView(loadingActions);
        content.addView(loadingPanel,new FrameLayout.LayoutParams(-1,-1));
        boolean seat=("seatbookings.xjtlu.edu.cn".equals(Uri.parse(url).getHost())||"roombookings.xjtlu.edu.cn".equals(Uri.parse(url).getHost()));web.setAlpha(seat?0f:1f);if(seat)showLoading("正在准备预约界面…");else hideLoading();
        if(recordsMode)recordPages.put(Uri.parse(url).getHost(),web);
        configureWeb(url);
    }
    private void configureWeb(String url){
        WebSettings s = web.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        // School operatingSystem.js sends Android/Mobile UAs to mobile.html,
        // whose DOM differs from the verified seat-area/grid adapter.
        // Request the verified desktop app only for seats; our injected layout is mobile responsive.
        if ("seatbookings.xjtlu.edu.cn".equals(Uri.parse(url).getHost())||"roombookings.xjtlu.edu.cn".equals(Uri.parse(url).getHost())) {
            s.setUserAgentString("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        }
        s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(true);
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView view,boolean dialog,boolean userGesture,android.os.Message message) {
                // Resolve target=_blank/window.open into this isolated reservation WebView.
                WebView popup=new WebView(ReservationActivity.this);popups.add(popup);
                popup.setWebViewClient(new WebViewClient(){
                    private boolean consumed;
                    private void accept(WebView child,String url){
                        if(consumed||"about:blank".equals(url))return;
                        consumed=true;
                        if(web!=null&&allowed(Uri.parse(url)))web.loadUrl(url);
                        else AppDialog.show(ReservationActivity.this,"无法在应用内打开","这个链接不属于学校网站，已阻止在预约页内打开。","知道了",null,null,null);
                        child.stopLoading();popups.remove(child);child.destroy();
                    }
                    @Override public boolean shouldOverrideUrlLoading(WebView child,WebResourceRequest request){accept(child,request.getUrl().toString());return true;}
                    @Override public void onPageStarted(WebView child,String url,android.graphics.Bitmap icon){accept(child,url);}
                });
                ((WebView.WebViewTransport)message.obj).setWebView(popup);message.sendToTarget();return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view,String pageUrl,android.graphics.Bitmap icon) {
                failedPages.remove(view);if(view!=web)return;
                loadFailed=false;
                boolean seat=("seatbookings.xjtlu.edu.cn".equals(Uri.parse(pageUrl).getHost())||"roombookings.xjtlu.edu.cn".equals(Uri.parse(pageUrl).getHost()));
                view.setAlpha(seat?0f:1f);if(seat)showLoading("正在准备预约界面…");else hideLoading();
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                if (allowed(request.getUrl())) return false;
                AppDialog.show(ReservationActivity.this,"暂不支持此登录跳转","页面要跳转到 "+request.getUrl().getHost()+"，不属于学校网站，已阻止。","知道了",null,null,null);
                return true;
            }
            @Override public void onPageFinished(WebView view,String pageUrl) {
                if(view!=web)return;
                Uri uri = Uri.parse(pageUrl);
                if ("https".equals(uri.getScheme()) && ("seatbookings.xjtlu.edu.cn".equals(uri.getHost())||"roombookings.xjtlu.edu.cn".equals(uri.getHost()))) installSeatUi(pageUrl);
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame()){failedPages.add(view);if(view==web){loadFailed=true;showLoadProblem("预约页面未能加载，请检查网络后重试。");}}}
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,android.net.http.SslError error) {
                handler.cancel();failedPages.add(view);if(view==web){loadFailed=true;showLoadProblem("学校页面证书验证失败，请检查手机时间和网络后重试。");}
            }
        }); web.loadUrl(url);uiHandler.postDelayed(ensureSeatUi,1500);
    }
    /** The gesture-bar row takes the colour actually painted on the last row of the school page, not a different app surface. */
    private void matchNavigationBar(){
        if(web==null||web.getWidth()==0||web.getHeight()<4||web.getAlpha()<1f||(loadingPanel!=null&&loadingPanel.getVisibility()==android.view.View.VISIBLE))return;
        int[] at=new int[2];web.getLocationInWindow(at);
        int x=at[0]+web.getWidth()/2,y=at[1]+web.getHeight()-2;
        android.graphics.Bitmap pixel=android.graphics.Bitmap.createBitmap(1,1,android.graphics.Bitmap.Config.ARGB_8888);
        try{
            android.view.PixelCopy.request(getWindow(),new android.graphics.Rect(x,y,x+1,y+1),pixel,result->{
                if(result!=android.view.PixelCopy.SUCCESS||isFinishing()||isDestroyed())return;
                int color=pixel.getPixel(0,0);
                if(android.graphics.Color.alpha(color)==255){bottomBarColor=color;paintBottomInset();}
            },uiHandler);
        }catch(IllegalArgumentException ignored){}
    }
    private int bottomBarColor;
    /** Android 15 draws app content behind the transparent navigation bar: paint only the root's bottom inset. */
    private void paintBottomInset(){
        if(root==null||bottomBarColor==0)return;
        int bottom=root.getPaddingBottom();
        if(bottom<=0||root.getHeight()<=bottom){root.setBackgroundColor(paper);return;}
        android.graphics.drawable.LayerDrawable layers=new android.graphics.drawable.LayerDrawable(new android.graphics.drawable.Drawable[]{
            new android.graphics.drawable.ColorDrawable(paper),new android.graphics.drawable.ColorDrawable(bottomBarColor)});
        layers.setLayerInset(1,0,root.getHeight()-bottom,0,0);root.setBackground(layers);
    }
    private void showLoading(String message){if(loadingPanel==null)return;loading.setText(message);loadingActions.setVisibility(android.view.View.GONE);loadingPanel.setVisibility(android.view.View.VISIBLE);uiHandler.removeCallbacks(loadingTimeout);uiHandler.postDelayed(loadingTimeout,15000);}
    private void hideLoading(){if(loadingPanel==null)return;uiHandler.removeCallbacks(loadingTimeout);loadingPanel.setVisibility(android.view.View.GONE);}
    private void showLoadProblem(String message){if(loadingPanel==null)return;uiHandler.removeCallbacks(loadingTimeout);if(web!=null)web.setAlpha(0f);loading.setText(message);loadingActions.setVisibility(android.view.View.VISIBLE);loadingPanel.setVisibility(android.view.View.VISIBLE);}
    private void updateRecordsTabs(String url){boolean room="roombookings.xjtlu.edu.cn".equals(Uri.parse(url).getHost());if(seatRecordsTab!=null){seatRecordsTab.setBackground(background(room?surface:theme.primary,12));seatRecordsTab.setTextColor(room?accent:0xFFFFFFFF);roomRecordsTab.setBackground(background(room?theme.primary:surface,12));roomRecordsTab.setTextColor(room?0xFFFFFFFF:accent);}}
    private void loadRecords(boolean room){
        destination=room?"https://roombookings.xjtlu.edu.cn/#/ic/userinfo":"https://seatbookings.xjtlu.edu.cn/#/ic/userinfo";
        String host=Uri.parse(destination).getHost();WebView cached=recordPages.get(host);
        if(cached==web)return;
        recordsRequested=true;updateRecordsTabs(destination);
        if(web!=null){web.onPause();content.removeView(web);}
        web=cached;showLoading("正在读取预约记录…");
        if(web==null){web=new WebView(this);web.setBackgroundColor(paper);recordPages.put(host,web);content.addView(web,0,new FrameLayout.LayoutParams(-1,-1));web.setAlpha(0f);loadFailed=false;configureWeb(destination);}
        else{content.addView(web,0,new FrameLayout.LayoutParams(-1,-1));web.onResume();loadFailed=failedPages.contains(web);if(loadFailed)web.loadUrl(destination);else showCachedPage();}
    }
    private void showCachedPage(){
        String url=web.getUrl();if(url==null)return;
        String host=Uri.parse(url).getHost();
        if("seatbookings.xjtlu.edu.cn".equals(host)||"roombookings.xjtlu.edu.cn".equals(host))installSeatUi(url);
        else{web.setAlpha(1f);hideLoading();}
    }
    private void resetPage(WebView page,boolean records){
        if(page==null)return;
        page.evaluateJavascript(resetScript+";if(window.__campusResetReservation)window.__campusResetReservation("+records+");",null);
        page.scrollTo(0,0);
    }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else returnHome(); }
    private void returnHome(){
        if(this instanceof SeatReservationActivity||this instanceof RoomReservationActivity||this instanceof RecordsReservationActivity){
            if(recordsMode){
                for(WebView page:recordPages.values())resetPage(page,true);
                loadRecords(false);recordsRequested=true;
            }else{homeRequested=true;resetPage(web,false);}
            web.setAlpha(0f);showLoading("正在准备预约界面…");
            startActivity(new android.content.Intent(this,MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
        }else finish();
    }
    @Override protected void onPause(){uiHandler.removeCallbacks(ensureSeatUi);if(web!=null)web.onPause();CookieManager.getInstance().flush();super.onPause();}
    @Override protected void onResume(){super.onResume();if(!Activation.valid(this)){finish();return;}updateTheme();if(web!=null){web.onResume();if(loadFailed)web.loadUrl(destination);else showCachedPage();uiHandler.removeCallbacks(ensureSeatUi);uiHandler.post(ensureSeatUi);}}
    @Override protected void onDestroy() { uiHandler.removeCallbacksAndMessages(null);failedPages.clear();CookieManager.getInstance().flush();for(WebView popup:popups)popup.destroy();popups.clear();if(recordsMode){for(WebView page:recordPages.values())page.destroy();recordPages.clear();web=null;}else if (web != null) { web.destroy(); web = null; } super.onDestroy(); }
}
