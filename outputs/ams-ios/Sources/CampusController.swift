import UIKit
import WebKit

// Demonstration traffic uses a separate API session; its cookie never reaches school WebViews.
private final class ReviewTransport: NSObject, URLSessionTaskDelegate {
    private let bootstrap:URLRequest
    private lazy var session=URLSession(configuration:.ephemeral,delegate:self,delegateQueue:nil)
    init(_ request:URLRequest) { bootstrap=request }
    func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping (URLRequest?)->Void) { completionHandler(nil) }
    func start()async throws { var request=bootstrap;request.setValue("application/json",forHTTPHeaderField:"Accept");let (_,response)=try await session.data(for:request);guard (response as? HTTPURLResponse)?.statusCode==200 else { throw URLError(.badServerResponse) } }
    func request(_ path:String,_ value:[String:Any]?)async throws -> (Int,[String:Any]) {
        guard ["state","action","reminder"].contains(path) else { throw URLError(.unsupportedURL) }
        let base=bootstrap.url!.deletingLastPathComponent();var request=URLRequest(url:base.appendingPathComponent(path));request.timeoutInterval=20;request.setValue("application/json",forHTTPHeaderField:"Accept")
        if let value { request.httpMethod="POST";request.setValue("application/json",forHTTPHeaderField:"Content-Type");request.setValue("1",forHTTPHeaderField:"X-AMS-Demo");let origin=URLComponents(url:bootstrap.url!,resolvingAgainstBaseURL:false)!;request.setValue("https://"+origin.host!,forHTTPHeaderField:"Origin");request.httpBody=try JSONSerialization.data(withJSONObject:value);guard request.httpBody!.count<=1500000 else { throw URLError(.dataLengthExceedsMaximum) } }
        let (data,response)=try await session.data(for:request);guard data.count<=4000000,let value=try JSONSerialization.jsonObject(with:data) as? [String:Any] else { throw URLError(.cannotParseResponse) };return ((response as? HTTPURLResponse)?.statusCode ?? 0,value)
    }
    func close() { session.invalidateAndCancel() }
    deinit { session.invalidateAndCancel() }
}

private final class ReadinessHandler: NSObject, WKScriptMessageHandler {
    weak var owner: CampusController?
    init(_ owner:CampusController) { self.owner = owner }
    func userContentController(_ controller:WKUserContentController, didReceive message:WKScriptMessage) {
        if message.name == "amsReviewAction" { owner?.reviewAction(message); return }
        if message.name == "amsReviewAPI" { owner?.reviewAPI(message); return }
        #if DEBUG
        if message.name == "amsReviewDebug" { owner?.reviewDebug(message.body);return }
        #endif
        if message.name == "amsAuthExternal" { owner?.authExternal(message); return }
        if message.name == "amsModal" { owner?.modalChanged(message); return }
        if message.name == "amsSession" { owner?.saveSession(message); return }
        if message.name == "reservationSession" { owner?.saveReservationSession(message); return }
        if message.name == "amsChromeAction" { owner?.chromeAction(message); return }
        if message.name == "amsChrome" { owner?.pageChrome(message) } else { owner?.pageReady(message) }
    }
}

