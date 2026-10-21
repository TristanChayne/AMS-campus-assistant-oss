package cn.local.ams;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** HuiHuTong credentials are encrypted locally with an independent Keystore key. */
final class HhtSession {
    private static SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        String alias="ams.hht.session";
        if(store.containsAlias(alias))return (SecretKey)store.getKey(alias,null);
        KeyGenerator generator=KeyGenerator.getInstance("AES","AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    static void save(Context context,JSONObject data)throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
        byte[] value=cipher.doFinal(data.toString().getBytes("UTF-8"));
        if(!context.getSharedPreferences("hhtSession",Context.MODE_PRIVATE).edit()
            .putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP))
            .putString("value",Base64.encodeToString(value,Base64.NO_WRAP)).commit())throw new java.io.IOException("Storage unavailable");
    }
    static JSONObject read(Context context){
        android.content.SharedPreferences prefs=context.getSharedPreferences("hhtSession",Context.MODE_PRIVATE);
        String value=prefs.getString("value","");if(value.isEmpty())return new JSONObject();
        try{
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(prefs.getString("iv",""),Base64.NO_WRAP)));
            return new JSONObject(new String(cipher.doFinal(Base64.decode(value,Base64.NO_WRAP)),"UTF-8"));
        }catch(Exception e){clear(context);return new JSONObject();}
    }
    static boolean clear(Context context){return context.getSharedPreferences("hhtSession",Context.MODE_PRIVATE).edit().clear().commit();}
}
