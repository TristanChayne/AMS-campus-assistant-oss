import Foundation
import CoreImage.CIFilterBuiltins

@main struct QRCodeDecoderChecks {
    static func main() {
        let expected = "AMS_TEST_ONLY_NOT_A_SIGNIN_CODE"
        let filter = CIFilter.qrCodeGenerator(); filter.message = Data(expected.utf8)
        let code = filter.outputImage!
        let padded = code.composited(over:CIImage(color:.white).cropped(to:code.extent.insetBy(dx:-4,dy:-4)))
        let image = padded.transformed(by:CGAffineTransform(scaleX:6,y:6))
        let decoder = QRCodeDecoder()
        precondition(decoder.decode(image) == expected)
        precondition(decoder.decode(image.applyingFilter("CIColorInvert")) == expected)
        for factor in [0.5,2.0] {
            precondition(decoder.decode(image.transformed(by:CGAffineTransform(scaleX:factor,y:1))) == expected)
        }
        precondition(decoder.decode(CIImage(color:.white).cropped(to:CGRect(x:0,y:0,width:360,height:360))) == nil)
        print("PASS: ordinary/inverted/projector-axis QR and blank rejection; synthetic non-sign-in payload only")
    }
}
