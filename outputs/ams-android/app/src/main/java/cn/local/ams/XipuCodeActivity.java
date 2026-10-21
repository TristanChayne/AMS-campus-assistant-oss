package cn.local.ams;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.view.View;
import android.widget.*;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.common.BitMatrix;

/** Test integration of the official login and rotating code. The session token is encrypted on this device. */
public class XipuCodeActivity extends Activity {
    private AppTheme theme;
    private static final String BASE="https://portalapp.xjtlu.edu.cn/edu-app/";
    private final ExecutorService network=Executors.newSingleThreadExecutor();
    private final Handler ui=new Handler(Looper.getMainLooper());
    private LinearLayout body,loginPanel,codePanel;
    private EditText account,loginCode,captchaText;
    private Spinner method;
    private ImageView captcha,qr;
    private TextView feedback,countdown,loginFeedback,loginCodeLabel;
    private ProgressBar codeLife;
    private Button login,send,refreshCaptcha,refreshCode;
    private String token="",captchaKey="",deviceId="",selectedLoginType="";
    private boolean busy,active;
    private long expiry,sendAfter;
    private int cycle=60;
    private final ArrayList<String> types=new ArrayList<>();
    private final Runnable tick=new Runnable(){public void run(){
        if(!active||isFinishing()||isDestroyed())return;
        long remaining=Math.max(0,(expiry-System.currentTimeMillis()+999)/1000);
        codeLife.setProgress((int)Math.min(100,remaining*100/Math.max(1,cycle)));
        countdown.setText(remaining>0?remaining+" 秒后自动更新":"正在更新西浦码…");
        if(remaining==0&&!busy&&!token.isEmpty())fetchCode();
        ui.postDelayed(this,1000);
    }};
    private final Runnable sendTick=new Runnable(){public void run(){
        if(isFinishing()||isDestroyed())return;
        long remaining=Math.max(0,(sendAfter-System.currentTimeMillis()+999)/1000);
        send.setText(remaining>0?remaining+" 秒":"发送验证码");send.setEnabled(!busy&&remaining==0);
        if(remaining>0)ui.postDelayed(this,1000);
    }};
    private void status(String message){
        feedback.setText(message);if(loginFeedback!=null)loginFeedback.setText(message);
        feedback.setVisibility(loginPanel!=null&&loginPanel.getVisibility()==View.VISIBLE?View.GONE:View.VISIBLE);
    }
    private android.graphics.drawable.Drawable inputShape(){android.graphics.drawable.GradientDrawable d=new android.graphics.drawable.GradientDrawable();d.setColor(theme.input);d.setCornerRadius(dp(10));d.setStroke(dp(1),theme.line);return d;}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private TextView text(String value,int size){TextView t=new TextView(this);AppTheme.role(t,"ink");t.setText(value);t.setTextSize(size);t.setTextColor(theme.ink);t.setTypeface(android.graphics.Typeface.create("sans-serif",android.graphics.Typeface.NORMAL));t.setPadding(0,dp(6),0,dp(6));return t;}
    private android.graphics.drawable.Drawable shape(int color){android.graphics.drawable.GradientDrawable d=new android.graphics.drawable.GradientDrawable();d.setColor(color);d.setCornerRadius(dp(14));return d;}
    private Button button(String label){Button b=new Button(this);AppTheme.role(b,"soft");b.setText(label);b.setAllCaps(false);b.setTextSize(15);b.setTypeface(android.graphics.Typeface.create("sans-serif-medium",android.graphics.Typeface.NORMAL));b.setStateListAnimator(null);b.setTextColor(theme.ink);b.setMinHeight(dp(46));b.setBackground(shape(theme.wash));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(48));p.topMargin=dp(10);b.setLayoutParams(p);return b;}
    private EditText field(String label){TextView caption=text(label,13);caption.setPadding(0,dp(14),0,dp(6));body.addView(caption);EditText e=new EditText(this);AppTheme.role(e,"input");e.setSingleLine(true);e.setTextColor(theme.ink);e.setTextSize(16);e.setPadding(dp(12),dp(10),dp(12),dp(10));e.setHintTextColor(theme.muted);e.setBackground(inputShape());body.addView(e,new LinearLayout.LayoutParams(-1,dp(48)));return e;}
    @Override public void onCreate(Bundle state){
        super.onCreate(state);if(!Activation.valid(this)){finish();return;}theme=AppTheme.read(this);
        getWindow().setStatusBarColor(theme.paper);getWindow().setNavigationBarColor(theme.paper);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        LinearLayout root=new LinearLayout(this);root.setOrientation(1);AppTheme.role(root,"paper");root.setFitsSystemWindows(true);root.setBackgroundColor(theme.paper);setContentView(root);
        LinearLayout header=new LinearLayout(this);header.setGravity(android.view.Gravity.CENTER_VERTICAL);header.setPadding(dp(16),dp(4),dp(16),dp(4));TextView title=text("我的西浦码",20);title.setTypeface(android.graphics.Typeface.create("sans-serif-medium",android.graphics.Typeface.NORMAL));header.addView(title,new LinearLayout.LayoutParams(0,dp(52),1));Button exit=button("关闭 ×");exit.setOnClickListener(v->finish());header.addView(exit,new LinearLayout.LayoutParams(dp(86),dp(44)));root.addView(header);
        ScrollView scroll=new ScrollView(this);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));body=new LinearLayout(this);body.setOrientation(1);body.setPadding(dp(20),dp(10),dp(20),dp(24));scroll.addView(body);
        feedback=text("正在连接官方登录服务…",14);AppTheme.role(feedback,"muted");feedback.setTextColor(theme.muted);body.addView(feedback);
        loginPanel=new LinearLayout(this);loginPanel.setOrientation(1);AppTheme.role(loginPanel,"card");loginPanel.setPadding(dp(18),dp(14),dp(18),dp(20));loginPanel.setBackground(shape(theme.surface));body.addView(loginPanel);
        LinearLayout outer=body;body=loginPanel;
        TextView loginTitle=text("学校账号登录",22);loginTitle.setTypeface(android.graphics.Typeface.create("sans-serif-medium",android.graphics.Typeface.NORMAL));body.addView(loginTitle);TextView intro=text("使用学校账号，验证成功后即可出示动态码",13);AppTheme.role(intro,"muted");intro.setTextColor(theme.muted);body.addView(intro);
        account=field("学校账号");account.setHint("例如 San.Zhang");account.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        body.addView(text("登录方式",14));method=new Spinner(this);AppTheme.role(method,"spinner");method.setBackground(inputShape());method.setPadding(dp(8),0,dp(8),0);body.addView(method,new LinearLayout.LayoutParams(-1,dp(48)));
        loginCode=field("动态登录验证码");loginCodeLabel=(TextView)body.getChildAt(body.getChildCount()-2);loginCode.setHint("请输入当前 OTP 动态口令");loginCode.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        body.removeView(loginCode);LinearLayout codeRow=new LinearLayout(this);codeRow.setGravity(android.view.Gravity.CENTER_VERTICAL);codeRow.addView(loginCode,new LinearLayout.LayoutParams(0,dp(48),1));
        send=button("发送验证码");send.setTextSize(13);send.setPadding(dp(6),0,dp(6),0);send.setOnClickListener(v->sendCode());LinearLayout.LayoutParams sendParams=new LinearLayout.LayoutParams(dp(104),dp(48));sendParams.leftMargin=dp(8);codeRow.addView(send,sendParams);body.addView(codeRow);
        captchaText=field("图片验证码");captchaText.setHint("请输入下方图片中的验证码");captchaText.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        LinearLayout imageRow=new LinearLayout(this);imageRow.setGravity(android.view.Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams imageParams=new LinearLayout.LayoutParams(-1,dp(64));imageParams.topMargin=dp(8);body.addView(imageRow,imageParams);
        captcha=new ImageView(this);AppTheme.role(captcha,"input");captcha.setContentDescription("学校登录图片验证码");captcha.setScaleType(ImageView.ScaleType.FIT_CENTER);captcha.setBackground(inputShape());imageRow.addView(captcha,new LinearLayout.LayoutParams(0,dp(64),1));
        refreshCaptcha=button("换一张");refreshCaptcha.setTextSize(13);refreshCaptcha.setOnClickListener(v->loadCaptcha());LinearLayout.LayoutParams changeParams=new LinearLayout.LayoutParams(dp(80),dp(44));changeParams.leftMargin=dp(8);imageRow.addView(refreshCaptcha,changeParams);
        loginFeedback=text("正在连接学校登录服务…",13);AppTheme.role(loginFeedback,"muted");loginFeedback.setTextColor(theme.muted);loginFeedback.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);loginFeedback.setPadding(0,dp(16),0,dp(4));body.addView(loginFeedback);
        login=button("登录并获取西浦码");login.setTextColor(0xFFFFFFFF);AppTheme.role(login,"primary");login.setBackground(shape(theme.primary));login.setOnClickListener(v->login());body.addView(login);TextView privacy=text("登录状态在本机加密保存 · 验证码不保存",12);privacy.setGravity(android.view.Gravity.CENTER);AppTheme.role(privacy,"muted");privacy.setTextColor(theme.muted);body.addView(privacy);
        body=outer;codePanel=new LinearLayout(this);codePanel.setOrientation(1);codePanel.setGravity(android.view.Gravity.CENTER_HORIZONTAL);codePanel.setVisibility(View.GONE);body.addView(codePanel);
        LinearLayout pass=new LinearLayout(this);pass.setOrientation(1);AppTheme.role(pass,"card");pass.setGravity(android.view.Gravity.CENTER_HORIZONTAL);pass.setPadding(dp(20),dp(20),dp(20),dp(20));pass.setBackground(shape(theme.surface));
        LinearLayout.LayoutParams passParams=new LinearLayout.LayoutParams(-1,-2);passParams.topMargin=dp(16);codePanel.addView(pass,passParams);
        TextView passTitle=text("西浦通行码",22);passTitle.setTypeface(android.graphics.Typeface.create("sans-serif-medium",android.graphics.Typeface.NORMAL));pass.addView(passTitle);
        TextView hint=text("将二维码对准扫码设备",14);AppTheme.role(hint,"muted");hint.setTextColor(theme.muted);pass.addView(hint);
        qr=new ImageView(this);qr.setContentDescription("我的动态西浦码");qr.setScaleType(ImageView.ScaleType.FIT_CENTER);qr.setBackgroundColor(0xFFFFFFFF);
        int qrSize=Math.min(dp(300),getResources().getDisplayMetrics().widthPixels-dp(88));LinearLayout.LayoutParams qrParams=new LinearLayout.LayoutParams(qrSize,qrSize);qrParams.topMargin=dp(16);qrParams.bottomMargin=dp(16);pass.addView(qr,qrParams);
        countdown=text("正在获取动态码…",14);AppTheme.role(countdown,"muted");countdown.setTextColor(theme.muted);pass.addView(countdown);
        codeLife=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);AppTheme.role(codeLife,"progress");codeLife.setMax(100);codeLife.setProgressTintList(android.content.res.ColorStateList.valueOf(theme.accent));codeLife.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(theme.wash));LinearLayout.LayoutParams lifeParams=new LinearLayout.LayoutParams(-1,dp(4));lifeParams.topMargin=dp(12);pass.addView(codeLife,lifeParams);
        refreshCode=button("刷新二维码");refreshCode.setTextColor(0xFFFFFFFF);AppTheme.role(refreshCode,"primary");refreshCode.setBackground(shape(theme.primary));refreshCode.setOnClickListener(v->fetchCode());codePanel.addView(refreshCode);
        TextView auto=text("动态码自动更新，重新进入无需重复登录",12);AppTheme.role(auto,"muted");auto.setTextColor(theme.muted);auto.setGravity(android.view.Gravity.CENTER);codePanel.addView(auto);
        Button logout=button("退出西浦码登录");AppTheme.role(logout,"muted");logout.setTextColor(theme.muted);AppTheme.role(logout,"plain");logout.setBackgroundColor(android.graphics.Color.TRANSPARENT);logout.setOnClickListener(v->endSession("已退出西浦码登录，请重新登录。"));codePanel.addView(logout);
        deviceId=getSharedPreferences("xipuCodeInstall",MODE_PRIVATE).getString("id","");if(deviceId.isEmpty()){deviceId=UUID.randomUUID().toString();getSharedPreferences("xipuCodeInstall",MODE_PRIVATE).edit().putString("id",deviceId).apply();}
        token=XipuCodeSession.read(this);
        if(!token.isEmpty()){loginPanel.setVisibility(View.GONE);codePanel.setVisibility(View.VISIBLE);status("正在恢复登录并获取西浦码…");}else loadLoginMethods();
    }
    private void loadLoginMethods(){
        setBusy(true);network.execute(()->{try{JSONObject flags=request("GET","api/authentication/loginTypeList",null,"").getJSONObject("data");ArrayList<String> available=new ArrayList<>(),labels=new ArrayList<>();if(!"1".equals(flags.optString("otp",flags.optString("opt","0")))){available.add("Otp");labels.add("OTP 动态口令");}if(!"1".equals(flags.optString("sms"))){available.add("Sms");labels.add("短信验证码");}if(!"1".equals(flags.optString("email"))){available.add("Email");labels.add("邮箱验证码");}post(()->{types.clear();types.addAll(available);method.setAdapter(new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,labels){
                    private View tint(View view){if(view instanceof TextView){((TextView)view).setTextColor(theme.ink);view.setBackgroundColor(theme.input);}return view;}
                    @Override public View getView(int position,View convert,android.view.ViewGroup parent){return tint(super.getView(position,convert,parent));}
                    @Override public View getDropDownView(int position,View convert,android.view.ViewGroup parent){return tint(super.getDropDownView(position,convert,parent));}
                });method.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onNothingSelected(AdapterView<?> p){}public void onItemSelected(AdapterView<?> p,View v,int position,long id){String chosen=types.get(position);send.setVisibility("Otp".equals(chosen)?View.GONE:View.VISIBLE);loginCodeLabel.setText("Otp".equals(chosen)?"OTP 动态口令":"Sms".equals(chosen)?"短信验证码":"邮箱验证码");loginCode.setHint("Otp".equals(chosen)?"请输入当前 OTP 动态口令":"请输入收到的验证码");boolean changed=!selectedLoginType.isEmpty()&&!selectedLoginType.equals(chosen);selectedLoginType=chosen;if(changed){loginCode.setText("");loadCaptcha("已切换登录方式，请输入对应动态验证码及新图片验证码。");}}});setBusy(false);if(types.isEmpty())status("学校当前未提供可用登录方式。");else loadCaptcha();});}catch(Exception e){fail("无法读取学校登录方式，请退出后重试。");}});
    }
    private static final class SessionExpired extends IOException {}
    private void endSession(String message){
        token="";XipuCodeSession.clear(this);qr.setImageDrawable(null);expiry=0;ui.removeCallbacks(tick);
        codePanel.setVisibility(View.GONE);loginPanel.setVisibility(View.VISIBLE);setBusy(false);
        if(types.isEmpty())loadLoginMethods();else loadCaptcha(message);
        status(message);
    }
    private void post(Runnable r){ui.post(()->{if(!isFinishing()&&!isDestroyed())r.run();});}
    private void setBusy(boolean value){busy=value;if(!value&&System.currentTimeMillis()>=sendAfter)send.setText("发送验证码");account.setEnabled(!value);loginCode.setEnabled(!value);captchaText.setEnabled(!value);login.setEnabled(!value&&!types.isEmpty());send.setEnabled(!value&&System.currentTimeMillis()>=sendAfter);refreshCaptcha.setEnabled(!value);refreshCode.setEnabled(!value);method.setEnabled(!value);}
    private void fail(String message){post(()->{setBusy(false);status(message);});}
    private static String encode(String value)throws Exception{return URLEncoder.encode(value,"UTF-8");}
    private JSONObject request(String method,String path,JSONObject data,String auth)throws Exception{
        URL url=new URL(BASE+path);HttpURLConnection c=(HttpURLConnection)url.openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(15000);c.setRequestMethod(method);c.setRequestProperty("Content-Type","application/json;charset=utf-8");if(!auth.isEmpty())c.setRequestProperty("Authorization",auth);
        try{if(data!=null){c.setDoOutput(true);try(OutputStream out=c.getOutputStream()){out.write(data.toString().getBytes("UTF-8"));}}int status=c.getResponseCode();if(!auth.isEmpty()&&(status==401||status==403))throw new SessionExpired();if(status!=200)throw new IOException("School service response");try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] bytes=new byte[4096];int n;while((n=in.read(bytes))!=-1){if(out.size()+n>2*1024*1024)throw new IOException("Response size");out.write(bytes,0,n);}JSONObject response=new JSONObject(out.toString("UTF-8"));if(!auth.isEmpty()&&(response.optInt("status")==401||response.optInt("status")==403||response.optInt("code")==401||response.optInt("code")==403))throw new SessionExpired();return response;}}finally{c.disconnect();}
    }
    private void loadCaptcha(){loadCaptcha("请输入账号、动态登录验证码和图片验证码。");}
    private void loadCaptcha(String message){if(busy)return;setBusy(true);captchaText.setText("");captchaKey="";captcha.setImageDrawable(null);network.execute(()->{try{JSONObject response=request("GET","api/authentication/getCaptcha",null,"");if(!response.optBoolean("success"))throw new IOException();JSONObject data=response.getJSONObject("data");String key=data.getString("captchaKey"),image=data.getString("imageBase");int comma=image.indexOf(',');if(comma>=0)image=image.substring(comma+1);byte[] bytes=android.util.Base64.decode(image,android.util.Base64.DEFAULT);Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length);if(bitmap==null)throw new IOException();post(()->{captchaKey=key;captcha.setImageBitmap(bitmap);setBusy(false);status(message);});}catch(Exception e){fail(message+" 图片验证码加载失败，请点“换一张”重试。");}});}
    private void sendCode(){if(busy||types.isEmpty()||System.currentTimeMillis()<sendAfter)return;String type=types.get(method.getSelectedItemPosition());if("Otp".equals(type))return;String name=account.getText().toString().trim(),imageCode=captchaText.getText().toString().trim();if(name.isEmpty()||imageCode.isEmpty()||captchaKey.isEmpty()){status("请先填写账号和图片验证码。");return;}setBusy(true);status("正在发送验证码，请稍候…");send.setText("发送中…");String key=captchaKey;network.execute(()->{try{String path="api/authentication/send-"+("Sms".equals(type)?"sms":"email")+"?username="+encode(name)+"&captchaKey="+encode(key)+"&code="+encode(imageCode);JSONObject response=request("POST",path,null,"");post(()->{if(response.optBoolean("success")){sendAfter=System.currentTimeMillis()+60000;ui.removeCallbacks(sendTick);ui.post(sendTick);}setBusy(false);String message=response.optBoolean("success")?"验证码已发送，请查看短信或邮箱，再填写更新后的图片验证码。":"发送失败，请核对账号和图片验证码后重试。";status(message);loadCaptcha(message);});}catch(Exception e){fail("验证码发送失败，请稍后重试。");}});}
    private void login(){if(busy||types.isEmpty())return;String name=account.getText().toString().trim(),code=loginCode.getText().toString().trim(),imageCode=captchaText.getText().toString().trim(),key=captchaKey,type=types.get(method.getSelectedItemPosition());if(name.isEmpty()||code.isEmpty()||key.isEmpty()||imageCode.isEmpty()){status("请填写账号、动态登录验证码和图片验证码。");return;}setBusy(true);status("正在由学校验证登录…");network.execute(()->{try{JSONObject data=new JSONObject();data.put("username",name);data.put("equipNo",deviceId);data.put("mobileSystem","android");data.put("captchaKey",key);data.put("code",imageCode);data.put("loginCode",code);JSONObject response=request("POST","api/authentication/loginBy"+type,data,"");if(!response.optBoolean("success")){post(()->{setBusy(false);String message=loginFailureMessage(response.optInt("status",response.optInt("code")),response.optString("message",response.optString("msg")));status(message);loadCaptcha(message);});return;}String access=response.getJSONObject("data").getString("token");if(access.isEmpty())throw new IOException();boolean stored;try{XipuCodeSession.save(this,access);stored=true;}catch(Exception storageError){XipuCodeSession.clear(this);stored=false;}final boolean retained=stored;post(()->{token=access;loginCode.setText("");captchaText.setText("");captchaKey="";setBusy(false);loginPanel.setVisibility(View.GONE);codePanel.setVisibility(View.VISIBLE);status(retained?"已登录，正在获取真实西浦码…":"已登录，但本机无法保存登录状态，退出后需重新登录。");fetchCode();});}catch(Exception e){fail("登录未完成，请稍后重试。尚未获取西浦码。");}});}
    static String loginFailureMessage(int status,String reason){
        String detail=reason==null?"":reason.toLowerCase(Locale.ROOT);
        String message;
        if(detail.contains("otp")||detail.contains("动态口令")||detail.contains("one-time"))message="动态口令校验未通过。请使用当前 OTP，并填写更新后的图片验证码。";
        else if(status==10005||detail.contains("captcha")||detail.contains("图片验证码"))message="账号或图片验证码校验未通过。图片已更新，请核对账号并重新填写图片验证码。";
        else message="学校未接受本次登录。请核对账号、当前动态验证码及更新后的图片验证码"+(status>0&&status<=999999?"（校验码 "+status+"）":"")+"。";
        return message;
    }
    static boolean validCode(String value){if(value==null)return false;String s=value.trim();return s.length()>=16&&s.length()<=4096&&!s.matches("(?i).*(placeholder|mock|undefined).*" )&&!s.equalsIgnoreCase("null");}
    private void fetchCode(){if(busy||token.isEmpty()||!active)return;setBusy(true);qr.setImageDrawable(null);codeLife.setProgress(0);countdown.setText("正在获取动态码…");expiry=0;String auth=token;network.execute(()->{try{JSONObject timing=request("GET","SchedulerTime/getSchedulerTime",null,auth);int seconds=timing.optInt("data",60);if(seconds<10||seconds>3600)seconds=60;JSONObject response=request("GET","qrcodeConfig/xjCode",null,auth);Object payload=response.opt("data");if(!response.optBoolean("success")||!(payload instanceof String)||!validCode((String)payload))throw new IOException();String content=(String)payload;Map<EncodeHintType,Object> hints=new EnumMap<>(EncodeHintType.class);hints.put(EncodeHintType.CHARACTER_SET,"UTF-8");hints.put(EncodeHintType.MARGIN,4);BitMatrix matrix=new QRCodeWriter().encode(content,BarcodeFormat.QR_CODE,768,768,hints);Bitmap bitmap=Bitmap.createBitmap(768,768,Bitmap.Config.ARGB_8888);int[] pixels=new int[768*768];for(int y=0;y<768;y++)for(int x=0;x<768;x++)pixels[y*768+x]=matrix.get(x,y)?0xFF000000:0xFFFFFFFF;bitmap.setPixels(pixels,0,768,0,0,768,768);final int duration=seconds;post(()->{if(!token.equals(auth)||!active){setBusy(false);return;}cycle=duration;expiry=System.currentTimeMillis()+cycle*1000L;qr.setImageBitmap(bitmap);setBusy(false);status("已获取学校返回的动态西浦码。");ui.removeCallbacks(tick);ui.post(tick);});}catch(SessionExpired e){post(()->{if(token.equals(auth))endSession("学校登录已过期，请重新登录。");});}catch(Exception e){post(()->{if(!token.equals(auth))return;setBusy(false);qr.setImageDrawable(null);ui.removeCallbacks(tick);countdown.setText("暂无有效西浦码");status("登录已完成，但学校暂未返回有效西浦码。可重试；若持续失败，可能需要官方设备校验。");});}});}
    @Override protected void onResume(){super.onResume();theme=AppTheme.read(this);theme.window(this);theme.apply(getWindow().getDecorView());if(method!=null&&method.getAdapter() instanceof ArrayAdapter)((ArrayAdapter)method.getAdapter()).notifyDataSetChanged();active=true;if(qr!=null&&!token.isEmpty())fetchCode();}
    @Override public void onConfigurationChanged(android.content.res.Configuration configuration){super.onConfigurationChanged(configuration);theme=AppTheme.read(this);theme.window(this);theme.apply(getWindow().getDecorView());if(method.getAdapter() instanceof ArrayAdapter)((ArrayAdapter)method.getAdapter()).notifyDataSetChanged();}
    @Override protected void onPause(){active=false;ui.removeCallbacks(tick);if(qr!=null)qr.setImageDrawable(null);expiry=0;super.onPause();}
    @Override protected void onDestroy(){token="";captchaKey="";ui.removeCallbacksAndMessages(null);network.shutdownNow();super.onDestroy();}
}
