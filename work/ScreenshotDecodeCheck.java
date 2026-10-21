package cn.local.ams;
import javax.imageio.ImageIO;
import java.io.File;
import java.awt.image.BufferedImage;
public class ScreenshotDecodeCheck {
 public static void main(String[] args) throws Exception {
  BufferedImage im=ImageIO.read(new File(args[0]));
  byte[] pixels=new byte[im.getWidth()*im.getHeight()];
  for(int y=0;y<im.getHeight();y++) for(int x=0;x<im.getWidth();x++) {
   int rgb=im.getRGB(x,y); pixels[y*im.getWidth()+x]=(byte)((((rgb>>16)&255)*299+((rgb>>8)&255)*587+(rgb&255)*114)/1000);
  }
  System.out.println("Screenshot decoded: "+(QrDecoder.decode(pixels,im.getWidth(),im.getHeight())!=null));
 }
}
