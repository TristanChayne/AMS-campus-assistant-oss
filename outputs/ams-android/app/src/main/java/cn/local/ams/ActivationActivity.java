package cn.local.ams;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.widget.*;
import android.view.*;

public class ActivationActivity extends Activity {
    private TextView message;
    private Button activate;
    private EditText code;
    private boolean working;
    private boolean checking;
    private boolean formShown;
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size, int color) { TextView t = new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(color); return t; }
    private GradientDrawable surface(int color, int radius) { GradientDrawable d = new GradientDrawable(); d.setColor(color); d.setCornerRadius(dp(radius)); return d; }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(0xFFF5F6F8); getWindow().setNavigationBarColor(0xFFF5F6F8);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        View waiting = new View(this); waiting.setBackgroundColor(0xFFF5F6F8); setContentView(waiting);
        checkActivation();
    }
    @Override public void onResume() {
        super.onResume();
        if(formShown)checkActivation();
    }
    private void checkActivation() {
        if(checking||working)return;
        checking=true;
        new Thread(() -> { boolean valid=Activation.valid(this);
            // Disabled earlier: ask the server once more, so a device that was enabled again continues without a new code.
            if(!valid&&getSharedPreferences("activation",0).getBoolean("revoked",false)){try{Activation.refresh(getApplicationContext());}catch(Exception ignored){}valid=Activation.valid(this);}
            final boolean ok=valid; runOnUiThread(() -> { checking=false; if(isFinishing()||isDestroyed())return; if(ok)enter(); else if(!formShown)showForm(); }); }).start();
    }
    private void showForm() {
        formShown=true;
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(0xFFF5F6F8);
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL); layout.setPadding(dp(28),dp(65),dp(28),dp(25));
        scroll.addView(layout); setContentView(scroll);
        TextView eyebrow = text("CAMPUS DAY", 11, 0xFF69758A); layout.addView(eyebrow);
        TextView title = text("开启校园助手", 29, 0xFF18233A); title.setTypeface(null,Typeface.BOLD); title.setPadding(0,dp(15),0,dp(12));layout.addView(title);
        TextView hint = text(getSharedPreferences("activation",0).getBoolean("revoked",false)?"激活已停用，请使用有效激活码重新激活。":"首次使用需要激活。激活后，退出学校账号或更新应用都不受影响。",14,0xFF69758A);hint.setLineSpacing(dp(4),1);layout.addView(hint);
        code = new EditText(this); code.setSingleLine(true); code.setTextSize(14); code.setHint("粘贴激活码");code.setContentDescription("激活码");code.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        code.setBackground(surface(Color.WHITE,12));code.setPadding(dp(14),dp(15),dp(14),dp(15));
        LinearLayout.LayoutParams field = new LinearLayout.LayoutParams(-1,-2);field.topMargin=dp(32);layout.addView(code,field);
        activate = new Button(this);activate.setText("激活并进入");activate.setTextColor(Color.WHITE);activate.setAllCaps(false);activate.setBackground(surface(0xFF172E61,12));
        LinearLayout.LayoutParams button = new LinearLayout.LayoutParams(-1,dp(52));button.topMargin=dp(14);layout.addView(activate,button);
        message = text("",13,0xFF9A5142);message.setPadding(0,dp(16),0,dp(20));message.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);layout.addView(message);
        TextView note = text("卸载应用或清除数据后，需要重新激活。\n激活后会记录本机当前登录的学校账户名，用于设备管理；不接收密码。",12,0xFF69758A);note.setLineSpacing(dp(5),1);layout.addView(note);
        TextView footer = text("由 Tristan Chayne 制作\nlinlantc@gmail.com",11,0xFF69758A);footer.setGravity(Gravity.CENTER);footer.setPadding(0,dp(50),0,0);layout.addView(footer);
        activate.setOnClickListener(v -> submit());
    }
    private void submit() {
        if(working)return;String input=code.getText().toString();if(input.trim().isEmpty()){code.setError("请输入激活码");return;}
        working=true;activate.setEnabled(false);code.setEnabled(false);activate.setText("正在激活…");message.setText("");
        new Thread(() -> {String error=null;try{Activation.activate(this,input);}catch(Exception e){error=Activation.errorText(e);}final String result=error;runOnUiThread(() -> {if(isFinishing()||isDestroyed())return;working=false;if(result==null){enter();return;}message.setText(result);activate.setText("激活并进入");activate.setEnabled(true);code.setEnabled(true);});}).start();
    }
    private void enter(){startActivity(new Intent(this,MainActivity.class));finish();overridePendingTransition(0,0);}
}
