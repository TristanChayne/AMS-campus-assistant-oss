package cn.local.ams;
import com.google.zxing.*;
import com.google.zxing.common.*;
import com.google.zxing.qrcode.*;
public class ScanDecodeCheck {
 public static void main(String[] args) throws Exception {
  String text="https://ams.xjtlu.edu.cn/?code=LOCAL_TEST_ONLY";
  int checks=0;
  for(int size:new int[]{100,240,400}) for(boolean invert:new boolean[]{false,true}) for(boolean rotate:new boolean[]{false,true}) {
   BitMatrix qr=new QRCodeWriter().encode(text,BarcodeFormat.QR_CODE,size,size);
   byte[] frame=new byte[1280*720]; java.util.Arrays.fill(frame,invert?(byte)0:(byte)255);
   for(int y=0;y<size;y++) for(int x=0;x<size;x++) {
    boolean black=rotate?qr.get(y,size-1-x):qr.get(x,y);
    frame[(y+(720-size)/2)*1280+x+(1280-size)/2]=(black^invert)?0:(byte)255;
   }
   if(!text.equals(QrDecoder.decode(frame,1280,720))) throw new AssertionError("Failed size="+size+" inverse="+invert+" rotation="+rotate);
   checks++;
  }
  if(QrDecoder.decode(new byte[1280*720],1280,720)!=null) throw new AssertionError("Blank false positive");
  System.out.println("PASS: "+(checks+1)+" checks (sizes, rotation, inversion, blank); no network submission");
 }
}
