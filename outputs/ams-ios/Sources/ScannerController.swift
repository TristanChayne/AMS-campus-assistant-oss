import UIKit
import AVFoundation
import CoreImage

final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate, AVCaptureVideoDataOutputSampleBufferDelegate {
    var onCode: ((String) -> Void)?
    var demoEnabled = false
    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "ams.camera")
    private let decodeQueue = DispatchQueue(label:"ams.qr.fallback",qos:.userInitiated)
    private let decoder = QRCodeDecoder()
    private let decodeLock = NSLock()
    private var decodeActive = false, decodeRevision = UUID()
    private var lastDecoded:TimeInterval = 0 // Accessed only by decodeQueue.
    private var device: AVCaptureDevice?
    private var preview: AVCaptureVideoPreviewLayer?
    private var consumed = false
    private let corners = CAShapeLayer()
    private let scanLine = CALayer()
    private let focusRing = CAShapeLayer()
    private let hint = UILabel()
    private var scanRect = CGRect.zero
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .black; title = "扫码签到"
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "取消", style: .plain, target: self, action: #selector(close))
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: "手电筒", style: .plain, target: self, action: #selector(torch))
        corners.fillColor = UIColor.clear.cgColor; corners.strokeColor = UIColor.systemCyan.cgColor; corners.lineWidth = 4; corners.lineCap = .round
        scanLine.backgroundColor = UIColor.systemCyan.withAlphaComponent(0.8).cgColor
        focusRing.fillColor = UIColor.clear.cgColor; focusRing.strokeColor = UIColor.systemYellow.cgColor; focusRing.lineWidth = 2; focusRing.opacity = 0
        view.layer.addSublayer(corners); view.layer.addSublayer(scanLine); view.layer.addSublayer(focusRing)
        hint.text = "将签到二维码对准取景框"; hint.textColor = .white; hint.font = .preferredFont(forTextStyle: .subheadline); hint.adjustsFontForContentSizeCategory = true; hint.textAlignment = .center; hint.numberOfLines = 0
        view.addSubview(hint)
        if demoEnabled {
            hint.text = "演示扫码 · 不向学校提交。可扫描演示码，或使用下方演示按钮。"
            let button = UIButton(configuration:.filled()); button.setTitle("使用演示二维码（不可真实签到）",for:.normal); button.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(button)
            button.addAction(UIAction { [weak self] _ in self?.consume("AMS-DEMO-NOT-VALID:ATTENDANCE") },for:.touchUpInside)
            NSLayoutConstraint.activate([button.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor,constant:-24),button.centerXAnchor.constraint(equalTo:view.centerXAnchor)])
            #if targetEnvironment(simulator)
            return
            #endif
        }
        view.addGestureRecognizer(UIPinchGestureRecognizer(target: self, action: #selector(zoom(_:))))
        view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(focus(_:))))
        NotificationCenter.default.addObserver(self, selector: #selector(stop), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(start), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(updateScanAnimation), name: UIAccessibility.reduceMotionStatusDidChangeNotification, object: nil)
        AVCaptureDevice.requestAccess(for: .video) { allowed in
            DispatchQueue.main.async {
                guard allowed else { self.failure("请在系统设置中允许 AMS 使用相机。也可以返回使用 Code 签到。"); return }
                self.prepare()
            }
        }
    }
    private func prepare() {
        guard let camera = AVCaptureDevice.default(for: .video), let input = try? AVCaptureDeviceInput(device: camera), session.canAddInput(input) else { failure("当前设备没有可用相机，请使用真机验证扫码。 "); return }
        device = camera; session.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { failure("无法启动扫描。 "); return }
        session.addOutput(output); output.setMetadataObjectsDelegate(self, queue: .main); output.metadataObjectTypes = [.qr]
        let frames = AVCaptureVideoDataOutput(); frames.alwaysDiscardsLateVideoFrames = true
        frames.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA]
        if session.canAddOutput(frames) { session.addOutput(frames); frames.setSampleBufferDelegate(self,queue:decodeQueue) }
        let layer = AVCaptureVideoPreviewLayer(session: session); layer.videoGravity = .resizeAspectFill; view.layer.insertSublayer(layer, at: 0); preview = layer
        view.setNeedsLayout(); start()
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews(); preview?.frame = view.bounds
        let area = view.bounds.inset(by: view.safeAreaInsets)
        let side = min(280, min(area.width - 48, area.height - 100))
        let rect = CGRect(x: area.midX - side / 2, y: area.midY - side / 2 - 25, width: side, height: side)
        guard rect != scanRect else { return }; scanRect = rect
        CATransaction.begin(); CATransaction.setDisableActions(true)
        let path = UIBezierPath(); let length: CGFloat = 24
        for (x, y, dx, dy) in [(rect.minX, rect.minY, CGFloat(1), CGFloat(1)), (rect.maxX, rect.minY, CGFloat(-1), CGFloat(1)), (rect.minX, rect.maxY, CGFloat(1), CGFloat(-1)), (rect.maxX, rect.maxY, CGFloat(-1), CGFloat(-1))] {
            path.move(to: CGPoint(x: x + dx * length, y: y)); path.addLine(to: CGPoint(x: x, y: y)); path.addLine(to: CGPoint(x: x, y: y + dy * length))
        }
        corners.path = path.cgPath
        scanLine.frame = CGRect(x: rect.minX + 8, y: rect.minY + 8, width: side - 16, height: 2)
        hint.frame = CGRect(x: area.minX + 24, y: rect.maxY + 24, width: area.width - 48, height: 60)
        CATransaction.commit(); updateScanAnimation()
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated); start()
        guard !UIAccessibility.isReduceMotionEnabled else { return }
        let fade = CABasicAnimation(keyPath: "opacity"); fade.fromValue = 0; fade.toValue = 1; fade.duration = 0.25; corners.add(fade, forKey: "entrance")
    }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); stop() }
    deinit { NotificationCenter.default.removeObserver(self) }
    @objc private func start() { guard !consumed, viewIfLoaded?.window != nil, device != nil, UIApplication.shared.applicationState == .active else { return }; setDecodeActive(true); updateScanAnimation(); queue.async { if !self.session.isRunning { self.session.startRunning() } } }
    @objc private func stop() { setDecodeActive(false); scanLine.removeAllAnimations(); scanLine.isHidden = true; focusRing.removeAllAnimations(); queue.async { if self.session.isRunning { self.session.stopRunning() } } }
    private func setDecodeActive(_ value:Bool) { decodeLock.lock(); decodeActive = value; decodeRevision = UUID(); decodeLock.unlock() }
    func captureOutput(_ output:AVCaptureOutput,didOutput sampleBuffer:CMSampleBuffer,from connection:AVCaptureConnection) {
        decodeLock.lock(); let active = decodeActive, revision = decodeRevision; decodeLock.unlock()
        let now = ProcessInfo.processInfo.systemUptime
        guard active,now-lastDecoded >= 0.7,let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        lastDecoded = now
        let result = autoreleasepool { decoder.decode(CIImage(cvPixelBuffer:buffer)) }
        guard let code = result else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.decodeLock.lock(); let valid = self.decodeActive && self.decodeRevision == revision; self.decodeLock.unlock()
            if valid { self.consume(code) }
        }
    }
    @objc private func updateScanAnimation() {
        scanLine.removeAllAnimations()
        scanLine.isHidden = consumed || device == nil || viewIfLoaded?.window == nil || UIApplication.shared.applicationState != .active || UIAccessibility.isReduceMotionEnabled
        guard !scanLine.isHidden else { return }
        let movement = CABasicAnimation(keyPath: "transform.translation.y"); movement.fromValue = 0; movement.toValue = max(0, scanRect.height - 18); movement.duration = 2.2; movement.autoreverses = true; movement.repeatCount = .infinity; movement.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        scanLine.add(movement, forKey: "scan")
    }
    @objc private func close() { consumed = true; stop(); dismiss(animated: true) }
    private func failure(_ text: String) { let alert = UIAlertController(title: "无法扫描", message: text, preferredStyle: .alert); alert.addAction(UIAlertAction(title: "返回", style: .default) { _ in self.close() }); present(alert, animated: true) }
    @objc private func torch() { guard let device, device.hasTorch else { return }; do { try device.lockForConfiguration(); device.torchMode = device.torchMode == .on ? .off : .on; device.unlockForConfiguration() } catch {} }
    @objc private func zoom(_ gesture: UIPinchGestureRecognizer) { guard let device else { return }; do { try device.lockForConfiguration(); device.videoZoomFactor = min(max(1, device.videoZoomFactor * gesture.scale), min(device.activeFormat.videoMaxZoomFactor, 8)); device.unlockForConfiguration(); gesture.scale = 1 } catch {} }
    @objc private func focus(_ gesture: UITapGestureRecognizer) {
        guard let device, let preview, !consumed else { return }
        let location = gesture.location(in: view); let point = preview.captureDevicePointConverted(fromLayerPoint: location)
        do { try device.lockForConfiguration(); if device.isFocusPointOfInterestSupported { device.focusPointOfInterest = point; device.focusMode = .autoFocus }; device.unlockForConfiguration() } catch { return }
        focusRing.position = location; focusRing.path = UIBezierPath(roundedRect: CGRect(x: -28, y: -28, width: 56, height: 56), cornerRadius: 10).cgPath
        let fade = CABasicAnimation(keyPath: "opacity"); fade.fromValue = 1; fade.toValue = 0; fade.duration = 0.6; focusRing.add(fade, forKey: "focus")
        if !UIAccessibility.isReduceMotionEnabled { let shrink = CABasicAnimation(keyPath: "transform.scale"); shrink.fromValue = 1.25; shrink.toValue = 1; shrink.duration = 0.2; focusRing.add(shrink, forKey: "shrink") }
    }
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard let code = objects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first else { return }
        consume(code)
    }
    private func consume(_ code:String) {
        guard !consumed,!code.isEmpty,viewIfLoaded?.window != nil,UIApplication.shared.applicationState == .active else { return }
        consumed = true; stop(); corners.strokeColor = UIColor.systemGreen.cgColor; hint.text = "已识别，正在处理"; UIImpactFeedbackGenerator(style: .light).impactOccurred()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            guard let self, self.viewIfLoaded?.window != nil else { return }
            self.dismiss(animated: true) { self.onCode?(code) }
        }
    }
}
