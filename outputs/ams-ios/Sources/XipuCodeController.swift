import UIKit
import CoreImage.CIFilterBuiltins

private final class FeedbackLabel: UILabel {
    override var text:String? { didSet { isHidden = text?.isEmpty ?? true } }
}

private final class PortalSession: NSObject, URLSessionTaskDelegate {
    lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false; config.timeoutIntervalForRequest = 15
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

final class XipuCodeController: UIViewController, UIGestureRecognizerDelegate {
    private let demoPayload:String?
    init(demoPayload:String? = nil) { self.demoPayload=demoPayload;super.init(nibName:nil,bundle:nil) }
    required init?(coder:NSCoder) { fatalError() }
    private let portal = PortalSession()
    private let stack = UIStackView()
    private let account = UITextField(), loginCode = UITextField(), captchaText = UITextField()
    private let method = UISegmentedControl(items: [])
    private let captcha = UIImageView(), qr = UIImageView()
    private let status = FeedbackLabel(), countdown = UILabel()
    private let progress = UIProgressView(progressViewStyle:.default)
    private var validityDuration:TimeInterval = 60
    private var logoutButton:UIButton!
    private var types: [String] = []
    private var token = KeychainStore.read("portalToken"), captchaKey = ""
    private var busy = false, active = false, expiry = Date.distantPast, sendAfter = Date.distantPast
    private var timer: Timer?
    private var pending: Task<Void, Never>?
    private var generation = UUID()
    private var loginPanel = UIStackView(), codePanel = UIStackView()
    private var controls: [UIControl] = []
    private var sendButton: UIButton!
    private enum PortalError: Error { case expired, invalid }
    private var deviceID: String {
        let existing = KeychainStore.read("portalDevice")
        if !existing.isEmpty { return existing }
        let value = UUID().uuidString; KeychainStore.save(value, account: "portalDevice"); return value
    }
    override func viewDidLoad() {
        super.viewDidLoad(); title = demoPayload == nil ? "西浦码" : "演示二维码"; view.backgroundColor = .systemGroupedBackground
        let scroll = UIScrollView(); scroll.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(scroll)
        NSLayoutConstraint.activate([scroll.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),scroll.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),scroll.leadingAnchor.constraint(equalTo:view.leadingAnchor),scroll.trailingAnchor.constraint(equalTo:view.trailingAnchor)])
        stack.axis = .vertical; stack.spacing = 16; stack.translatesAutoresizingMaskIntoConstraints = false; scroll.addSubview(stack)
        NSLayoutConstraint.activate([stack.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor,constant:22),stack.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor,constant:-22),stack.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor,constant:22),stack.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor,constant:-22),stack.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor,constant:-44)])
        for panel in [loginPanel,codePanel] { panel.axis = .vertical; panel.spacing = 14; stack.addArrangedSubview(panel) }
        for panel in [loginPanel,codePanel] { panel.isLayoutMarginsRelativeArrangement = true; panel.layoutMargins = UIEdgeInsets(top:22,left:20,bottom:22,right:20); panel.layer.cornerRadius = 22; panel.backgroundColor = .secondarySystemGroupedBackground }
        codePanel.backgroundColor = .white
        let heading = UILabel(); heading.text = "学校账号登录"; heading.font = .systemFont(ofSize:24,weight:.semibold); loginPanel.addArrangedSubview(heading)
        for (field, placeholder) in [(account,"学校账号，例如 San.Zhang"),(loginCode,"动态登录验证码"),(captchaText,"图片验证码")] { field.placeholder = placeholder; field.borderStyle = .roundedRect; field.autocapitalizationType = .none; field.autocorrectionType = .no; field.heightAnchor.constraint(equalToConstant:48).isActive = true; controls.append(field) }
        let keyboardToolbar = UIToolbar(); keyboardToolbar.sizeToFit()
        keyboardToolbar.items = [UIBarButtonItem(barButtonSystemItem:.flexibleSpace,target:nil,action:nil),UIBarButtonItem(title:"完成",style:.done,target:self,action:#selector(dismissKeyboard))]
        for field in [account,loginCode,captchaText] { field.inputAccessoryView = keyboardToolbar }
        let dismissTap = UITapGestureRecognizer(target:self,action:#selector(dismissKeyboard))
        dismissTap.cancelsTouchesInView = false; dismissTap.delegate = self; view.addGestureRecognizer(dismissTap)
        loginPanel.addArrangedSubview(account); loginPanel.addArrangedSubview(method); controls.append(method); method.addTarget(self,action:#selector(changeMethod),for:.valueChanged)
        loginPanel.addArrangedSubview(loginCode); loginPanel.addArrangedSubview(captchaText)
        captcha.contentMode = .scaleAspectFit; captcha.heightAnchor.constraint(equalToConstant:64).isActive = true; loginPanel.addArrangedSubview(captcha)
        loginPanel.addArrangedSubview(button("换一张",action:#selector(refreshCaptcha)))
        sendButton = button("发送验证码",action:#selector(sendCode)); loginPanel.addArrangedSubview(sendButton)
        let loginButton = button("登录并获取西浦码",action:#selector(login)); loginButton.backgroundColor = UIColor(red:0.09,green:0.18,blue:0.38,alpha:1); loginButton.setTitleColor(.white,for:.normal); loginPanel.addArrangedSubview(loginButton)
        let codeHeading = UILabel(); codeHeading.text = "西浦通行码"; codeHeading.textAlignment = .center; codeHeading.textColor = UIColor(red:0.09,green:0.18,blue:0.38,alpha:1); codeHeading.font = .systemFont(ofSize:22,weight:.semibold); codePanel.addArrangedSubview(codeHeading)
        let holder = UIView(); codePanel.addArrangedSubview(holder)
        qr.translatesAutoresizingMaskIntoConstraints = false; holder.addSubview(qr)
        qr.contentMode = .scaleAspectFit; qr.backgroundColor = .white
        let width = qr.widthAnchor.constraint(equalTo:holder.widthAnchor,constant:-24); width.priority = .defaultHigh
        NSLayoutConstraint.activate([width,qr.widthAnchor.constraint(lessThanOrEqualToConstant:280),qr.centerXAnchor.constraint(equalTo:holder.centerXAnchor),qr.topAnchor.constraint(equalTo:holder.topAnchor,constant:12),qr.bottomAnchor.constraint(equalTo:holder.bottomAnchor,constant:-12),qr.heightAnchor.constraint(equalTo:qr.widthAnchor)])
        countdown.textAlignment = .center; countdown.font = .monospacedDigitSystemFont(ofSize:13,weight:.medium); countdown.textColor = .darkGray; codePanel.addArrangedSubview(countdown)
        progress.progressTintColor = codeHeading.textColor; progress.trackTintColor = UIColor(white:0.92,alpha:1); codePanel.addArrangedSubview(progress)
        let refreshButton = button("刷新",action:#selector(refreshCode)); refreshButton.backgroundColor = UIColor(red:0.92,green:0.95,blue:0.98,alpha:1); refreshButton.setTitleColor(codeHeading.textColor,for:.normal); codePanel.addArrangedSubview(refreshButton)
        logoutButton = button("退出西浦码登录",action:#selector(logout)); logoutButton.backgroundColor = .clear; logoutButton.setTitleColor(.secondaryLabel,for:.normal); stack.addArrangedSubview(logoutButton)
        status.isHidden = true; status.numberOfLines = 0; status.textColor = .secondaryLabel; status.font = .systemFont(ofSize:14); stack.addArrangedSubview(status)
        updatePanels()
        NotificationCenter.default.addObserver(self,selector:#selector(pause),name:UIApplication.didEnterBackgroundNotification,object:nil)
        NotificationCenter.default.addObserver(self,selector:#selector(resume),name:UIApplication.didBecomeActiveNotification,object:nil)
    }
    @objc private func dismissKeyboard() { view.endEditing(true) }
    func gestureRecognizer(_ gestureRecognizer:UIGestureRecognizer,shouldReceive touch:UITouch) -> Bool {
        var touchedView = touch.view
        while let current = touchedView {
            if current is UIControl { return false }
            touchedView = current.superview
        }
        return true
    }
    private func button(_ title:String,action:Selector) -> UIButton { let b = UIButton(type:.system); b.setTitle(title,for:.normal); b.backgroundColor = .secondarySystemGroupedBackground; b.layer.cornerRadius = 14; b.heightAnchor.constraint(equalToConstant:48).isActive = true; b.addTarget(self,action:action,for:.touchUpInside); controls.append(b); return b }
    override func viewWillAppear(_ animated:Bool) { super.viewWillAppear(animated); navigationController?.setNavigationBarHidden(false,animated:false) }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated)
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-xipu-layout") {
            loginPanel.isHidden = true; codePanel.isHidden = false; logoutButton.isHidden = false
            qr.image = UIImage(systemName:"qrcode"); qr.tintColor = .black
            countdown.text = "布局预览 · 非通行码"; progress.progress = 0.65
            return
        }
        #endif
        resume()
    }
    override func viewWillDisappear(_ animated:Bool) { super.viewWillDisappear(animated); pause() }
    deinit { timer?.invalidate(); pending?.cancel(); NotificationCenter.default.removeObserver(self); portal.session.invalidateAndCancel() }
    @objc private func pause() { active = false; generation = UUID(); pending?.cancel(); pending = nil; timer?.invalidate(); timer = nil; qr.image = nil; expiry = .distantPast; setBusy(false) }
    @objc private func resume() {
        if let payload=demoPayload { loginPanel.isHidden=true;codePanel.isHidden=false;logoutButton.isHidden=true;let filter=CIFilter.qrCodeGenerator();filter.message=Data(payload.utf8);if let output=filter.outputImage,let image=CIContext().createCGImage(output.transformed(by:CGAffineTransform(scaleX:10,y:10)),from:output.extent.applying(CGAffineTransform(scaleX:10,y:10))) { qr.image=UIImage(cgImage:image) };countdown.text="演示二维码 · 不可用于真实通行";status.text="此二维码只展示操作效果，不包含学校身份或通行权限。";progress.progress=1;return }
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-xipu-layout") { return }
        #endif
        guard viewIfLoaded?.window != nil else { return }; active = true; if token.isEmpty { loadMethods() } else { refreshCode() }; timer?.invalidate(); timer = Timer.scheduledTimer(withTimeInterval:1,repeats:true) { [weak self] _ in self?.tick() }
    }
    private func tick() { let remaining = max(0,Int(ceil(expiry.timeIntervalSinceNow))); progress.setProgress(Float(min(1,Double(remaining)/validityDuration)),animated:false); countdown.text = remaining > 0 ? "\(remaining) 秒后自动更新" : "暂无有效西浦码"; sendButton.setTitle(sendAfter > Date() ? "\(Int(ceil(sendAfter.timeIntervalSinceNow))) 秒" : "发送验证码",for:.normal); sendButton.isEnabled = !busy && sendAfter <= Date(); if !token.isEmpty && remaining == 0 && !busy && expiry != .distantPast { refreshCode() } }
    private func updatePanels() { loginPanel.isHidden = !token.isEmpty; codePanel.isHidden = token.isEmpty; logoutButton.isHidden = token.isEmpty }
    private func setBusy(_ value:Bool) { busy = value; controls.forEach { $0.isEnabled = !value }; sendButton?.isEnabled = !value && sendAfter <= Date() }
    private func run(_ operation:@escaping () async throws -> Void) { guard !busy, active else { return }; generation = UUID(); let id = generation; setBusy(true); pending = Task { @MainActor in do { try await operation() } catch { if !Task.isCancelled && generation == id { if case PortalError.expired = error { token = ""; KeychainStore.save("",account:"portalToken"); updatePanels(); status.text = "学校登录已过期，请重新登录。" } else { status.text = "学校服务未完成请求，请核对信息后重试。" } } }; if generation == id { setBusy(false) } } }
    private func request(_ path:String,method:String = "GET",body:[String:String]? = nil,auth:String = "") async throws -> [String:Any] {
        let url = URL(string:"https://portalapp.xjtlu.edu.cn/edu-app/" + path)!
        var request = URLRequest(url:url); request.httpMethod = method; request.setValue("application/json;charset=utf-8",forHTTPHeaderField:"Content-Type")
        if !auth.isEmpty { request.setValue(auth,forHTTPHeaderField:"Authorization") }; if let body { request.httpBody = try JSONSerialization.data(withJSONObject:body) }
        let (data,response) = try await portal.session.data(for:request); try Task.checkCancellation()
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        if !auth.isEmpty && [401,403].contains(code) { throw PortalError.expired }
        guard code == 200, data.count <= 2*1024*1024, let result = try JSONSerialization.jsonObject(with:data) as? [String:Any] else { throw PortalError.invalid }
        if !auth.isEmpty && ([401,403].contains(result["status"] as? Int ?? 0) || [401,403].contains(result["code"] as? Int ?? 0)) { throw PortalError.expired }; return result
    }
    private func loadMethods() { run { let response = try await self.request("api/authentication/loginTypeList"); guard let flags = response["data"] as? [String:Any] else { throw PortalError.invalid }; self.types = [("Otp","otp"),("Sms","sms"),("Email","email")].filter { type,key in String(describing: flags[key] ?? (key == "otp" ? flags["opt"] ?? "0" : "0")) != "1" }.map(\.0); self.method.removeAllSegments(); for (index,type) in self.types.enumerated() { self.method.insertSegment(withTitle:["Otp":"OTP","Sms":"短信","Email":"邮箱"][type],at:index,animated:false) }; self.method.selectedSegmentIndex = self.types.isEmpty ? UISegmentedControl.noSegment : 0; self.sendButton.isHidden = self.types.first == "Otp"; try await self.fetchCaptcha() } }
    private func fetchCaptcha() async throws { captchaKey = ""; captchaText.text = ""; captcha.image = nil; let response = try await request("api/authentication/getCaptcha"); guard response["success"] as? Bool == true, let data = response["data"] as? [String:Any], let key = data["captchaKey"] as? String, let base = data["imageBase"] as? String, let bytes = Data(base64Encoded:String(base.split(separator:",").last ?? ""),options:.ignoreUnknownCharacters), let image = UIImage(data:bytes) else { throw PortalError.invalid }; captchaKey = key; captcha.image = image }
    @objc private func refreshCaptcha() { run { try await self.fetchCaptcha() } }
    @objc private func changeMethod() { loginCode.text = ""; sendButton.isHidden = selectedType == "Otp"; refreshCaptcha() }
    private var selectedType:String { types.indices.contains(method.selectedSegmentIndex) ? types[method.selectedSegmentIndex] : "" }
    @objc private func sendCode() { guard sendAfter <= Date(), ["Sms","Email"].contains(selectedType), let name = account.text, !name.isEmpty, let imageCode = captchaText.text, !imageCode.isEmpty, !captchaKey.isEmpty else { status.text = "请先填写账号和图片验证码。"; return }; let type = selectedType; var components = URLComponents(); components.queryItems = [URLQueryItem(name:"username",value:name),URLQueryItem(name:"captchaKey",value:captchaKey),URLQueryItem(name:"code",value:imageCode)]; run { let response = try await self.request("api/authentication/send-\(type == "Sms" ? "sms" : "email")?" + (components.percentEncodedQuery ?? ""),method:"POST"); if response["success"] as? Bool == true { self.sendAfter = Date().addingTimeInterval(60); self.status.text = "验证码已发送，请填写验证码和更新后的图片验证码。" } else { self.status.text = "发送失败，请核对账号和图片验证码。" }; try await self.fetchCaptcha() } }
    @objc private func login() { guard let name = account.text, !name.isEmpty, let code = loginCode.text, !code.isEmpty, let imageCode = captchaText.text, !imageCode.isEmpty, !captchaKey.isEmpty, !selectedType.isEmpty else { status.text = "请填写账号、动态登录验证码和图片验证码。"; return }; let type = selectedType; let body = ["username":name,"equipNo":deviceID,"mobileSystem":"ios","captchaKey":captchaKey,"code":imageCode,"loginCode":code]; run { let response = try await self.request("api/authentication/loginBy" + type,method:"POST",body:body); guard response["success"] as? Bool == true, let data = response["data"] as? [String:Any], let token = data["token"] as? String, !token.isEmpty else { self.status.text = "学校未接受本次登录，请核对动态验证码和图片验证码。"; try await self.fetchCaptcha(); return }; self.token = token; let stored = KeychainStore.save(token,account:"portalToken"); self.loginCode.text = ""; self.captchaText.text = ""; self.updatePanels(); self.status.text = stored ? "已登录，正在获取西浦码。" : "已登录，但登录状态未保存。"; try await self.fetchCode() } }
    @objc private func refreshCode() { if demoPayload != nil { resume(); return }; run { try await self.fetchCode() } }
    private func fetchCode() async throws { qr.image = nil; expiry = .distantPast; let auth = token; let timing = try await request("SchedulerTime/getSchedulerTime",auth:auth); let response = try await request("qrcodeConfig/xjCode",auth:auth); guard active, token == auth, response["success"] as? Bool == true, let content = response["data"] as? String, (16...4096).contains(content.count), !["placeholder","mock","undefined"].contains(where:content.lowercased().contains) else { throw PortalError.invalid }; let filter = CIFilter.qrCodeGenerator(); filter.message = Data(content.utf8); filter.correctionLevel = "M"; guard let output = filter.outputImage, let image = CIContext().createCGImage(output.transformed(by:CGAffineTransform(scaleX:8,y:8)),from:output.extent.applying(CGAffineTransform(scaleX:8,y:8))) else { throw PortalError.invalid }; qr.image = UIImage(cgImage:image); let seconds = timing["data"] as? Int ?? 60; expiry = Date().addingTimeInterval(TimeInterval((10...3600).contains(seconds) ? seconds : 60)); validityDuration = expiry.timeIntervalSinceNow; tick(); status.text = nil }
    @objc private func logout() { generation = UUID(); pending?.cancel(); token = ""; KeychainStore.save("",account:"portalToken"); qr.image = nil; expiry = .distantPast; updatePanels(); setBusy(false); loadMethods() }
}