final class CampusController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var web: WKWebView!
    private let initialURL: URL
    private let reviewRequest: URLRequest?
    private var reviewTransport:ReviewTransport?
    private var isReview:Bool { reviewRequest != nil }
    private var mainCampus:Bool { isReview || initialURL.host == "ams.xjtlu.edu.cn" }
    private let service = AppService()
    private var pendingPublicConfig:PublicConfig?
    private let loading = UIStackView()
    private let loadingText = UILabel()
    private let loadingSpinner = UIActivityIndicatorView(style:.medium)
    private let retry = UIButton(type:.system)
    private var loadingTimeout: DispatchWorkItem?
    private var loadingAttempt = 0
    private var loadingHost = ""
    private var mainTop: NSLayoutConstraint?
    private var mainBottom: NSLayoutConstraint?
    private var tabsVisible = false
    private var selectedTab = 0
    private var systemTabs: CampusTabController? { tabBarController as? CampusTabController }
    private var isCurrentPage: Bool { navigationController?.topViewController === self || (systemTabs != nil && navigationController?.topViewController === systemTabs) }
    private var originalHeader: WKWebView?
    private let headerMask = UIView()
    private var modalOpen = false
    private var originalHeaderHeight: NSLayoutConstraint?
    private var headerHeight: CGFloat = 100
    private var chromeVariables = ""
    private var chromePayload = ""
    private var chromeNeedsReload = false
    private var chromeGeneration = 0
    private var chromeSyncSequence = 0
    private var rootChrome: Bool { mainReady && ["/home","/course","/leave","/reservations"].contains(chromeRoute) }
    private enum LoadingState { case waiting, ready, failed }
    private var loadingState = LoadingState.ready
    private let preloader = ReservationPreloader()
    private var preparationResult: ((String) -> Void)?
    var reservationStateChanged: ((String)->Void)?
    private(set) var isPreparingOffscreen = false
    private var mainReady = false
    private var chromeRoute = "/home"
    private var lastInsets = ""
    private var hasBeenPresented = false
    private let recordsSwitch = UISegmentedControl(items:["座位","讨论室"])
    private var restoringRecords = false
    private var reservationSession = ""
    private var reservationSessionHost = ""
    private static let reservationHosts = ["seatbookings.xjtlu.edu.cn","roombookings.xjtlu.edu.cn"]
    #if DEBUG
    private var interfaceTest: InterfaceTestBridge?
    private var reviewEvents:[[String:Any]]=[]
    fileprivate func reviewDebug(_ value:Any) { guard isReview,let event=value as? [String:Any] else { return };reviewEvents.append(event);if let directory=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first,let data=try? JSONSerialization.data(withJSONObject:reviewEvents) { try? data.write(to:directory.appendingPathComponent("review-events.json")) } }
    #endif
    private let schoolHosts: Set<String> = ["ams.xjtlu.edu.cn", "uim.xjtlu.edu.cn", "seatbookings.xjtlu.edu.cn", "roombookings.xjtlu.edu.cn", "shuttlebus.xjtlu.edu.cn", "portalapp.xjtlu.edu.cn", "gsrb.xjtlu.edu.cn"]
    private var appearanceMode:String {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-design"),ProcessInfo.processInfo.arguments.contains("--test-dark") { return "dark" }
        #endif
        return UserDefaults.standard.string(forKey:"appearance") ?? "system"
    }
    init(url: URL = URL(string: "https://ams.xjtlu.edu.cn/")!, reviewRequest:URLRequest? = nil) {
        self.reviewRequest = reviewRequest
        if let request = reviewRequest { initialURL = request.url!; super.init(nibName:nil,bundle:nil); return }
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-auth-login") {
            initialURL = URL(string:"https://uim.xjtlu.edu.cn/esc-sso/login/page")!
            super.init(nibName:nil,bundle:nil); return
        }
        #endif
        initialURL = url.host == "ams.xjtlu.edu.cn" && url.path == "/" && !KeychainStore.read("amsSession").isEmpty ? URL(string:"https://ams.xjtlu.edu.cn/studenth5/#/home")! : url
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let mode = appearanceMode
        overrideUserInterfaceStyle = mode == "dark" ? .dark : mode == "light" ? .light : .unspecified
        let config = WKWebViewConfiguration()
        if isReview { config.websiteDataStore = .nonPersistent(); config.userContentController.add(ReadinessHandler(self),name:"amsReviewAction");config.userContentController.add(ReadinessHandler(self),name:"amsReviewAPI") }
        #if DEBUG
        if isReview,ProcessInfo.processInfo.arguments.contains("--test-interface") { config.userContentController.add(ReadinessHandler(self),name:"amsReviewDebug");config.userContentController.addUserScript(WKUserScript(source:"const report=(type,value)=>window.webkit.messageHandlers.amsReviewDebug.postMessage({type,url:location.href,value});window.addEventListener('error',e=>report('error',e.message));window.addEventListener('securitypolicyviolation',e=>report('csp',e.violatedDirective+':'+e.blockedURI));window.addEventListener('load',()=>report('load',typeof window.__amsReviewResponse+':'+!!document.querySelector('.app')));",injectionTime:.atDocumentStart,forMainFrameOnly:false)) }
        #endif
        config.websiteDataStore = .default()
        if Self.reservationHosts.contains(initialURL.host ?? "") {
            config.userContentController.add(ReadinessHandler(self),name:"reservationSession")
            installReservationSession(in:config.userContentController)
        }
        if initialURL.host == "ams.xjtlu.edu.cn" {
            config.userContentController.add(ReadinessHandler(self),name:"amsSession")
            installSchoolSession(in:config.userContentController)
        }
        let palette = CampusPalette(key:UserDefaults.standard.string(forKey:"theme") ?? "blue",dark:traitCollection.userInterfaceStyle == .dark)
        let themeScript = "if(location.hostname==='ams.xjtlu.edu.cn'||location.hostname.endsWith('.xjtlu.edu.cn')){window.__amsNativeDark=\(palette.dark);" + palette.script + "}"
        config.userContentController.addUserScript(WKUserScript(source:themeScript,injectionTime:.atDocumentStart,forMainFrameOnly:true))
        config.userContentController.add(ReadinessHandler(self),name:"amsReady")
        config.userContentController.add(ReadinessHandler(self),name:"amsAuthExternal")
        config.userContentController.add(ReadinessHandler(self),name:"amsChrome")
        config.userContentController.add(ReadinessHandler(self),name:"amsModal")
        config.userContentController.addUserScript(WKUserScript(source:AppService.dailyScript,injectionTime:.atDocumentStart,forMainFrameOnly:true))
        for name in ["ios-readiness", "ios-loading-diagnostics", "ios-auth-theme", "ios-auth-recovery", "ios-bootstrap", "ams-modern-ui", "ams-scan-entry", "ams-submit-scan", "ios-scan-payload", "library-seat-ui", "library-room-ui", "reservation-records-ui"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "js", subdirectory: "Assets"), let text = try? String(contentsOf: url, encoding: .utf8) {
                config.userContentController.addUserScript(WKUserScript(source: text, injectionTime: name.hasPrefix("ios-") ? .atDocumentStart : .atDocumentEnd, forMainFrameOnly: true))
            }
        }
        web = WKWebView(frame: .zero, configuration: config)
        if ["seatbookings.xjtlu.edu.cn", "roombookings.xjtlu.edu.cn"].contains(initialURL.host ?? "") {
            web.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
            title = initialURL.fragment?.contains("userinfo") == true ? "我的预约" : initialURL.host == "seatbookings.xjtlu.edu.cn" ? "图书馆座位" : "讨论室预约"
            if initialURL.fragment?.contains("userinfo") == true {
                recordsSwitch.selectedSegmentIndex = initialURL.host == "seatbookings.xjtlu.edu.cn" ? 0 : 1
                recordsSwitch.addTarget(self,action:#selector(switchRecords),for:.valueChanged)
            }
        }
        if initialURL.host == "gsrb.xjtlu.edu.cn" { title = "FB 讨论室（SIP）" }
        web.navigationDelegate = self; web.uiDelegate = self
        web.translatesAutoresizingMaskIntoConstraints = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        // Match Android's final separation: the tab bar is not part of scrolling web content.
        // School authentication remains in WebKit history. Never expose it as app navigation.
        web.allowsBackForwardNavigationGestures = false
        if mainCampus {
            let backGesture = UIScreenEdgePanGestureRecognizer(target:self,action:#selector(handleAppBack(_:)))
            backGesture.edges = .left
            web.addGestureRecognizer(backGesture)
        }
        view.addSubview(web)
        let main = mainCampus
        let records = initialURL.fragment?.contains("userinfo") == true
        if records {
            recordsSwitch.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(recordsSwitch)
            NSLayoutConstraint.activate([recordsSwitch.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor,constant:8),recordsSwitch.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:22),recordsSwitch.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-22),recordsSwitch.heightAnchor.constraint(equalToConstant:32)])
        }
        let top = records ? web.topAnchor.constraint(equalTo:recordsSwitch.bottomAnchor,constant:8) : web.topAnchor.constraint(equalTo: main ? view.topAnchor : view.safeAreaLayoutGuide.topAnchor)
        let bottom = web.bottomAnchor.constraint(equalTo: main ? view.bottomAnchor : view.safeAreaLayoutGuide.bottomAnchor)
        if main { mainTop = top; mainBottom = bottom }
        NSLayoutConstraint.activate([top,bottom,web.leadingAnchor.constraint(equalTo: view.leadingAnchor), web.trailingAnchor.constraint(equalTo: view.trailingAnchor)])
        if main {
            let header = makeChrome("header")
            originalHeader = header; header.isHidden = true; view.addSubview(header)
            let height = header.heightAnchor.constraint(equalToConstant:headerHeight); originalHeaderHeight = height
            NSLayoutConstraint.activate([header.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),header.leadingAnchor.constraint(equalTo:view.leadingAnchor),header.trailingAnchor.constraint(equalTo:view.trailingAnchor),height])
            headerMask.translatesAutoresizingMaskIntoConstraints = false; headerMask.isHidden = true
            headerMask.backgroundColor = UIColor(red:23/255,green:35/255,blue:58/255,alpha:0.4)
            view.addSubview(headerMask)
            NSLayoutConstraint.activate([headerMask.topAnchor.constraint(equalTo:view.topAnchor),headerMask.bottomAnchor.constraint(equalTo:header.bottomAnchor),headerMask.leadingAnchor.constraint(equalTo:view.leadingAnchor),headerMask.trailingAnchor.constraint(equalTo:view.trailingAnchor)])
        }
        loading.axis = .vertical; loading.spacing = 14; loading.alignment = .center; loading.translatesAutoresizingMaskIntoConstraints = false
        loadingSpinner.hidesWhenStopped = true; loading.addArrangedSubview(loadingSpinner)
        loadingText.text = loadingTitle(web?.url ?? initialURL); loadingText.numberOfLines = 0; loadingText.textAlignment = .center; loading.addArrangedSubview(loadingText)
        retry.setTitle("重新加载",for:.normal); retry.addTarget(self,action:#selector(reload),for:.touchUpInside); retry.isHidden = true; loading.addArrangedSubview(retry)
        view.addSubview(loading); NSLayoutConstraint.activate([loading.centerXAnchor.constraint(equalTo:view.centerXAnchor),loading.centerYAnchor.constraint(equalTo:view.centerYAnchor),loading.widthAnchor.constraint(lessThanOrEqualTo:view.widthAnchor,constant:-44)])
        beginLoading()
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: "刷新", style: .plain, target: self, action: #selector(reload))
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-design"),let preview = Bundle.main.url(forResource:"ios-preview",withExtension:"html",subdirectory:"Assets") { web.loadFileURL(preview,allowingReadAccessTo:preview.deletingLastPathComponent()) } else if ProcessInfo.processInfo.arguments.contains("--test-record-layout"),let preview = Bundle.main.url(forResource:"ios-records-preview",withExtension:"html",subdirectory:"Assets") { web.loadFileURL(preview,allowingReadAccessTo:preview.deletingLastPathComponent()) } else { loadInitialPage() }
        #else
        loadInitialPage()
        #endif

        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (controller: CampusController, previous: UITraitCollection) in controller.applyAppearance() }
        registerForTraitChanges([UITraitPreferredContentSizeCategory.self]) { (controller: CampusController, previous: UITraitCollection) in controller.applyAppearance() }
        NotificationCenter.default.addObserver(self, selector: #selector(resume), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(background), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(publishCourseReminder), name: CourseReminderCenter.stateChanged, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(deviceCheckUpdated), name: ActivationStore.updated, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(consumeShortcut), name: PendingShortcut.changed, object: nil)
        preloader.onChange = { [weak self] _ in self?.publishPreparation() }
        #if DEBUG
        if mainCampus, ProcessInfo.processInfo.arguments.contains("--test-interface") {
            interfaceTest = InterfaceTestBridge { [weak self] command in
                guard let self else { return }
                switch command {
                case "authAudit": self.auditAuthentication("main"); for (key,page) in self.preloader.pages { page.auditAuthentication(key) }
                case "settings": self.openSettings()
                case "reviewAudit": if self.isReview { self.web.evaluateJavaScript("({url:location.origin+location.pathname,text:document.body.innerText.slice(0,600),iframeReady:!!document.getElementById('ams-managed-ui')?.contentDocument?.querySelector('#homeScreen'),schoolRequests:performance.getEntriesByType('resource').filter(r=>new URL(r.name,location.href).hostname.endsWith('xjtlu.edu.cn')).length})") { value,_ in if let directory=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first,let data=try? JSONSerialization.data(withJSONObject:value ?? [:]) { try? data.write(to:directory.appendingPathComponent("review-audit.json")) } } }
                case "reviewQR": if self.isReview { self.openCode() }
                case "reviewHht": if self.isReview { self.navigationController?.pushViewController(HhtController(reviewDemo:true),animated:true) }
                case "reviewScan": if self.isReview { self.frameAction("reviewScan") }
                case "detail","closeDetail": if self.isDesignPreview(self.web.url) { self.web.evaluateJavaScript("document.getElementById('ams-managed-ui')?.contentWindow.postMessage({iosTestDetail:\(command == "detail")},'*')",completionHandler:nil) }
                case "back": if self.isCurrentPage { self.nativeBack() } else { self.navigationController?.popViewController(animated:true) }
                case "home","records","leave","reservations": self.systemTabs?.selectPage(command == "home" ? 0 : command == "records" ? 1 : command == "leave" ? 2 : 3)
                case "room","seat": self.handle(URL(string:"ams-local://reservations?service=\(command)")!)
                default: break
                }
            }
        }
        #endif
    }
    deinit {
        loadingTimeout?.cancel();reviewTransport?.close(); NotificationCenter.default.removeObserver(self)
    }
    #if DEBUG
    private func auditAuthentication(_ key:String) {
        guard let web,let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first else { return }
        web.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
            let metadata = cookies.filter { $0.domain.hasSuffix("xjtlu.edu.cn") }.map { cookie -> [String:Any] in
                ["domain":cookie.domain,"name":cookie.name,"sessionOnly":cookie.isSessionOnly,"secure":cookie.isSecure,"httpOnly":cookie.isHTTPOnly,"expired":cookie.expiresDate.map{$0 <= Date()} ?? false]
            }
            web.evaluateJavaScript("(()=>{let token=false;try{token=!!JSON.parse(sessionStorage.getItem('userInfo')||'{}').token}catch{}return {host:location.hostname,path:location.pathname,route:location.hash.split('?')[0],bookingTokenPresent:token,bookingLoggedIn:sessionStorage.getItem('isLogin')==='true',loginMode:window.g?.loginMode??null,passwordForm:!!document.querySelector('input[type=password]'),iframeHosts:Array.from(document.querySelectorAll('iframe')).map(f=>{try{return new URL(f.src,location.href).hostname}catch{return ''}})}})()") { value,error in
                let result:[String:Any] = ["page":value ?? [:],"cookies":metadata,"persistentStore":web.configuration.websiteDataStore.isPersistent,"error":error != nil,"preparedSessionPresent":!self.reservationSession.isEmpty]
                if let data = try? JSONSerialization.data(withJSONObject:result,options:.sortedKeys) { try? data.write(to:directory.appendingPathComponent("auth-audit-"+key+".json")) }
            }
        }
    }
    #endif
    fileprivate func modalChanged(_ message:WKScriptMessage) {
        guard message.webView === web,message.frameInfo.isMainFrame,(message.frameInfo.request.url?.host == "ams.xjtlu.edu.cn" || isDesignPreview(message.frameInfo.request.url) || reviewURL(message.frameInfo.request.url)),let open = message.body as? Bool else { return }
        modalOpen = open
        originalHeader?.evaluateJavaScript("document.querySelector('.app').style.filter='\(open ? "blur(6px)" : "none")'",completionHandler:nil)
        systemTabs?.setChrome(visible:!open && rootChrome && tabsVisible,index:selectedTab)
        if open { headerMask.isHidden = !rootChrome }
        UIView.animate(withDuration:0.15,delay:0,options:[.beginFromCurrentState,.allowUserInteraction]) { self.headerMask.alpha = open ? 1 : 0 } completion: { _ in if !self.modalOpen { self.headerMask.isHidden = true }; self.publishPreparation() }
        originalHeader?.isUserInteractionEnabled = !open
        publishPreparation()
    }
    fileprivate func saveSession(_ message:WKScriptMessage) {
        guard message.webView === web,message.frameInfo.isMainFrame,message.frameInfo.request.url?.scheme == "https",message.frameInfo.request.url?.host == "ams.xjtlu.edu.cn",let value = message.body as? String,value.utf8.count <= 65536 else { return }
        if value.isEmpty { KeychainStore.save("",account:"amsSession"); installSchoolSession(in:web.configuration.userContentController); ActivationStore.accountChanged(); return }
        guard let data = value.data(using:.utf8),var user = (try? JSONSerialization.jsonObject(with:data)) as? [String:Any],let token = user["token"] as? String,!token.isEmpty else { return }
        for key in user.keys where ["password","passwd","otp","verificationcode"].contains(key.lowercased()) { user.removeValue(forKey:key) }
        if let data = try? JSONSerialization.data(withJSONObject:user),let safe = String(data:data,encoding:.utf8),KeychainStore.save(safe,account:"amsSession") { installSchoolSession(in:web.configuration.userContentController); ActivationStore.accountChanged() }
    }
    private func installSchoolSession(in controller:WKUserContentController) {
        guard let url = Bundle.main.url(forResource:"ios-session",withExtension:"js",subdirectory:"Assets"),let source = try? String(contentsOf:url,encoding:.utf8),let data = try? JSONSerialization.data(withJSONObject:[KeychainStore.read("amsSession")]),let encoded = String(data:data,encoding:.utf8) else { return }
        // WKUserScript captures its value. Replace it when the school rotates or clears the token.
        let scripts = controller.userScripts.filter { !$0.source.hasPrefix("/* AMS school session bridge */") }
        controller.removeAllUserScripts()
        controller.addUserScript(WKUserScript(source:source.replacingOccurrences(of:"__AMS_SESSION__",with:encoded+"[0]"),injectionTime:.atDocumentStart,forMainFrameOnly:true))
        for script in scripts { controller.addUserScript(script) }
    }
    private func managed(_ url:URL?) -> Bool { reviewURL(url) ||  ["seatbookings.xjtlu.edu.cn","roombookings.xjtlu.edu.cn","uim.xjtlu.edu.cn","portalapp.xjtlu.edu.cn"].contains(url?.host ?? "") || url?.host == "ams.xjtlu.edu.cn" }
    fileprivate func authExternal(_ message:WKScriptMessage) {
        guard message.webView === web, message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.scheme == "https",
              message.frameInfo.request.url?.host == "uim.xjtlu.edu.cn" else { return }
        guard message.body as? String == "forgotPassword" else { return }
        UIApplication.shared.open(URL(string:"https://uim.xjtlu.edu.cn/snackbar/package/portal/selfcareforgetpassword/index.html")!)
    }
    private func loadingTitle(_ url:URL) -> String {
        if url.host == "uim.xjtlu.edu.cn" || url.fragment?.lowercased().contains("login") == true { return "正在加载登录界面…" }
        if initialURL.fragment?.contains("userinfo") == true { return "正在加载我的预约…" }
        switch url.host {
        case "seatbookings.xjtlu.edu.cn": return "正在加载图书馆座位…"
        case "roombookings.xjtlu.edu.cn": return "正在加载讨论室预约…"
        case "shuttlebus.xjtlu.edu.cn": return "正在加载区间车预约…"
        default: return "正在加载课表…"
        }
    }
    private func beginLoading() {
        guard loadingState != .waiting else { return }
        loadingState = .waiting; loadingAttempt += 1; loadingHost = web?.url?.host ?? initialURL.host ?? ""
        if mainCampus {
            mainReady = false; tabsVisible = false; systemTabs?.setChrome(visible:false,index:selectedTab); originalHeader?.isHidden = true; preloader.suspend()
            if isCurrentPage { navigationController?.setNavigationBarHidden(true,animated:false) }
        }
        loadingTimeout?.cancel(); loadingSpinner.startAnimating(); loading.isHidden = false; loadingText.text = loadingTitle(web?.url ?? initialURL); retry.isHidden = true; web.alpha = 0
        let attempt = loadingAttempt
        let timeout = DispatchWorkItem { [weak self] in if self?.loadingAttempt == attempt { self?.loadingTimedOut() } }
        loadingTimeout = timeout; DispatchQueue.main.asyncAfter(deadline:.now()+20,execute:timeout)
    }
    private func showLoadingFailure(_ text:String) {
        loadingTimeout?.cancel(); loadingState = .failed; loadingSpinner.stopAnimating(); loading.isHidden = false; web.alpha = 0
        loadingText.text = text; retry.isHidden = false; finishPreparation("failed"); reservationStateChanged?("failed")
    }
    private func loadingTimedOut() {
        guard loadingState == .waiting else { return }
        let attempt = loadingAttempt
        showLoadingFailure("学校页面加载超时，请重试。若校园 Wi-Fi 无法打开，可切换流量对照。")
        // The fallback is visible before asking WebKit; a stalled content process must not block recovery.
        web.evaluateJavaScript("window.__amsLoadingDiagnostics?.() ?? 'document'") { [weak self] value,_ in
            guard let self, self.loadingState == .failed, self.loadingAttempt == attempt else { return }
            let detail:String
            switch value as? String {
            case "resources": detail = "学校页面的脚本或样式未能加载。"
            case "login": detail = "学校登录页面尚未就绪。"
            case "adapter": detail = "页面文档已加载，但业务数据或界面尚未就绪。"
            default: detail = "学校页面未完成加载。"
            }
            self.loadingText.text = detail + "\n请重试；校园 Wi-Fi 下失败时，可切换流量对照。\n" + self.loadingHost
        }
    }
    private func reveal() { loadingTimeout?.cancel(); loadingSpinner.stopAnimating(); loadingState = .ready; loading.isHidden = true; web.alpha = 1; updateInsets() }
    fileprivate func pageReady(_ message:WKScriptMessage) {
        guard message.webView === web, message.frameInfo.isMainFrame, let state = message.body as? String, message.frameInfo.request.url?.host == web.url?.host else { return }
        if state == "waiting" { beginLoading(); return }
        guard state == "ready" else { return }
        restoreRecordsIfNeeded { [weak self] restored in
            guard let self, !restored else { return }
            self.applyAppearance(); self.reveal()
            if self.initialURL.host == "ams.xjtlu.edu.cn", self.mainReady {
                self.updateChrome(); self.publishPreparation()
                if !self.isDesignPreview(self.web.url), UIApplication.shared.applicationState == .active { self.preloader.start() }
            }
            if self.preparationResult != nil {
                self.web.evaluateJavaScript("!!document.querySelector('input[type=password]')||/login/i.test(location.hash)") { [weak self] value,_ in self?.finishPreparation(value as? Bool == true ? "login" : "ready") }
            }
        }
    }
    fileprivate func pageChrome(_ message:WKScriptMessage) {
        guard message.frameInfo.isMainFrame, (message.frameInfo.request.url?.host == "ams.xjtlu.edu.cn" || isDesignPreview(message.frameInfo.request.url) || reviewURL(message.frameInfo.request.url)), let data = message.body as? [String:String], let route = data["route"], route.hasPrefix("/") else { return }
        let first = !mainReady, changed = first || chromeRoute != route || title != data["title"]
        #if DEBUG
        if isDesignPreview(web.url),let layout = data["layout"],let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first { try? layout.write(to:directory.appendingPathComponent("design-layout.json"),atomically:true,encoding:.utf8); return }
        #endif
        chromeRoute = route; title = data["title"]; mainReady = true; chromeVariables = data["variables"] ?? ""
        tabsVisible = rootChrome
        selectedTab = route == "/reservations" ? 3 : route.hasPrefix("/course") ? 1 : route.hasPrefix("/leave") ? 2 : 0
        syncOriginalChrome()
        if first { reveal(); if !isReview, !isDesignPreview(web.url), UIApplication.shared.applicationState == .active { preloader.start() } }
        if changed { updateChrome() }; publishPreparation()
        if route == "/home" { consumeShortcut() }
    }
    private func updateChrome() {
        guard !isPreparingOffscreen, mainCampus, isCurrentPage, systemTabs?.isSelectingPage != true else { return }
        let root = rootChrome
        navigationController?.setNavigationBarHidden(!mainReady || root,animated:false)
        originalHeader?.isHidden = !root
        systemTabs?.setChrome(visible:root && tabsVisible,index:selectedTab)
        let item = systemTabs?.navigationItem ?? navigationItem
        item.title = title
        item.leftBarButtonItem = root ? nil : UIBarButtonItem(title:"返回",style:.plain,target:self,action:#selector(nativeBack))
        syncOriginalChrome()
        var actions: [UIBarButtonItem] = []
        if ["/home","/course","/leave"].contains(chromeRoute) { actions.append(UIBarButtonItem(image:UIImage(systemName:"gearshape"),style:.plain,target:self,action:#selector(openSettings))); actions.last?.accessibilityLabel = "设置" }
        if chromeRoute == "/home" { actions.append(UIBarButtonItem(image:UIImage(systemName:"qrcode"),style:.plain,target:self,action:#selector(openCode))); actions.last?.accessibilityLabel = "我的西浦码" }
        item.rightBarButtonItems = actions
        updateInsets()
        if let config = pendingPublicConfig { showPublicConfig(config) }
    }
    private func isDesignPreview(_ url:URL?) -> Bool {
        #if DEBUG
        return (ProcessInfo.processInfo.arguments.contains("--test-design") || ProcessInfo.processInfo.arguments.contains("--test-record-layout")) && url?.isFileURL == true
        #else
        return false
        #endif
    }
    private func makeChrome(_ mode:String) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(ReadinessHandler(self),name:"amsChromeAction")
        config.userContentController.addUserScript(WKUserScript(source:"window.chromeMode='\(mode)'",injectionTime:.atDocumentStart,forMainFrameOnly:true))
        config.userContentController.addUserScript(WKUserScript(source:"window.iosReview=\(isReview)",injectionTime:.atDocumentStart,forMainFrameOnly:true))
        let chrome = WKWebView(frame:.zero,configuration:config)
        chrome.translatesAutoresizingMaskIntoConstraints = false; chrome.isOpaque = false; chrome.backgroundColor = .clear; chrome.scrollView.backgroundColor = .clear; chrome.scrollView.isScrollEnabled = false; chrome.scrollView.contentInsetAdjustmentBehavior = .never
        chrome.navigationDelegate = self
        if let url = Bundle.main.url(forResource:"ios-chrome",withExtension:"html",subdirectory:"Assets") { chrome.loadFileURL(url,allowingReadAccessTo:url.deletingLastPathComponent()) }
        return chrome
    }
    private func invalidateOriginalChrome() {
        chromeGeneration += 1; chromePayload = ""; chromeNeedsReload = true
    }
    private func recoverOriginalChrome() {
        guard chromeNeedsReload, mainReady, isCurrentPage, UIApplication.shared.applicationState == .active,
              let header = originalHeader,
              let url = Bundle.main.url(forResource:"ios-chrome",withExtension:"html",subdirectory:"Assets") else { return }
        invalidateOriginalChrome()
        chromeNeedsReload = false
        header.stopLoading()
        header.loadFileURL(url,allowingReadAccessTo:url.deletingLastPathComponent())
    }
    private func checkOriginalChrome() {
        guard rootChrome, isCurrentPage, UIApplication.shared.applicationState == .active, let header = originalHeader else { return }
        if chromeNeedsReload { recoverOriginalChrome(); return }
        guard !header.isLoading else { return }
        chromeGeneration += 1
        let generation = chromeGeneration
        var completed = false
        let timeout = DispatchWorkItem { [weak self] in
            guard !completed, let self, self.chromeGeneration == generation else { return }
            completed = true; self.invalidateOriginalChrome(); self.recoverOriginalChrome()
        }
        DispatchQueue.main.asyncAfter(deadline:.now()+2,execute:timeout)
        header.evaluateJavaScript("document.readyState === 'complete' && typeof window.setChrome === 'function' && !!document.querySelector('header') && document.querySelector('header').getBoundingClientRect().height > 0") { [weak self] value,error in
            guard !completed, let self, self.chromeGeneration == generation else { return }
            completed = true; timeout.cancel()
            if error != nil || value as? Bool != true {
                self.invalidateOriginalChrome(); self.recoverOriginalChrome()
            } else {
                self.chromePayload = ""; self.syncOriginalChrome()
            }
        }
    }
    private func syncOriginalChrome() {
        guard mainReady, !chromeNeedsReload, let header = originalHeader, !header.isLoading,
              let data = try? JSONSerialization.data(withJSONObject:[chromeRoute,title ?? "",traitCollection.userInterfaceStyle == .dark,chromeVariables] as [Any]),let payload = String(data:data,encoding:.utf8),payload != chromePayload else { return }
        let generation = chromeGeneration
        chromePayload = ""
        chromeSyncSequence += 1; let sequence = chromeSyncSequence
        header.evaluateJavaScript("(()=>{if(typeof window.setChrome !== 'function')return false;window.setChrome(...\(payload));return true})()") { [weak self] value,error in
            guard let self, self.chromeGeneration == generation, self.chromeSyncSequence == sequence else { return }
            self.chromePayload = error == nil && value as? Bool == true ? payload : ""
        }
    }
    fileprivate func chromeAction(_ message:WKScriptMessage) {
        guard message.webView === originalHeader, let data = message.body as? [String:Any],let action = data["action"] as? String else { return }
        switch action {
        case "settings": openSettings()
        case "xjcode": openCode()
        case "hhtcode": navigationController?.pushViewController(HhtController(reviewDemo:isReview),animated:true)
        case "height": if let height = data["index"] as? Double, height > 40, height < 200, headerHeight != CGFloat(height) { headerHeight = CGFloat(height); updateInsets() }
        default: break
        }
    }
    private func frameAction(_ action:String) { web.evaluateJavaScript("document.getElementById('ams-managed-ui')?.contentWindow.postMessage({iosAction:'\(action)'},'*')",completionHandler:nil) }
    @objc private func nativeBack() { frameAction("back") }
    @objc private func openSettings() { frameAction("settings") }
    @objc private func openCode() { frameAction("xjcode") }
    override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); updateInsets() }
    private func updateInsets() {
        guard web != nil, mainCampus else { return }
        let safe = view.safeAreaInsets
        originalHeaderHeight?.constant = headerHeight
        originalHeader?.isHidden = !rootChrome
        if !rootChrome { headerMask.isHidden = true }

        let adapted = managed(web.url) || isDesignPreview(web.url)
        mainTop?.constant = safe.top + (rootChrome ? headerHeight : 0)
        let hasTabs = adapted && tabsVisible && rootChrome
        mainBottom?.constant = adapted ? 0 : -safe.bottom
        let top:CGFloat = 0, bottom = adapted ? safe.bottom : 0
        let signature = "\(top):\(bottom):\(hasTabs):\(safe.top)"
        guard lastInsets != signature else { return }; lastInsets = signature
        web.evaluateJavaScript("window.__amsInsets={top:\(top),bottom:\(bottom)};window.__amsSetInsets && window.__amsSetInsets(window.__amsInsets)",completionHandler:nil)
    }
    @objc private func reload() {
        if isReview { navigationController?.setViewControllers([ActivationController()],animated:false);return }
        // A first navigation that never committed can leave reload() without a request to retry.
        loadingState = .failed; restoringRecords = false; beginLoading()
        if web.reload() == nil { loadInitialPage() }
    }
    @objc private func handleAppBack(_ gesture:UIScreenEdgePanGestureRecognizer) {
        guard gesture.state == .ended, gesture.translation(in:web).x > 60, web.url?.host == "ams.xjtlu.edu.cn" || reviewURL(web.url) else { return }
        web.evaluateJavaScript("window.__amsHandleBack && window.__amsHandleBack()",completionHandler:nil)
    }
    @objc private func resume() { checkOriginalChrome(); if mainReady, !isReview, !isDesignPreview(web.url) { preloader.start() }; if isCurrentPage { setReservationActive(true) }; web.evaluateJavaScript("window.__amsRefreshClock && window.__amsRefreshClock()", completionHandler: nil); refreshPublicConfig() }
    // Announcements and the Apple release delivered by the per-open check.
    @objc private func deviceCheckUpdated() {
        guard mainCampus,!isReview,let data = UserDefaults.standard.data(forKey:"deviceCheck.config"),let config = try? AppService.decode(data),config.schemaVersion == 1 else { return }
        showPublicConfig(config)
    }
    private func refreshPublicConfig() {
        guard mainCampus,!isReview,!isDesignPreview(web.url),!isPreparingOffscreen,isCurrentPage else { return }
        Task { if let config = await service.refresh() { showPublicConfig(config) } }
    }
    @objc private func background() { if !isReview { SchoolCookieSession.save() }; preloader.suspend(); setReservationActive(false) }
    override func didReceiveMemoryWarning() { super.didReceiveMemoryWarning(); preloader.discardUnused(keeping:navigationController?.topViewController) }
    private func publishPreparation() {
        guard web != nil, let data = try? JSONSerialization.data(withJSONObject:preloader.states), let text = String(data:data,encoding:.utf8) else { return }
        web.evaluateJavaScript("document.getElementById('ams-managed-ui')?.contentWindow.postMessage({iosPreload:\(text)},'*')",completionHandler:nil)
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-interface"), let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first {
            let snapshot: [String:Any] = ["states":preloader.states,"retainedPages":preloader.pages.count,"route":chromeRoute,"mainReady":mainReady,"bounces":web.scrollView.bounces,"headerVisible":navigationController?.isNavigationBarHidden == false,"headerMasked":!headerMask.isHidden,"headerInteractive":originalHeader?.isUserInteractionEnabled == true]
            if let diagnostic = try? JSONSerialization.data(withJSONObject:snapshot.merging(["systemTabs":systemTabs != nil,"tabsVisible":systemTabs?.tabBar.isHidden == false,"selectedTab":systemTabs?.selectedIndex ?? -1],uniquingKeysWith:{$1}),options:.sortedKeys) { try? diagnostic.write(to:directory.appendingPathComponent("ios-interface-check.json")) }
        }
        #endif
    }
    func prepareInBackground(_ completion:@escaping (String)->Void) { isPreparingOffscreen = true; preparationResult = completion; loadViewIfNeeded() }
    private func finishPreparation(_ state:String) {
        guard let completion = preparationResult else { return }; preparationResult = nil
        if isPreparingOffscreen { setReservationActive(false) }; completion(state)
    }
    func cancelPreparation() { preparationResult = nil; loadingTimeout?.cancel(); web?.stopLoading(); setReservationActive(false) }
    private func installReservationSession(in controller:WKUserContentController,host:String? = nil) {
        let host = host ?? initialURL.host ?? ""
        reservationSessionHost = host
        reservationSession = KeychainStore.read("reservationSession." + host)
        guard let url = Bundle.main.url(forResource:"ios-reservation-session",withExtension:"js",subdirectory:"Assets"),let source = try? String(contentsOf:url,encoding:.utf8),let data = try? JSONSerialization.data(withJSONObject:[reservationSession]),let encoded = String(data:data,encoding:.utf8) else { return }
        let scripts = controller.userScripts.filter { !$0.source.hasPrefix("/* AMS reservation session bridge */") }
        controller.removeAllUserScripts()
        controller.addUserScript(WKUserScript(source:source.replacingOccurrences(of:"__RESERVATION_SESSION__",with:encoded+"[0]").replacingOccurrences(of:"__RESERVATION_HOST__",with:"\""+host+"\""),injectionTime:.atDocumentStart,forMainFrameOnly:true))
        for script in scripts { controller.addUserScript(script) }
    }
    fileprivate func saveReservationSession(_ message:WKScriptMessage) {
        guard message.webView === web,message.frameInfo.isMainFrame,message.frameInfo.request.url?.scheme == "https",let host = message.frameInfo.request.url?.host,Self.reservationHosts.contains(host),let value = message.body as? String,value.utf8.count <= 65536 else { return }
        var saved = ""
        guard let body = value.data(using:.utf8),let payload = (try? JSONSerialization.jsonObject(with:body)) as? [String:String] else { return }
        if let expired = payload["expiredToken"] {
            let existing = KeychainStore.read("reservationSession."+host)
            guard let data = existing.data(using:.utf8),let state = (try? JSONSerialization.jsonObject(with:data)) as? [String:String],let info = state["userInfo"]?.data(using:.utf8),let user = (try? JSONSerialization.jsonObject(with:info)) as? [String:Any],user["token"] as? String == expired else { return }
        } else {
            guard let data = value.data(using:.utf8),let state = (try? JSONSerialization.jsonObject(with:data)) as? [String:String],state["isLogin"] == "true",let info = state["userInfo"]?.data(using:.utf8),var user = (try? JSONSerialization.jsonObject(with:info)) as? [String:Any],let token = user["token"] as? String,!token.isEmpty else { return }
            for key in user.keys where ["password","passwd","otp","verificationcode"].contains(key.lowercased()) { user.removeValue(forKey:key) }
            guard let clean = try? JSONSerialization.data(withJSONObject:user),let text = String(data:clean,encoding:.utf8),let output = try? JSONSerialization.data(withJSONObject:["userInfo":text,"isLogin":"true"]),let result = String(data:output,encoding:.utf8) else { return }
            saved = result
        }
        KeychainStore.save(saved,account:"reservationSession."+host)
        if !saved.isEmpty { SchoolCookieSession.save() }
        if host == reservationSessionHost { installReservationSession(in:web.configuration.userContentController,host:host) }
    }
    func activatePreparedPage() {
        isPreparingOffscreen = false
        let sessionHost = Self.reservationHosts.contains(web.url?.host ?? "") ? web.url?.host : initialURL.host
        if let host = sessionHost,Self.reservationHosts.contains(host),KeychainStore.read("reservationSession."+host) != reservationSession {
            installReservationSession(in:web.configuration.userContentController,host:host)
            let target = initialURL.fragment?.contains("userinfo") == true ? URL(string:"https://\(host)/#/ic/userinfo")! : initialURL
            restoringRecords = false; beginLoading(); web.load(URLRequest(url:target)); return
        }
        if loadingState == .failed { reload() }
        if hasBeenPresented, loadingState == .ready, web.url?.host == initialURL.host, initialURL.fragment?.contains("userinfo") != true {
            // Reuse the school shell; choosing a location then fetches current availability.
            web.evaluateJavaScript("if(!document.querySelector('.el-dialog__wrapper:not([style*=none])'))location.hash='#/ic/home'",completionHandler:nil)
        }
    }
    private func setReservationActive(_ active:Bool) { web?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('ams-ios-active',{detail:\(active)}));document.getElementById('ams-managed-ui')?.contentWindow.postMessage({iosActive:\(active)},'*')",completionHandler:nil) }
    private func showPublicConfig(_ config:PublicConfig) {
        pendingPublicConfig = config
        guard mainReady,isCurrentPage,!isReview,UIApplication.shared.applicationState == .active,presentedViewController == nil,systemTabs?.presentedViewController == nil,navigationController?.presentedViewController == nil else { return }
        pendingPublicConfig = nil
        if let announcement = config.announcement, !announcement.id.isEmpty, UserDefaults.standard.string(forKey:"announcement.seen") != announcement.id {
            if announcement.expiresAt.map({$0 > Date()}) ?? true { AnnouncementController.show(announcement,from:self); return }
        }
        let currentBuild = Int(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1") ?? 1
        let currentVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
        if let release = config.release, release.newer(than:currentVersion,build:currentBuild),release.url.scheme == "https",release.url.user == nil,release.url.password == nil,["apps.apple.com","testflight.apple.com"].contains(release.url.host ?? ""),UserDefaults.standard.string(forKey:"release.seenIdentity") != release.identity {
            let alert = UIAlertController(title:"发现新版本 \(release.version)",message:release.notes,preferredStyle:.alert)
            alert.addAction(UIAlertAction(title:"稍后",style:.cancel) { _ in UserDefaults.standard.set(release.identity,forKey:"release.seenIdentity") }); alert.addAction(UIAlertAction(title:"前往更新",style:.default) { _ in UserDefaults.standard.set(release.identity,forKey:"release.seenIdentity"); UIApplication.shared.open(release.url) }); present(alert,animated:true)
        }
    }
    private func message(_ text: String) {
        let alert = UIAlertController(title: "AMS 校园助手", message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "确定", style: .default)); present(alert, animated: true)
    }
    private func reviewURL(_ url:URL?) -> Bool {
        guard isReview,let url,let assets=Bundle.main.url(forResource:"review-index",withExtension:"html",subdirectory:"Assets")?.deletingLastPathComponent() else { return false }
        return url.isFileURL && url.deletingLastPathComponent().standardizedFileURL.path==assets.standardizedFileURL.path && ["review-index.html","review-content.html"].contains(url.lastPathComponent)
    }
    private func loadInitialPage() {
        if let request = reviewRequest {
            let transport=ReviewTransport(request);reviewTransport=transport
            Task { do { try await transport.start();await CourseReminderCenter.review.configureReview { body in try await transport.request("reminder", body) };guard let url=Bundle.main.url(forResource:"review-index",withExtension:"html",subdirectory:"Assets") else { throw URLError(.fileDoesNotExist) };web.loadFileURL(url,allowingReadAccessTo:url.deletingLastPathComponent()) } catch { loadingTimeout?.cancel();loadingState = .failed;loadingText.text="演示服务未能连接，请重新加载。";retry.isHidden=false } };return
        }
        SchoolCookieSession.restore { [weak self] in guard let self else { return }; self.web.load(URLRequest(url:self.initialURL)) }
    }
    fileprivate func reviewAPI(_ message:WKScriptMessage) {
        #if DEBUG
        if isReview { reviewDebug(["type":"api-message","file":message.frameInfo.request.url?.lastPathComponent ?? "nil"]) }
        #endif
        guard isReview,message.webView === web,message.frameInfo.isMainFrame,reviewURL(message.frameInfo.request.url),let body=message.body as? [String:Any],let id=body["id"] as? String,UUID(uuidString:id) != nil,let path=body["path"] as? String,["state","action","reminder"].contains(path),let transport=reviewTransport else { return }
        let value=body["data"] as? [String:Any]
        guard (path=="state" && value==nil)||(["action","reminder"].contains(path) && value != nil) else { return }
        Task { let status:Int,response:[String:Any];do { (status,response)=try await transport.request(path,value);if path == "reminder", status == 200 { CourseReminderCenter.review.applyReviewResponse(response) } } catch { status=0;response=["message":"演示服务连接失败，请重试。"] };if let data=try? JSONSerialization.data(withJSONObject:[id,status,response] as [Any]),let text=String(data:data,encoding:.utf8) { web.evaluateJavaScript("window.__amsReviewResponse&&window.__amsReviewResponse(...\(text))",completionHandler:nil) } }
    }
    fileprivate func reviewAction(_ message:WKScriptMessage) {
        guard isReview, message.webView === web, message.frameInfo.isMainFrame, reviewURL(message.frameInfo.request.url), let data=message.body as? [String:Any],let action=data["action"] as? String else { return }
        switch action {
        case "reviewNotification": Task {
            let ok = await CourseReminderCenter.review.testReviewNotification()
            let text = ok ? "演示通知已安排，5 秒后显示；可返回桌面查看。" : "请开启课前通知并允许 AMS 发送通知后重试。"
            if let data = try? JSONSerialization.data(withJSONObject: [text]), let json = String(data: data, encoding: .utf8) { web.evaluateJavaScript("window.__amsReviewNotice&&window.__amsReviewNotice(...\(json))", completionHandler: nil) }
        }
        case "courseReminder": if let change=data["change"] as? [String:Any], let encoded=try? JSONSerialization.data(withJSONObject:change), let json=String(data:encoded,encoding:.utf8) { CourseReminderCenter.review.receiveChange(json) }
        case "restart": navigationController?.setViewControllers([ActivationController()],animated:false)
        case "navstate": tabsVisible=data["visible"] as? Bool == true;selectedTab=data["index"] as? Int ?? 0;systemTabs?.setChrome(visible:rootChrome && tabsVisible,index:selectedTab);updateInsets()
        case "qr": if let payload=data["payload"] as? String,payload.hasPrefix("AMS-DEMO-NOT-VALID:"),payload.count<200 { navigationController?.pushViewController(XipuCodeController(demoPayload:payload),animated:true) }
        case "hht": navigationController?.pushViewController(HhtController(reviewDemo:true),animated:true)
        case "scan": presentReviewScanner()
        case "logout": CourseReminderCenter.review.clearForLogout();web.stopLoading();KeychainStore.save("",account:"iosActivationGrant");navigationController?.setViewControllers([ActivationController()],animated:false)
        case "contact": UIApplication.shared.open(URL(string:"mailto:linlantc@gmail.com")!)
        case "supportCreator": UIApplication.shared.open(URL(string:"https://afdian.com/a/tristanchayne")!)
        default: break
        }
    }
    private func trusted(_ url: URL?) -> Bool { url?.scheme == "https" && (schoolHosts.contains(url?.host ?? "") || url?.host?.hasSuffix(".xjtlu.edu.cn") == true || url?.host == "xjtlu.edu.cn") }
    @objc private func switchRecords() { restoringRecords = false; let host = recordsSwitch.selectedSegmentIndex == 0 ? "seatbookings.xjtlu.edu.cn" : "roombookings.xjtlu.edu.cn"; installReservationSession(in:web.configuration.userContentController,host:host); web.load(URLRequest(url:URL(string:"https://\(host)/#/ic/userinfo")!)) }
    func selectTab(_ index:Int) {
        guard (web.url?.host == "ams.xjtlu.edu.cn" || isDesignPreview(web.url) || reviewURL(web.url)), (0...3).contains(index) else { return }
        web.evaluateJavaScript("(()=>{const frame=document.getElementById('ams-managed-ui');frame?.contentWindow.postMessage({navIndex:\(index)},'*');return !!frame})()") { value,error in
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--test-interface"),let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first,let data = try? JSONSerialization.data(withJSONObject:["index":index,"sent":value as? Bool == true,"error":error == nil] as [String:Any]) { try? data.write(to:directory.appendingPathComponent("tab-command.json")) }
            #endif
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if isReview, webView === web { decisionHandler(reviewURL(action.request.url) || action.request.url?.scheme == "about" ? .allow : .cancel); return }
        if isDesignPreview(action.request.url) { decisionHandler(.allow); return }
        if webView !== web { decisionHandler(action.request.url?.isFileURL == true || action.request.url?.scheme == "about" ? .allow : .cancel); return }
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "ams-local" {
            decisionHandler(.cancel)
            guard action.sourceFrame.request.url?.host == "ams.xjtlu.edu.cn", action.sourceFrame.isMainFrame else { return }
            handle(url); return
        }
        if trusted(url) || url.scheme == "about" {
            if action.targetFrame?.isMainFrame == true, url.scheme == "https" {
                var target = URLComponents(url:url,resolvingAgainstBaseURL:false); target?.fragment = nil
                var current = web.url.flatMap { URLComponents(url:$0,resolvingAgainstBaseURL:false) }; current?.fragment = nil
                if action.navigationType == .reload || target?.url != current?.url {
                    if initialURL.host == "ams.xjtlu.edu.cn", url.host != "ams.xjtlu.edu.cn" { preloader.discardUnused(keeping:nil) }
                    beginLoading(); loadingHost = url.host ?? ""; loadingText.text = loadingTitle(url)
                }
            }
            decisionHandler(.allow); return
        }
        decisionHandler(.cancel)
        if action.navigationType == .linkActivated && ["https", "mailto"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
    }
    private func restoreRecordsIfNeeded(_ completion:@escaping (Bool)->Void) {
        guard initialURL.fragment?.contains("userinfo") == true, !restoringRecords, ["seatbookings.xjtlu.edu.cn","roombookings.xjtlu.edu.cn"].contains(web.url?.host ?? "") else { completion(false); return }
        web.evaluateJavaScript("!/login/i.test(location.hash)&&!document.querySelector('input[type=password]')&&!location.hash.startsWith('#/ic/userinfo')") { [weak self] value,_ in
            guard let self else { completion(false); return }
            if value as? Bool == true { self.restoringRecords = true; self.beginLoading(); self.web.evaluateJavaScript("location.hash='/ic/userinfo'",completionHandler:nil); completion(true) } else { completion(false) }
        }
    }
    private func handle(_ url: URL) {
        let values = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func value(_ name: String) -> String? { values.first { $0.name == name }?.value }
        switch url.host {
        case "navstate":
            tabsVisible = value("visible") == "true"
            if let index = Int(value("index") ?? ""), (0...3).contains(index) { selectedTab = index }
            systemTabs?.setChrome(visible:rootChrome && tabsVisible,index:selectedTab); updateInsets()
        case "schedule":
            guard initialURL.host == "ams.xjtlu.edu.cn", web.url?.host == "ams.xjtlu.edu.cn" else { return }
            web.evaluateJavaScript("JSON.stringify(window.__amsSchedule||null)") { value,_ in
                if let json = value as? String, json != "null" { CourseReminderCenter.shared.receiveSchedule(json) }
            }
        case "coursereminder":
            guard initialURL.host == "ams.xjtlu.edu.cn", let change = value("change") else { return }
            CourseReminderCenter.shared.receiveChange(change)
        case "logout":
            CourseReminderCenter.shared.clearForLogout()
            SchoolCookieSession.clear()
            KeychainStore.save("",account:"amsSession")
            ActivationStore.accountChanged()
            for host in Self.reservationHosts { KeychainStore.save("",account:"reservationSession."+host) }
            preloader.discardUnused(keeping:nil)
            web.stopLoading()
            WKWebsiteDataStore.default().fetchDataRecords(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes()) { records in
                let selected = records.filter { $0.displayName == "xjtlu.edu.cn" || $0.displayName.hasSuffix(".xjtlu.edu.cn") }
                WKWebsiteDataStore.default().removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), for: selected) { self.navigationController?.setViewControllers([CampusTabController()],animated:false) }
            }
        case "reservations":
            if isReview {
                let service=value("service") ?? "home"
                guard ["seat","room","bus","sports","records","seatRecords","roomRecords","home"].contains(service) else { return }
                web.evaluateJavaScript("window.__amsReviewReservation?.('\(service)')",completionHandler:nil)
                return
            }
            guard isCurrentPage, navigationController?.transitionCoordinator == nil else { return }
            if value("service") == "sports" {
                let sports = UINavigationController(rootViewController:SportsController())
                sports.modalPresentationStyle = .fullScreen
                present(sports,animated:true)
                return
            }
            let destinations = ["seat": "https://seatbookings.xjtlu.edu.cn/", "room": "https://roombookings.xjtlu.edu.cn/", "fb": "https://gsrb.xjtlu.edu.cn/", "bus": "https://shuttlebus.xjtlu.edu.cn/", "records": "https://seatbookings.xjtlu.edu.cn/#/ic/userinfo", "seatRecords": "https://seatbookings.xjtlu.edu.cn/#/ic/userinfo", "roomRecords": "https://roombookings.xjtlu.edu.cn/#/ic/userinfo"]
            if let key = value("service"), let destination = destinations[key], let target = URL(string: destination) { navigationController?.pushViewController(preloader.page(for:key) ?? CampusController(url: target), animated: true) }
        case "supportcreator":
            guard isCurrentPage else { return }
            UIApplication.shared.open(URL(string: "https://afdian.com/a/tristanchayne")!)
        case "email": UIApplication.shared.open(URL(string: "mailto:linlantc@gmail.com")!)
        case "appearance":
            let mode = value("mode") ?? "system"
            guard ["system", "light", "dark"].contains(mode) else { return }
            UserDefaults.standard.set(mode, forKey: "appearance")
            applyAppearance()
        case "theme": if let key = value("key"), ["blue","green","dusk","teal","sage","smoke","graphite","rose","wheat"].contains(key) { UserDefaults.standard.set(key,forKey:"theme"); applyAppearance() }
        case "scan":
            let scanner = ScannerController()
            scanner.onCode = { [weak self] code in
                guard let self, self.web.url?.host == "ams.xjtlu.edu.cn", let data = try? JSONSerialization.data(withJSONObject:[code]), let array = String(data:data,encoding:.utf8) else { return }
                self.web.evaluateJavaScript("window.__amsSubmitScanPayload && window.__amsSubmitScanPayload(\(array)[0])") { result, error in
                    if error == nil && result as? String == "invalid-payload" { self.message("二维码格式不符合当前 AMS 网页的签到格式，请检查是否为课堂签到二维码。"); return }
                    if error != nil || result as? String != "submitted" { self.message("未能确认签到提交，请先检查签到记录，避免重复提交。") }
                }
            }
            present(UINavigationController(rootViewController:scanner),animated:true)
        case "xjcode": navigationController?.pushViewController(XipuCodeController(),animated:true)
        case "hhtcode": navigationController?.pushViewController(HhtController(),animated:true)
        default: break
        }
    }
    // "扫码签到" from the Live Activity: wait until the signed-in AMS home is ready, then scan from the home tab.
    private func presentReviewScanner() {
        let scanner=ScannerController();scanner.demoEnabled=true
        scanner.onCode={ [weak self] payload in
            guard payload.hasPrefix("AMS-DEMO-NOT-VALID:") else { self?.message("演示环境仅接受演示二维码，不会提交学校签到。"); return }
            self?.frameAction("reviewScan")
        }
        present(UINavigationController(rootViewController:scanner),animated:true)
    }
    @objc private func consumeShortcut() {
        if isReview, PendingShortcut.scan, mainReady, isCurrentPage, presentedViewController == nil {
            PendingShortcut.scan = false
            if selectedTab != 0 { systemTabs?.selectPage(0) }
            presentReviewScanner()
            return
        }
        guard PendingShortcut.scan, initialURL.host == "ams.xjtlu.edu.cn", !isReview, mainReady, isCurrentPage,
              web?.url?.host == "ams.xjtlu.edu.cn", presentedViewController == nil else { return }
        PendingShortcut.scan = false
        if selectedTab != 0 { systemTabs?.selectPage(0) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in self?.handle(URL(string: "ams-local://scan")!) }
    }
    // REMIND-001: only the real AMS page (not review / design preview) gets the reminder bridge.
    @objc private func publishCourseReminder() {
        guard (isReview && reviewURL(web?.url)) || (initialURL.host == "ams.xjtlu.edu.cn" && web?.url?.host == "ams.xjtlu.edu.cn") else { return }
        let script = (isReview ? CourseReminderCenter.review : CourseReminderCenter.shared).webStateScript()
        if !script.isEmpty { web.evaluateJavaScript(script, completionHandler: nil) }
    }
    private func applyAppearance() {
        let mode = appearanceMode
        overrideUserInterfaceStyle = mode == "dark" ? .dark : mode == "light" ? .light : .unspecified
        if !isPreparingOffscreen { view.window?.overrideUserInterfaceStyle = overrideUserInterfaceStyle }
        let dark = traitCollection.userInterfaceStyle == .dark
        let palette = CampusPalette(key:UserDefaults.standard.string(forKey:"theme") ?? "blue",dark:dark)
        systemTabs?.tabBar.tintColor = dark ? .white : palette.primary
        view.backgroundColor = palette.paper; web.backgroundColor = palette.paper; navigationController?.navigationBar.tintColor = dark ? .white : palette.primary
        web.scrollView.backgroundColor = palette.paper
        if !isPreparingOffscreen {
            let bar = UINavigationBarAppearance(); bar.configureWithDefaultBackground(); bar.backgroundColor = palette.paper.withAlphaComponent(0.85); bar.titleTextAttributes = [.foregroundColor:palette.ink]
            navigationItem.standardAppearance = bar; navigationItem.scrollEdgeAppearance = bar
        }
        let scale = min(2,UIFontMetrics.default.scaledValue(for:15)/15)
        web.evaluateJavaScript("document.getElementById('ams-managed-ui')?.contentWindow.postMessage({iosTextScale:\(scale)},'*')",completionHandler:nil)
        web.evaluateJavaScript(palette.script,completionHandler:nil)
        chromePayload = ""; syncOriginalChrome()
        web.evaluateJavaScript("window.__amsNativeDark=\(dark);window.__amsAuthAppearance&&window.__amsAuthAppearance(\(dark));window.__amsSetAppearance && window.__amsSetAppearance('\(mode)',\(dark))", completionHandler: nil)
        if let css = Bundle.main.url(forResource:"reservation-theme",withExtension:"css",subdirectory:"Assets"), let text = try? String(contentsOf:css,encoding:.utf8), let encoded = try? JSONSerialization.data(withJSONObject:[text]), let array = String(data:encoded,encoding:.utf8) {
            web.evaluateJavaScript("(()=>{if(document.getElementById('campus-shared-theme'))return;const s=document.createElement('style');s.id='campus-shared-theme';s.textContent=\(array)[0];document.head.append(s)})();",completionHandler:nil)
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if webView === web { SchoolCookieSession.save() }

        #if DEBUG
        if webView === web, ProcessInfo.processInfo.arguments.contains("--test-record-layout") { web.evaluateJavaScript("JSON.stringify(Array.from(document.querySelectorAll('input[type=date]')).map(input=>{const a=input.getBoundingClientRect(),b=input.closest('.record-filter').getBoundingClientRect();return {width:a.width,cardWidth:b.width,fits:a.left>=b.left&&a.right<=b.right}}))") { value,_ in if let value = value as? String,let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first { try? value.write(to:directory.appendingPathComponent("records-layout.json"),atomically:true,encoding:.utf8) } } }
        #endif
        if webView === originalHeader { chromeNeedsReload = false; chromePayload = ""; syncOriginalChrome(); return }; if webView !== web { return }; lastInsets = ""; applyAppearance(); publishCourseReminder(); if !isPreparingOffscreen, isCurrentPage { navigationController?.setNavigationBarHidden(mainCampus && (!mainReady || rootChrome), animated: false) }; if !managed(webView.url) { reveal(); if preparationResult != nil { finishPreparation("login") } }
        else { webView.evaluateJavaScript("document.documentElement.classList.contains('ams-ios-ready')") { [weak self] value,_ in if value as? Bool == true { self?.restoreRecordsIfNeeded { restored in if !restored { self?.reveal() } } } } }
    }
    override func viewWillAppear(_ animated:Bool) { super.viewWillAppear(animated); hasBeenPresented = true; navigationController?.setNavigationBarHidden(mainCampus && (!mainReady || rootChrome),animated:false); applyAppearance(); if mainReady { updateChrome(); publishPreparation() }; setReservationActive(true); checkOriginalChrome() }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated)
        setReservationActive(true)
        refreshPublicConfig()
        consumeShortcut()
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-record-return"),let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first,let data = try? JSONSerialization.data(withJSONObject:["systemBack":navigationItem.leftBarButtonItem == nil,"edgeReturnEnabled":navigationController?.interactivePopGestureRecognizer?.isEnabled == true,"stackDepth":navigationController?.viewControllers.count ?? 0] as [String:Any]) { try? data.write(to:directory.appendingPathComponent("records-return-check.json")) }
        #endif
    }
    override func viewDidDisappear(_ animated:Bool) {
        super.viewDidDisappear(animated); setReservationActive(false)
        if reservationStateChanged != nil {
            web.evaluateJavaScript("!!document.querySelector('input[type=password]')||/login/i.test(location.hash)") { [weak self] value,error in
                guard let self, error == nil else { return }
                self.reservationStateChanged?(value as? Bool == true || self.web.url?.host != self.initialURL.host ? "login" : self.loadingState == .failed ? "failed" : "ready")
            }
        }
    }
    func webView(_ webView:WKWebView, createWebViewWith configuration:WKWebViewConfiguration, for action:WKNavigationAction, windowFeatures:WKWindowFeatures) -> WKWebView? { if action.targetFrame == nil, let url = action.request.url, trusted(url) { webView.load(action.request) }; return nil }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let failure = error as NSError
        if webView === originalHeader {
            if !(failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled) { invalidateOriginalChrome() }
            return
        }
        guard webView === web, !(failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled) else { return }
        let detail:String
        if failure.domain == NSURLErrorDomain {
            switch failure.code {
            case NSURLErrorNotConnectedToInternet: detail = "当前网络未连接。"
            case NSURLErrorTimedOut: detail = "学校服务连接超时。"
            case NSURLErrorCannotFindHost, NSURLErrorDNSLookupFailed: detail = "当前网络无法解析学校服务地址。"
            case NSURLErrorCannotConnectToHost, NSURLErrorNetworkConnectionLost: detail = "当前网络无法连接学校服务。"
            case NSURLErrorSecureConnectionFailed, NSURLErrorServerCertificateHasBadDate, NSURLErrorServerCertificateUntrusted, NSURLErrorServerCertificateHasUnknownRoot, NSURLErrorServerCertificateNotYetValid: detail = "学校服务的安全连接验证失败。"
            default: detail = "学校页面加载失败。"
            }
        } else { detail = "学校页面加载失败。" }
        showLoadingFailure(detail + "\n请重试；校园 Wi-Fi 下失败时，可切换流量对照。\n" + loadingHost + "（\(failure.code)）")
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { self.webView(webView,didFailProvisionalNavigation:navigation,withError:error) }
    func webViewWebContentProcessDidTerminate(_ webView:WKWebView) {
        if webView === originalHeader { invalidateOriginalChrome(); recoverOriginalChrome() }
        else if webView === web { showLoadingFailure("页面进程已停止，请重新加载。") }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage text: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "AMS", message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in completionHandler() }); present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage text: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "AMS", message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) }); alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in completionHandler(true) }); present(alert, animated: true)
    }
}
