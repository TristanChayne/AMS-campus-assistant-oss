package cn.local.ams;

import android.app.Activity;
import android.content.Context;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.view.ViewGroup;
import android.widget.*;
import android.webkit.WebView;

/** The campus palette shared by native screens and managed school pages. */
final class AppTheme {
    static final String[] KEYS={"blue","green","dusk","teal","sage","smoke","graphite","rose","wheat"};
    private static final int[][] COLORS={{0x172E61,0x254E9B,0xEAF0FA},{0x205C52,0x327E70,0xE8F3EF},
        {0x405D7A,0x405D7A,0xEAF0F6},{0x356B68,0x356B68,0xE9F2F0},{0x526B58,0x526B58,0xEDF2ED},
        {0x655F7C,0x655F7C,0xF0EDF5},{0x555E6A,0x555E6A,0xEDF0F3},{0x956174,0x805064,0xF5EBEF},{0x806A28,0x756020,0xF5F0DF}};
    final String key;final boolean dark;
    final int paper,surface,input,ink,muted,line,primary,accent,wash;
    private AppTheme(String key,boolean dark,int index){
        this.key=key;this.dark=dark;primary=0xFF000000|COLORS[index][0];
        paper=dark?0xFF15191F:0xFFF5F6F8;surface=dark?0xFF202630:0xFFFCFDFE;
        input=dark?0xFF191F27:0xFFF5F7FA;ink=dark?0xFFE7ECF4:0xFF17233A;
        muted=dark?0xFFA4AFBF:0xFF69758A;line=dark?0xFF343D49:0xFFE2E8F0;
        accent=dark?mix(0xFF000000|COLORS[index][1],0xFFFFFFFF,.55f):0xFF000000|COLORS[index][1];
        wash=dark?mix(surface,primary,.30f):0xFF000000|COLORS[index][2];
    }
    static AppTheme of(String key,boolean dark){
        if("orange".equals(key))key="smoke";
        for(int i=0;i<KEYS.length;i++)if(KEYS[i].equals(key))return new AppTheme(key,dark,i);
        return new AppTheme("blue",dark,0);
    }
    static boolean validKey(String key){for(String value:KEYS)if(value.equals(key))return true;return false;}
    static AppTheme read(Context context){
        android.content.SharedPreferences prefs=context.getSharedPreferences("amsAppearance",Context.MODE_PRIVATE);
        String mode=prefs.getString("mode","system");
        boolean dark="dark".equals(mode)||("system".equals(mode)&&(context.getResources().getConfiguration().uiMode&Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES);
        return of(prefs.getString("theme","blue"),dark);
    }
    private static int mix(int a,int b,float amount){int out=0xFF000000;for(int shift:new int[]{16,8,0})out|=Math.round(((a>>shift)&255)*(1-amount)+((b>>shift)&255)*amount)<<shift;return out;}
    static void role(View view,String role){view.setTag("ams:"+role);}
    private GradientDrawable shape(View view,int color,boolean border){
        float density=view.getResources().getDisplayMetrics().density;GradientDrawable shape=new GradientDrawable();
        shape.setColor(color);shape.setCornerRadius((border?10:14)*density);if(border)shape.setStroke(Math.round(density),line);return shape;
    }
    void apply(View view){
        String role=view.getTag() instanceof String?(String)view.getTag():"";
        if("ams:paper".equals(role)||"ams:loading".equals(role))view.setBackgroundColor(paper);
        if("ams:card".equals(role))view.setBackground(shape(view,surface,false));
        if("ams:input".equals(role)||"ams:spinner".equals(role))view.setBackground(shape(view,input,true));
        if(view instanceof Spinner&&"ams:spinner".equals(role))((Spinner)view).setPopupBackgroundDrawable(shape(view,surface,false));
        if("ams:soft".equals(role))view.setBackground(shape(view,wash,false));
        if("ams:primary".equals(role))view.setBackground(shape(view,primary,false));
        if("ams:plain".equals(role))view.setBackgroundColor(0);
        if(view instanceof TextView&&role.startsWith("ams:")){
            TextView text=(TextView)view;int color="ams:primary".equals(role)?0xFFFFFFFF:
                "ams:soft".equals(role)?accent:("ams:muted".equals(role)||"ams:plain".equals(role)||"ams:loading".equals(role))?muted:ink;
            text.setTextColor(color);if(view instanceof EditText){text.setHintTextColor(muted);
                text.setHighlightColor(wash);if(android.os.Build.VERSION.SDK_INT>=29&&text.getTextCursorDrawable()!=null){android.graphics.drawable.Drawable cursor=text.getTextCursorDrawable().mutate();cursor.setTint(accent);text.setTextCursorDrawable(cursor);}
            }
        }
        if(view instanceof ProgressBar&&"ams:progress".equals(role)){
            ((ProgressBar)view).setProgressTintList(ColorStateList.valueOf(accent));
            ((ProgressBar)view).setProgressBackgroundTintList(ColorStateList.valueOf(wash));
        }
        if(view instanceof ViewGroup&&!(view instanceof WebView))for(int i=0;i<((ViewGroup)view).getChildCount();i++)apply(((ViewGroup)view).getChildAt(i));
    }
    void window(Activity activity){
        activity.getWindow().setStatusBarColor(paper);activity.getWindow().setNavigationBarColor(paper);
        activity.getWindow().getDecorView().setSystemUiVisibility(dark?0:View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    }
    static String hex(int value){return String.format(java.util.Locale.ROOT,"#%06x",value&0xFFFFFF);}
    String webScript(){
        return "(function(){if(window.__campusTheme&&window.__campusTheme.dark==="+dark+"&&window.__campusTheme.key==='"+key+"')return;window.__campusTheme={dark:"+dark+",key:'"+key+"'};document.documentElement.classList.toggle('campus-dark',"+dark+");var s=document.documentElement.style;"+
            property("paper",paper)+property("surface",surface)+property("input",input)+property("ink",ink)+property("muted",muted)+property("line",line)+property("primary",primary)+property("accent",accent)+property("wash",wash)+"})();";
    }
    private String property(String name,int value){return "s.setProperty('--campus-"+name+"','"+hex(value)+"');";}
}
