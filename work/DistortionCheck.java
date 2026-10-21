package cn.local.ams;
import com.google.zxing.*; import com.google.zxing.common.*; import com.google.zxing.qrcode.*;
public class DistortionCheck {
 public static void main(String[] args) throws Exception {
  String text="https://ams.xjtlu.edu.cn/?code=LOCAL_TEST_ONLY";
  BitMatrix qr=new QRCodeWriter().encode(text,BarcodeFormat.QR_CODE,320,320);
  for(double factor:new double[]{0.5,0.67,0.8,1.0,1.25,1.5,2.0}) {
   int w=1920,h=1080,qw=(int)(320*factor); byte[] pixels=new byte[w*h]; java.util.Arrays.fill(pixels,(byte)255);
   for(int y=0;y<320;y++) for(int x=0;x<qw;x++) pixels[(y+(h-320)/2)*w+x+(w-qw)/2]=qr.get(Math.min(319,(int)(x/factor)),y)?0:(byte)255;
   long start=System.nanoTime(); String result=QrDecoder.decode(pixels,w,h);
   if(!text.equals(result)) throw new AssertionError("stretch factor "+factor);
   System.out.println("PASS factor="+factor+" decodeMs="+((System.nanoTime()-start)/1000000));
  }
 }
}
