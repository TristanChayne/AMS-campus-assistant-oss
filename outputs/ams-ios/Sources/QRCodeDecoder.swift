import CoreImage
import Vision

// Native metadata remains the fast path. This fallback mirrors Android's crop,
// inversion and projector-axis correction, using Apple's barcode decoder.
final class QRCodeDecoder {
    func decode(_ source:CIImage) -> String? {
        let scale = min(1,960 / max(source.extent.width,source.extent.height))
        let full = source.transformed(by:CGAffineTransform(scaleX:scale,y:scale))
        let side = min(full.extent.width,full.extent.height) * 0.8
        let center = full.cropped(to:CGRect(x:full.extent.midX-side/2,y:full.extent.midY-side/2,width:side,height:side))
        for image in [full,center] {
            if let result = read(image) { return result }
            if let result = read(image.applyingFilter("CIColorInvert")) { return result }
        }
        let factors:[CGFloat] = [0.67,1.5,0.5,2.0,0.8,1.25]
        for factor in factors {
            if let result = read(center.transformed(by:CGAffineTransform(scaleX:factor,y:1))) { return result }
        }
        return nil
    }
    private func read(_ image:CIImage) -> String? {
        let request = VNDetectBarcodesRequest(); request.symbologies = [.qr]
        do { try VNImageRequestHandler(ciImage:image,options:[:]).perform([request]) } catch { return nil }
        return request.results?.compactMap(\.payloadStringValue).first(where:{!$0.isEmpty})
    }
}
