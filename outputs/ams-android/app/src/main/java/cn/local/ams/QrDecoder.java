package cn.local.ams;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.LuminanceSource;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.ReaderException;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;
import java.util.EnumMap;
import java.util.Map;

final class QrDecoder {
    static String decode(byte[] frame, int width, int height) {
        if (frame == null || frame.length < width * height) return null;
        Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        LuminanceSource full = new PlanarYUVLuminanceSource(frame, width, height, 0, 0, width, height, false);
        int side = Math.min(width, height) * 4 / 5;
        LuminanceSource center = full.crop((width - side) / 2, (height - side) / 2, side, side);
        for (LuminanceSource source : new LuminanceSource[]{full, center}) {
            for (boolean inverted : new boolean[]{false, true}) {
                try {
                    return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(
                            inverted ? source.invert() : source)), hints).getText();
                } catch (ReaderException ignored) { }
            }
        }
        // Projectors may stretch either axis. Correct the centered luminance frame locally.
        byte[] original = center.getMatrix();
        for (double factor : new double[]{0.67, 1.5, 0.5, 2.0, 0.8, 1.25}) {
            int adjustedWidth = Math.max(1, (int)(side * factor));
            byte[] corrected = new byte[adjustedWidth * side];
            for (int y = 0; y < side; y++) {
                for (int x = 0; x < adjustedWidth; x++) {
                    int sourceX = Math.min(side - 1, (int)(x / factor));
                    corrected[y * adjustedWidth + x] = original[y * side + sourceX];
                }
            }
            LuminanceSource adjusted = new PlanarYUVLuminanceSource(corrected, adjustedWidth, side,
                    0, 0, adjustedWidth, side, false);
            try {
                return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(adjusted)), hints).getText();
            } catch (ReaderException ignored) { }
        }
        return null;
    }
}
