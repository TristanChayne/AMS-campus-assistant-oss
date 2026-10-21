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

/** Only the session token is retained; the encryption key stays in AndroidKeyStore. */
final class XipuCodeSession {
    private static final String ALIAS="ams.xipuCode.session";
    private static SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
        KeyGenerator generator=KeyGenerator.getInstance("AES","AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    static byte[][] encrypt(SecretKey key,String token)throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key);
        return new byte[][]{cipher.getIV(),cipher.doFinal(token.getBytes("UTF-8"))};
    }
    static String decrypt(SecretKey key,byte[] iv,byte[] value)throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,iv));
        return new String(cipher.doFinal(value),"UTF-8");
    }
    static void save(Context context,String token)throws Exception {
        byte[][] value=encrypt(key(),token);
        if(!context.getSharedPreferences("xipuCodeSession",Context.MODE_PRIVATE).edit()
            .putString("iv",Base64.encodeToString(value[0],Base64.NO_WRAP))
            .putString("token",Base64.encodeToString(value[1],Base64.NO_WRAP)).commit())throw new java.io.IOException("Session storage failed");
    }
    static String read(Context context){
        android.content.SharedPreferences prefs=context.getSharedPreferences("xipuCodeSession",Context.MODE_PRIVATE);
        String value=prefs.getString("token","");if(value.isEmpty())return "";
        try{return decrypt(key(),Base64.decode(prefs.getString("iv",""),Base64.NO_WRAP),Base64.decode(value,Base64.NO_WRAP));}
        catch(Exception e){clear(context);return "";}
    }
    static void clear(Context context){context.getSharedPreferences("xipuCodeSession",Context.MODE_PRIVATE).edit().clear().commit();}
}
