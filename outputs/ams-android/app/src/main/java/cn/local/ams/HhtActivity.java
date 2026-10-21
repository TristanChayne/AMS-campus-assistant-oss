package cn.local.ams;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.webkit.*;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

/** Local trusted UI, native HTTPS requests, no school/AMS cookie or token sharing. */
public class HhtActivity extends Activity {
    private static final String ORIGIN="https://hht.local/";
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final ExecutorService network=Executors.newSingleThreadExecutor();
    private WebView web;
    private JSONObject session;
    private boolean active,busy;
    private int generation;
    private final Runnable rotate=()->fetch(false,null,null);
    private boolean passPage(){return web!=null&&(ORIGIN+"hht.html").equals(web.getUrl());}
    @Override public void onCreate(Bundle state){
        super.onCreate(state);if(!Activation.valid(this)){finish();return;}
        // Some Android compatibility containers blank secure windows on the device itself.
        AppTheme.read(this).window(this);session=HhtSession.read(this);
        web=new WebView(this);web.setFitsSystemWindows(false);web.setBackgroundColor(AppTheme.read(this).paper);setContentView(web);
        web.setOnApplyWindowInsetsListener((view,insets)->{
            if(android.os.Build.VERSION.SDK_INT>=30){
                android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars());
                android.graphics.Insets keyboard=insets.getInsets(android.view.WindowInsets.Type.ime());
                view.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,keyboard.bottom));
            }else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        web.requestApplyInsets();
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(false);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(),"HhtBridge");
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();String path=uri.getPath();
                if(!"https".equals(uri.getScheme())||!"hht.local".equals(uri.getHost())||path==null||path.contains(".."))return empty();
                String asset=path.substring(1);
                if(!Arrays.asList("hht.html","tutorial.html","assets/options.png","assets/https.png","assets/capture.png","assets/credentials.png","assets/mac_p1.png","assets/mac_p2.png","assets/mac_p3.png","assets/mac_p4.png","assets/mac_p5.png","assets/mac_p6.png","assets/mac_p7.png").contains(asset))return empty();
                try{return new WebResourceResponse(asset.endsWith(".png")?"image/png":"text/html",asset.endsWith(".png")?null:"UTF-8",openLocalResource(asset));}
                catch(IOException e){if(request.isForMainFrame())ui.post(()->showLoadError());return empty();}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                if(!request.isForMainFrame())return true;
                Uri uri=request.getUrl();String url=uri.toString();
                if("https".equals(uri.getScheme())&&"hht.local".equals(uri.getHost())){
                    String path=uri.getPath();
                    if("/hht.html".equals(path)||"/tutorial.html".equals(path)||path!=null&&path.matches("/assets/(options|https|capture|credentials|mac_p[1-7])\\.png"))return false;
                }
                if("https".equals(uri.getScheme())&&Arrays.asList("www.telerik.com","proxyman.com").contains(uri.getHost())){
                    try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){AppDialog.show(HhtActivity.this,"未找到浏览器","请安装或启用浏览器后再打开此链接。","知道了",null,null,null);}
                }
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,Bitmap favicon){cancel();}
            @Override public void onPageFinished(WebView view,String url){applyTheme();}
        });
        web.loadUrl(ORIGIN+"hht.html");
    }
    private InputStream openLocalResource(String asset) throws IOException {
        try{return getAssets().open("hht/"+asset);}catch(IOException assetError){
            String name;
            if("hht.html".equals(asset))name="hht_page";
            else if("tutorial.html".equals(asset))name="hht_tutorial";
            else name="hht_"+asset.substring(asset.lastIndexOf('/')+1,asset.lastIndexOf('.'));
            int id=getResources().getIdentifier(name,"raw",getPackageName());
            if(id==0)throw assetError;
            try{return getResources().openRawResource(id);}catch(android.content.res.Resources.NotFoundException e){throw new IOException("Local page resource unavailable",e);}
        }
    }
    private void showLoadError(){
        if(isFinishing())return;
        cancel();android.widget.LinearLayout panel=new android.widget.LinearLayout(this);panel.setOrientation(1);panel.setPadding(32,64,32,32);panel.setBackgroundColor(AppTheme.read(this).paper);
        android.widget.TextView message=new android.widget.TextView(this);message.setText("宿舍码页面加载失败，请返回后重试。若仍失败，请反馈应用版本和手机型号。");message.setTextSize(18);message.setTextColor(AppTheme.read(this).ink);panel.addView(message);
        android.widget.Button back=new android.widget.Button(this);back.setText("返回");back.setOnClickListener(v->finish());panel.addView(back);setContentView(panel);
    }
    private static WebResourceResponse empty(){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
    private void applyTheme(){
        AppTheme t=AppTheme.read(this);t.window(this);web.setBackgroundColor(t.paper);
        try{
            JSONObject data=new JSONObject().put("dark",t.dark).put("accent",AppTheme.hex(t.accent)).put("wash",AppTheme.hex(t.wash))
                .put("bg",AppTheme.hex(t.paper)).put("surface",AppTheme.hex(t.surface)).put("ink",AppTheme.hex(t.ink)).put("muted",AppTheme.hex(t.muted)).put("line",AppTheme.hex(t.line));
            web.evaluateJavascript("window.hhtTheme&&window.hhtTheme("+data+")",null);
        }catch(Exception ignored){}
    }
    private void cancel(){generation++;busy=false;ui.removeCallbacks(rotate);if(web!=null)web.evaluateJavascript("window.hhtHideCode&&window.hhtHideCode()",null);}
    @Override protected void onResume(){super.onResume();active=true;if(web!=null){applyTheme();if(passPage())publish();}}
    @Override protected void onPause(){active=false;cancel();super.onPause();}
    @Override public void onConfigurationChanged(Configuration c){super.onConfigurationChanged(c);applyTheme();}
    @Override public void onBackPressed(){if(!passPage()){web.loadUrl(ORIGIN+"hht.html");}else finish();}
    @Override protected void onDestroy(){cancel();network.shutdownNow();if(web!=null){web.removeJavascriptInterface("HhtBridge");web.destroy();web=null;}super.onDestroy();}
    private void event(JSONObject data){if(active&&passPage())web.evaluateJavascript("window.hhtResult&&window.hhtResult("+data+")",null);}
    private void publish(){
        if(!active||!passPage())return;
        try{event(new JSONObject().put("kind","session").put("bound",!session.optString("token").isEmpty()));}catch(Exception ignored){}
        if(!session.optString("token").isEmpty())fetch(false,null,null);
    }
    private final class Bridge {
        @JavascriptInterface public void ready(){ui.post(()->{if(active&&passPage()){applyTheme();publish();}});}
        @JavascriptInterface public void close(){ui.post(()->finish());}
        @JavascriptInterface public void bind(String mode,String credential){ui.post(()->{if(active&&passPage()){
            if(!("openid".equals(mode)||"token".equals(mode))||credential==null)return;
            String value=credential.trim();if(value.isEmpty()||value.length()>4096||value.matches("(?s).*\\s.*")){
                fail("请粘贴完整凭证，不要带空格、参数名或换行。",false);return;
            }
            fetch(true,mode,value);
        }});}
        @JavascriptInterface public void refresh(){ui.post(()->{if(active&&passPage())fetch(false,null,null);});}
        @JavascriptInterface public void edit(){ui.post(()->{if(active&&passPage())cancel();});}
        @JavascriptInterface public void unbind(){ui.post(()->{if(active&&passPage())AppDialog.show(HhtActivity.this,null,
            "清除本机慧湖通绑定？这不会解除学校系统中的账号绑定。","清除",()->{
                cancel();if(HhtSession.clear(HhtActivity.this)){session=new JSONObject();publish();}else fail("本机清除失败，请重试。",false);
            },"取消",null);});}
    }
    private void fail(String message,boolean expired){try{event(new JSONObject().put("kind","error").put("message",message).put("expired",expired));}catch(Exception ignored){}}
    private void fetch(boolean binding,String mode,String value){
        if(!active||!passPage()||busy)return;
        if(!binding&&session.optString("token").isEmpty())return;
        busy=true;ui.removeCallbacks(rotate);final int revision=++generation;
        final JSONObject saved;
        try{saved=new JSONObject(session.toString());event(new JSONObject().put("kind","loading").put("binding",binding));}catch(Exception e){busy=false;return;}
        network.execute(()->{
            try{
                JSONObject next=binding?new JSONObject().put("mode",mode).put("openid","openid".equals(mode)?value:"").put("token","token".equals(mode)?value:""):saved;
                String openid=next.optString("openid"),token=next.optString("token");
                if(token.isEmpty())token=login(openid);
                JSONObject code;
                try{code=request("/pms/welcome/make-code-info",token);}catch(AuthFailure|ServiceFailure e){
                    if(openid.isEmpty())throw e;
                    token=login(openid);code=request("/pms/welcome/make-code-info",token);
                }
                if(code.optInt("locked",0)!=0||code.optInt("status",1)!=1)throw new ServiceFailure("慧湖通当前身份或通行状态不可用，请在官方小程序确认。");
                String raw=code.optString("qrCode","");if(raw.isEmpty()||raw.equals("null")||raw.length()>2048)throw new ServiceFailure("取码服务未返回可用二维码，请稍后重试。");
                String png=qr(raw);next.put("token",token);
                JSONObject result=new JSONObject().put("kind","code").put("image",png).put("name",code.optString("name","")).put("updated",System.currentTimeMillis());
                ui.post(()->{
                    if(!active||revision!=generation||!passPage())return;
                    busy=false;
                    try{if(binding||!next.optString("token").equals(saved.optString("token")))HhtSession.save(HhtActivity.this,next);session=next;event(result);ui.postDelayed(rotate,8000);}
                    catch(Exception e){fail("无法加密保存绑定信息，请重试。",false);}
                });
            }catch(Exception e){
                final boolean expired=e instanceof AuthFailure;
                final String message=expired?"登录凭证已失效，请重新获取后绑定。":e instanceof ServiceFailure?e.getMessage():"暂时无法获取二维码，请检查网络后重试。";
                ui.post(()->{if(active&&revision==generation&&passPage()){busy=false;fail(message,expired);}});
            }
        });
    }
    private String login(String openid)throws Exception {
        JSONObject data=request("/web-app/auth/certificateLogin?openId="+URLEncoder.encode(openid,"UTF-8"),"");
        String token=data.optString("token","");if(token.isEmpty()||token.equals("null"))throw new AuthFailure();return token;
    }
    private JSONObject request(String path,String token)throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL("https://api.215123.cn"+path).openConnection();
        c.setInstanceFollowRedirects(false);c.setConnectTimeout(12000);c.setReadTimeout(12000);c.setRequestProperty("Accept","application/json");
        if(!token.isEmpty())c.setRequestProperty("satoken",token);
        try{
            int status=c.getResponseCode();if(status==401||status==403)throw new AuthFailure();if(status!=200)throw new IOException("Service unavailable");
            ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){
                byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>262144)throw new IOException("Response too large");out.write(buffer,0,n);}
            }
            JSONObject response=new JSONObject(out.toString("UTF-8"));int code=response.optInt("code",0);
            if(code==401||code==403)throw new AuthFailure();
            if(code!=200)throw new ServiceFailure("慧湖通暂未返回成功结果，请在官方小程序确认登录后重试。");
            JSONObject data=response.optJSONObject("data");if(data==null)throw new IOException("Invalid service response");return data;
        }finally{c.disconnect();}
    }
    private static String qr(String raw)throws Exception {
        Map<EncodeHintType,Object> hints=new EnumMap<>(EncodeHintType.class);hints.put(EncodeHintType.CHARACTER_SET,"UTF-8");hints.put(EncodeHintType.MARGIN,4);
        BitMatrix matrix=new QRCodeWriter().encode(raw,BarcodeFormat.QR_CODE,720,720,hints);
        int[] pixels=new int[720*720];for(int y=0;y<720;y++)for(int x=0;x<720;x++)pixels[y*720+x]=matrix.get(x,y)?0xFF000000:0xFFFFFFFF;
        Bitmap bitmap=Bitmap.createBitmap(pixels,720,720,Bitmap.Config.ARGB_8888);ByteArrayOutputStream out=new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG,100,out);bitmap.recycle();return android.util.Base64.encodeToString(out.toByteArray(),android.util.Base64.NO_WRAP);
    }
    private static class AuthFailure extends IOException {}
    private static class ServiceFailure extends IOException {ServiceFailure(String message){super(message);}}
}
