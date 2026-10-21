import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.util.*;
public class GrantJavaCheck {
 public static void main(String[] args) throws Exception {
  List<String> lines=Files.readAllLines(Paths.get(args[0]),StandardCharsets.UTF_8);
  PublicKey key=KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.getUrlDecoder().decode(lines.get(0))));
  String[] token=lines.get(1).split("\\.");byte[] payload=token[0].getBytes(StandardCharsets.UTF_8),signed=Base64.getUrlDecoder().decode(token[1]);
  Signature verifier=Signature.getInstance("SHA256withRSA");verifier.initVerify(key);verifier.update(payload);
  if(!verifier.verify(signed))throw new AssertionError("cloud signature incompatible with Java");
  signed[0]^=1;verifier.initVerify(key);verifier.update(payload);if(verifier.verify(signed))throw new AssertionError("tampering accepted");
  System.out.println("PASS: actual Cloudflare grant verified by Java SHA256withRSA; tampering rejected");
 }
}
