import UIKit
import WebKit
import CoreImage.CIFilterBuiltins

private final class HhtMessageHandler: NSObject, WKScriptMessageHandler {
    weak var controller:HhtController?
    init(_ controller:HhtController) { self.controller = controller }
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage) { controller?.receive(message) }
}

final class HhtController: UIViewController, WKNavigationDelegate {
    private let reviewDemo:Bool
    init(reviewDemo:Bool = false) { self.reviewDemo = reviewDemo; super.init(nibName:nil,bundle:nil) }
    required init?(coder:NSCoder) { fatalError() }
    private let service = HhtService()
    private var web:WKWebView!
    private var binding = HhtBinding.empty
    private var active = false, busy = false
    private var showingPass = false, showingTutorial = false
    private var generation = UUID()
    private var pending:Task<Void,Never>?
    private var timer:Timer?
    #if DEBUG
    private var previewBridge:InterfaceTestBridge?
    private var designPreview:Bool { ProcessInfo.processInfo.arguments.contains("--test-hht") }
    #else
    private var designPreview:Bool { false }
    #endif
    private var directory:URL? { Bundle.main.url(forResource:"hht",withExtension:nil,subdirectory:"Assets") }
    private var passPage:Bool { web?.url?.standardizedFileURL == directory?.appendingPathComponent("hht.html").standardizedFileURL }
    override func viewDidLoad() {
        super.viewDidLoad(); title = reviewDemo ? "宿舍通行码 · 演示" : "宿舍通行码"
        if !reviewDemo,!designPreview,let data = KeychainStore.read("hhtBinding").data(using:.utf8),let saved = try? JSONDecoder().decode(HhtBinding.self,from:data) { binding = saved }
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        config.userContentController.add(HhtMessageHandler(self),name:"hht")
        web = WKWebView(frame:.zero,configuration:config); web.navigationDelegate = self; web.allowsBackForwardNavigationGestures = false; web.scrollView.contentInsetAdjustmentBehavior = .never
        web.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(web)
        NSLayoutConstraint.activate([web.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),web.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),web.leadingAnchor.constraint(equalTo:view.leadingAnchor),web.trailingAnchor.constraint(equalTo:view.trailingAnchor)])
        NotificationCenter.default.addObserver(self,selector:#selector(resume),name:UIApplication.didBecomeActiveNotification,object:nil)
        NotificationCenter.default.addObserver(self,selector:#selector(suspend),name:UIApplication.willResignActiveNotification,object:nil)
        guard let directory else { return }
        web.loadFileURL(directory.appendingPathComponent("hht.html"),allowingReadAccessTo:directory)
        #if DEBUG
        if designPreview || (reviewDemo && ProcessInfo.processInfo.arguments.contains("--test-interface")) {
            previewBridge = InterfaceTestBridge { [weak self] command in
                guard let self,let directory = self.directory else { return }
                if command == "hhtTutorial" { self.web.loadFileURL(directory.appendingPathComponent("tutorial.html"),allowingReadAccessTo:directory) }
                if command == "hhtBack" { self.web.loadFileURL(directory.appendingPathComponent("hht.html"),allowingReadAccessTo:directory) }
                if command == "hhtShowCode",self.designPreview { self.binding = HhtBinding(mode:"token",openid:"",token:"AMS-DEMO-NOT-A-CREDENTIAL"); self.fetch() }
                if command == "hhtRefresh",self.designPreview { self.web.evaluateJavaScript("document.getElementById('refresh')?.click()",completionHandler:nil) }
                if command == "hhtMoreChange",self.designPreview { self.performBindingAction("change") }
                if command == "hhtMoreClear",self.designPreview { self.performBindingAction("unbind") }
                if command == "hhtConfirmUnbind",self.designPreview { self.confirmPreviewUnbind() }
                if command == "hhtSuspend" { NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil) }
                if command == "hhtResume" { NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil) }
                if command == "hhtAudit" { self.writePreviewAudit() }
                if command == "hhtBind",self.reviewDemo { self.web.evaluateJavaScript("document.getElementById('bind')?.click()",completionHandler:nil) }
                if command == "hhtExit",self.reviewDemo || self.designPreview { self.navigationController?.popViewController(animated:false) }
            }
        }
        #endif
    }
    override func viewWillAppear(_ animated:Bool) { super.viewWillAppear(animated); navigationController?.setNavigationBarHidden(false,animated:animated); updateNavigationItems(); applyTheme() }
    override func viewDidAppear(_ animated:Bool) { super.viewDidAppear(animated); resume() }
    override func viewWillDisappear(_ animated:Bool) { suspend(); super.viewWillDisappear(animated) }
    deinit { timer?.invalidate(); pending?.cancel(); NotificationCenter.default.removeObserver(self) }
    @objc private func resume() { guard viewIfLoaded?.window != nil,navigationController?.topViewController === self,UIApplication.shared.applicationState == .active else { return }; active = true; applyTheme(); publish() }
    @objc private func suspend() {
        active = false; cancel()
        #if DEBUG
        if designPreview { writePreviewAudit() }
        #endif
    }
    private func cancel() { generation = UUID(); busy = false; timer?.invalidate(); timer = nil; pending?.cancel(); pending = nil; web?.evaluateJavaScript("window.hhtHideCode&&window.hhtHideCode()",completionHandler:nil) }
    private func publish() { guard active,passPage,!busy else { return }; event(["kind":"session","bound":!binding.token.isEmpty]); if !binding.token.isEmpty { fetch() } }
    private func event(_ value:[String:Any]) { guard active,passPage,let data = try? JSONSerialization.data(withJSONObject:value),let text = String(data:data,encoding:.utf8) else { return }; web.evaluateJavaScript("window.hhtResult&&window.hhtResult(\(text))",completionHandler:nil) }
    private func failure(_ error:Error) {
        let text:String, expired:Bool
        switch error {
        case HhtFailure.expired: text = "登录凭证已失效，请重新获取后绑定。"; expired = true
        case HhtFailure.service(let message): text = message; expired = false
        default: text = "暂时无法获取二维码，请检查网络后重试。"; expired = false
        }
        event(["kind":"error","message":text,"expired":expired])
    }
    private func fetch(_ imported:HhtBinding? = nil) {
        guard active,passPage,!busy,imported != nil || !binding.token.isEmpty else { return }
        timer?.invalidate(); timer = nil; busy = true; generation = UUID()
        let revision = generation, saved = binding, input = imported ?? binding
        event(["kind":"loading","binding":imported != nil])
        if reviewDemo {
            binding = HhtBinding(mode:input.mode,openid:"",token:"DEMO-NOT-A-CREDENTIAL")
            busy = false
            if let image = qr("AMS-DEMO-NOT-VALID:HHT:"+UUID().uuidString) { event(["kind":"code","image":image,"name":"演示学生 · 不可通行","updated":Date().timeIntervalSince1970 * 1000]) }
            timer = Timer.scheduledTimer(withTimeInterval:8,repeats:false) { [weak self] _ in self?.fetch() }
            return
        }
        if designPreview {
            binding = HhtBinding(mode:input.mode,openid:"",token:"AMS-DEMO-NOT-A-CREDENTIAL")
            busy = false
            if let image = qr("AMS-DEMO-NOT-VALID:HHT:"+UUID().uuidString) { event(["kind":"code","image":image,"name":"演示学生 · 不可通行","updated":Date().timeIntervalSince1970 * 1000]) }
            timer = Timer.scheduledTimer(withTimeInterval:8,repeats:false) { [weak self] _ in self?.fetch() }
            return
        }
        pending = Task { [weak self, service] in
            do {
                let (next,data) = try await service.code(for:input)
                try Task.checkCancellation()
                guard let self,self.active,self.passPage,self.generation == revision else { return }
                guard let raw = data["qrCode"] as? String, let image = self.qr(raw) else { throw HhtFailure.invalid }
                if imported != nil || next.token != saved.token {
                    guard let encoded = try? JSONEncoder().encode(next),let text = String(data:encoded,encoding:.utf8),KeychainStore.save(text,account:"hhtBinding") else { throw HhtFailure.service("无法加密保存绑定信息，请重试。") }
                }
                self.binding = next; self.busy = false; self.pending = nil
                self.event(["kind":"code","image":image,"name":data["name"] as? String ?? "","updated":Date().timeIntervalSince1970 * 1000])
                self.timer = Timer.scheduledTimer(withTimeInterval:8,repeats:false) { [weak self] _ in self?.fetch() }
            } catch {
                guard let self,self.active,self.passPage,self.generation == revision else { return }
                self.busy = false; self.pending = nil; self.failure(error)
            }
        }
    }
    private func qr(_ raw:String) -> String? {
        let filter = CIFilter.qrCodeGenerator(); filter.message = Data(raw.utf8); filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let extent = output.extent.insetBy(dx:-4,dy:-4)
        let padded = output.composited(over:CIImage(color:.white).cropped(to:extent))
        let scale = max(1,floor(720 / extent.width)), transform = CGAffineTransform(scaleX:scale,y:scale)
        guard let image = CIContext().createCGImage(padded.transformed(by:transform),from:extent.applying(transform)) else { return nil }
        return UIImage(cgImage:image).pngData()?.base64EncodedString()
    }
    private func applyTheme() {
        let mode = UserDefaults.standard.string(forKey:"appearance") ?? "system"
        overrideUserInterfaceStyle = mode == "dark" ? .dark : mode == "light" ? .light : .unspecified
        let dark = traitCollection.userInterfaceStyle == .dark, key = UserDefaults.standard.string(forKey:"theme") ?? "blue"
        let colors = CampusPalette.colors[key] ?? CampusPalette.colors["blue"]!
        let palette = CampusPalette(key:key,dark:dark); view.backgroundColor = palette.paper; web?.backgroundColor = palette.paper
        func hex(_ value:UInt32) -> String { String(format:"#%06x",value) }
        func mix(_ a:UInt32,_ b:UInt32,_ amount:Double) -> UInt32 { [16,8,0].reduce(UInt32(0)) { out,shift in out | (UInt32((Double((a >> shift)&255)*(1-amount)+Double((b >> shift)&255)*amount).rounded()) << shift) } }
        let value:[String:Any] = ["dark":dark,"accent":hex(dark ? mix(colors[1],0xFFFFFF,0.55) : colors[1]),"wash":hex(dark ? mix(0x202630,colors[0],0.30) : colors[2]),"bg":hex(dark ? 0x15191F : 0xF5F6F8),"surface":hex(dark ? 0x202630 : 0xFCFDFE),"ink":hex(dark ? 0xE7ECF4 : 0x17233A),"muted":hex(dark ? 0xA4AFBF : 0x69758A),"line":hex(dark ? 0x343D49 : 0xE2E8F0)]
        if let data = try? JSONSerialization.data(withJSONObject:value),let text = String(data:data,encoding:.utf8) { web?.evaluateJavaScript("window.hhtTheme&&window.hhtTheme(\(text))",completionHandler:nil) }
    }
    override func traitCollectionDidChange(_ previousTraitCollection:UITraitCollection?) { super.traitCollectionDidChange(previousTraitCollection); if isViewLoaded { applyTheme() } }
    private func updateNavigationItems() {
        if showingTutorial {
            let back = UIBarButtonItem(image:UIImage(systemName:"chevron.left"),style:.plain,target:self,action:#selector(returnToCode))
            back.accessibilityLabel = "返回宿舍通行码"
            navigationItem.leftBarButtonItem = back
            navigationItem.rightBarButtonItem = nil
            return
        }
        navigationItem.leftBarButtonItem = nil
        guard showingPass,!binding.token.isEmpty else { navigationItem.rightBarButtonItem = nil; return }
        let change = UIAction(title:"更换绑定") { [weak self] _ in self?.performBindingAction("change") }
        let clear = UIAction(title:"清除本机绑定",attributes:.destructive) { [weak self] _ in self?.performBindingAction("unbind") }
        let more = UIBarButtonItem(image:UIImage(systemName:"ellipsis"),style:.plain,target:nil,action:nil)
        more.accessibilityLabel = "绑定管理"
        more.menu = UIMenu(title:"绑定管理",children:[change,clear])
        navigationItem.rightBarButtonItem = more
    }
    private func performBindingAction(_ control:String) {
        guard ["change","unbind"].contains(control),passPage else { return }
        web.evaluateJavaScript("document.getElementById('"+control+"')?.click()",completionHandler:nil)
    }
    @objc private func returnToCode() {
        guard showingTutorial,let directory else { return }
        web.loadFileURL(directory.appendingPathComponent("hht.html"),allowingReadAccessTo:directory)
    }
    private func clearBinding() {
        cancel()
        if reviewDemo || designPreview || (KeychainStore.save("",account:"hhtBinding") && KeychainStore.read("hhtBinding").isEmpty) {
            binding = .empty
            publish()
        } else { failure(HhtFailure.service("本机清除失败，请重试。")) }
    }
    #if DEBUG
    private func confirmPreviewUnbind() {
        guard designPreview,let alert = presentedViewController as? UIAlertController,alert.title == "清除本机绑定" else { return }
        alert.dismiss(animated:false) { [weak self] in self?.clearBinding() }
    }
    private func writePreviewAudit() {
        guard designPreview else { return }
        let script = "(() => { const header=document.querySelector('main>header'),img=document.getElementById('qrImage'),src=img?.src||''; const qrFingerprint=src.split('').reduce((hash,char)=>(Math.imul(hash,31)+char.charCodeAt(0))|0,0); return { pageTitle:document.getElementById('pageTitle')?.textContent, innerHeaderDisplay:header?getComputedStyle(header).display:'missing', qrVisible:!!img&&!img.hidden, qrWidth:img?.getBoundingClientRect().width||0, qrHeight:img?.getBoundingClientRect().height||0, qrFingerprint, updated:document.getElementById('updated')?.textContent, status:document.getElementById('status')?.textContent, pageHeight:document.documentElement.scrollHeight, viewportHeight:document.documentElement.clientHeight }; })()"
        web.evaluateJavaScript(script) { [weak self] value,error in
            guard let self,error == nil,let folder = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first else { return }
            var result = value as? [String:Any] ?? [:]
            let nav = self.navigationController
            result["nativeTitle"] = self.title ?? ""
            result["navigationBarHidden"] = nav?.isNavigationBarHidden ?? true
            result["nativeBackAvailable"] = (nav?.viewControllers.count ?? 0) > 1
            result["edgeBackEnabled"] = nav?.interactivePopGestureRecognizer?.isEnabled ?? false
            result["stackDepth"] = nav?.viewControllers.count ?? 0
            result["nativeMoreVisible"] = self.navigationItem.rightBarButtonItem != nil
            result["nativeMoreActions"] = self.navigationItem.rightBarButtonItem?.menu?.children.compactMap { ($0 as? UIAction)?.title } ?? []
            result["active"] = self.active
            result["timerActive"] = self.timer != nil
            if JSONSerialization.isValidJSONObject(result),let data = try? JSONSerialization.data(withJSONObject:result) { try? data.write(to:folder.appendingPathComponent("hht-ui-audit.json"),options:.atomic) }
        }
    }
    #endif
    fileprivate func receive(_ message:WKScriptMessage) {
        guard active,passPage,message.webView === web,message.frameInfo.isMainFrame,message.frameInfo.request.url?.standardizedFileURL == web.url?.standardizedFileURL,let data = message.body as? [String:String],let action = data["action"] else { return }
        switch action {
        case "ready": applyTheme(); publish()
        case "navigation":
            title = data["title"] ?? "宿舍通行码"
            showingPass = data["management"] == "1"
            showingTutorial = false
            updateNavigationItems()
        case "close": navigationController?.popViewController(animated:true)
        case "refresh": fetch()
        case "edit": cancel()
        case "bind":
            guard let mode = data["mode"],["openid","token"].contains(mode),let input = data["credential"] else { return }
            let value = input.trimmingCharacters(in:.whitespacesAndNewlines)
            guard !value.isEmpty,value.utf16.count <= 4096,!value.contains(where:{$0.isWhitespace}) else { failure(HhtFailure.service("请粘贴完整凭证，不要带空格、参数名或换行。")); return }
            fetch(HhtBinding(mode:mode,openid:mode == "openid" ? value : "",token:mode == "token" ? value : ""))
        case "unbind":
            let alert = UIAlertController(title:"清除本机绑定",message:"清除本机慧湖通绑定？这不会解除学校系统中的账号绑定。",preferredStyle:.alert)
            alert.addAction(UIAlertAction(title:"取消",style:.cancel))
            alert.addAction(UIAlertAction(title:"清除",style:.destructive) { [weak self] _ in self?.clearBinding() })
            present(alert,animated:true)
        default: break
        }
    }
    func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url,let directory else { decisionHandler(.cancel); return }
        let local = ["hht.html","tutorial.html","assets/options.png","assets/https.png","assets/capture.png","assets/credentials.png","assets/mac_p1.png","assets/mac_p2.png","assets/mac_p3.png","assets/mac_p4.png","assets/mac_p5.png","assets/mac_p6.png","assets/mac_p7.png"].contains { directory.appendingPathComponent($0).standardizedFileURL == url.standardizedFileURL }
        if local {
            if action.targetFrame == nil { web.loadFileURL(url,allowingReadAccessTo:directory); decisionHandler(.cancel) } else { decisionHandler(.allow) }
            return
        }
        if url.scheme == "https",let host=url.host,["www.telerik.com","proxyman.com"].contains(host) { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView:WKWebView,didStartProvisionalNavigation navigation:WKNavigation!) { cancel(); if webView === web { showingPass = false; updateNavigationItems() } }
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!) {
        applyTheme(); publish()
        if webView === web,let url = webView.url {
            showingTutorial = url.standardizedFileURL == directory?.appendingPathComponent("tutorial.html").standardizedFileURL
            if showingTutorial { title = "慧湖通绑定教程"; showingPass = false }
            else if passPage { title = reviewDemo ? "宿舍通行码 · 演示" : "宿舍通行码" }
            updateNavigationItems()
        }
        if reviewDemo,passPage { web.evaluateJavaScript("(()=>{const note=document.createElement('p');note.textContent='演示环境 · 请输入 DEMO 体验绑定。凭证不保存、不连接慧湖通，二维码不可通行。';note.style.cssText='padding:16px;color:var(--muted)';document.body.prepend(note);const input=document.getElementById('credential');if(input)input.value='DEMO';})()",completionHandler:nil) }
        #if DEBUG
        if designPreview {
            web.evaluateJavaScript("({ready:document.readyState,bridge:typeof window.HhtBridge,images:Array.from(document.images).filter(i=>i.getAttribute('src')).map(i=>({loaded:i.complete&&i.naturalWidth>0})),bindingVisible:!document.getElementById('binding')?.hidden})") { value,error in
                guard error == nil,let value,let folder = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first,let data = try? JSONSerialization.data(withJSONObject:value) else { return }
                try? data.write(to:folder.appendingPathComponent("hht-preview-audit.json"))
            }
        }
        #endif
    }
}
