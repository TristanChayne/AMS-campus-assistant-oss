import UIKit
import WebKit

/// Dedicated official H5 container. Never restore tokens, submit orders or infer payment success.
final class SportsController: UIViewController, WKNavigationDelegate, WKUIDelegate, UITabBarDelegate {
    private var web: WKWebView!
    private var previousWindows: [WKWebView] = []
    private var urlObservation: NSKeyValueObservation?
    private let tabs = UITabBar()
    private var tabsHeight: NSLayoutConstraint?
    private let loading = UIStackView()
    private let spinner = UIActivityIndicatorView(style:.medium)
    private let status = UILabel()
    private let retry = UIButton(type:.system)
    private var deadline: DispatchWorkItem?
    private var attempt = 0
    private var waiting = false
    private var failed = false
    private var uncertainWrite = false
    private var ordersRecovery = false
    private var currentTarget: URL?
    private var activeNavigation: WKNavigation?
    private var retryURL = SportsNavigation.sections[0]
    private var css = ""
    private var presentation = ""

    override func viewDidLoad() {
        super.viewDidLoad()
        for (name,ext) in [("sports-theme","css"),("sports-ui","js")] {
            if let url = Bundle.main.url(forResource:name,withExtension:ext,subdirectory:"Assets"),let text = try? String(contentsOf:url,encoding:.utf8) {
                if ext == "css" { css = text } else { presentation = text }
            }
        }
        navigationItem.rightBarButtonItems = [UIBarButtonItem(barButtonSystemItem:.close,target:self,action:#selector(close)),UIBarButtonItem(barButtonSystemItem:.refresh,target:self,action:#selector(refresh))]
        tabs.items = [UITabBarItem(title:"场馆预约",image:UIImage(systemName:"sportscourt"),tag:0),UITabBarItem(title:"我的订单",image:UIImage(systemName:"list.bullet.rectangle"),tag:1),UITabBarItem(title:"我的票券",image:UIImage(systemName:"ticket"),tag:2)]
        tabs.delegate = self; tabs.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(tabs)
        view.keyboardLayoutGuide.usesBottomSafeArea = false
        let height = tabs.heightAnchor.constraint(equalToConstant:tabs.sizeThatFits(CGSize(width:view.bounds.width,height:0)).height)
        tabsHeight = height
        NSLayoutConstraint.activate([tabs.leadingAnchor.constraint(equalTo:view.leadingAnchor),tabs.trailingAnchor.constraint(equalTo:view.trailingAnchor),tabs.bottomAnchor.constraint(equalTo:view.keyboardLayoutGuide.topAnchor),height])
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.defaultWebpagePreferences.preferredContentMode = .mobile
        web = makeWebView(config)
        attach(web)
        loading.axis = .vertical; loading.alignment = .center; loading.spacing = 16
        loading.translatesAutoresizingMaskIntoConstraints = false
        spinner.hidesWhenStopped = true
        status.numberOfLines = 0; status.textAlignment = .center
        status.font = .preferredFont(forTextStyle:.body); status.adjustsFontForContentSizeCategory = true
        retry.setTitle("重新连接",for:.normal); retry.addTarget(self,action:#selector(recover),for:.touchUpInside)
        retry.titleLabel?.font = .preferredFont(forTextStyle:.headline)
        loading.addArrangedSubview(spinner); loading.addArrangedSubview(status); loading.addArrangedSubview(retry)
        retry.heightAnchor.constraint(greaterThanOrEqualToConstant:44).isActive = true
        view.addSubview(loading)
        NSLayoutConstraint.activate([loading.centerXAnchor.constraint(equalTo:view.centerXAnchor),loading.centerYAnchor.constraint(equalTo:view.centerYAnchor),loading.widthAnchor.constraint(lessThanOrEqualTo:view.widthAnchor,constant:-48)])
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (owner:SportsController, _:UITraitCollection) in owner.applyAppearance() }
        registerForTraitChanges([UITraitPreferredContentSizeCategory.self]) { (owner:SportsController, _:UITraitCollection) in owner.applyAppearance() }
        applyAppearance()
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-sports-offline") {
            guard let fixture = Bundle.main.url(forResource:"sports-fixture",withExtension:"html",subdirectory:"Assets") else { fail("离线测试页面缺失。"); return }
            beginLoading(); web.loadFileURL(fixture,allowingReadAccessTo:fixture.deletingLastPathComponent()); return
        }
        #endif
        guard !css.isEmpty,!presentation.isEmpty else { fail("体育馆界面组件缺失，请重新安装 App。"); return }
        loadSection(0)
    }
    override func viewWillAppear(_ animated:Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(false,animated:false)
        applyAppearance()
        // Returning from a payment app does not reload or submit. Official polling owns the result.
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let height = tabs.sizeThatFits(CGSize(width:view.bounds.width,height:0)).height
        if let constraint = tabsHeight, abs(constraint.constant-height) > 0.5 { constraint.constant = height }
        web.scrollView.contentInset.bottom = height
        web.scrollView.verticalScrollIndicatorInsets.bottom = height
    }
    private func makeWebView(_ configuration:WKWebViewConfiguration) -> WKWebView {
        let page = WKWebView(frame:.zero,configuration:configuration)
        page.navigationDelegate = self; page.uiDelegate = self
        page.allowsBackForwardNavigationGestures = false
        page.scrollView.contentInsetAdjustmentBehavior = .never
        page.isOpaque = false
        return page
    }
    private func attach(_ page:WKWebView) {
        page.translatesAutoresizingMaskIntoConstraints = false
        view.insertSubview(page,at:0)
        NSLayoutConstraint.activate([page.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),page.leadingAnchor.constraint(equalTo:view.leadingAnchor),page.trailingAnchor.constraint(equalTo:view.trailingAnchor),page.bottomAnchor.constraint(equalTo:view.keyboardLayoutGuide.topAnchor)])
        urlObservation = page.observe(\.url,options:[.new]) { [weak self] _,_ in self?.updateNavigation() }
        updateNavigation()
    }
    private func updateNavigation() {
        title = SportsNavigation.paying(web?.url) ? "确认与支付" : ["体育馆预约","体育馆订单","运动票券"][SportsNavigation.section(web?.url)]
        navigationItem.leftBarButtonItem = web?.canGoBack == true || !previousWindows.isEmpty ? UIBarButtonItem(title:"返回",style:.plain,target:self,action:#selector(back)) : nil
        tabs.selectedItem = SportsNavigation.paying(web?.url) ? nil : tabs.items?[SportsNavigation.section(web?.url)]
    }
    private var paying: Bool { SportsNavigation.paying(web?.url) || SportsNavigation.paying(currentTarget) }
    private func beginLoading() {
        deadline?.cancel(); attempt += 1
        activeNavigation = nil
        waiting = true; failed = false; ordersRecovery = false
        web.isHidden = true; loading.isHidden = false; retry.isHidden = true
        status.text = "正在连接体育中心…"; spinner.startAnimating()
        let generation = attempt
        let task = DispatchWorkItem { [weak self] in
            guard let self, self.attempt == generation, self.waiting else { return }
            self.fail("体育中心连接超时，请检查网络。")
        }
        deadline = task; DispatchQueue.main.asyncAfter(deadline:.now()+20,execute:task)
    }
    private func reveal() {
        deadline?.cancel(); waiting = false; failed = false
        spinner.stopAnimating(); loading.isHidden = true; web.isHidden = false
        updateNavigation()
    }
    private func fail(_ message:String) {
        deadline?.cancel(); waiting = false; failed = true
        ordersRecovery = paying || uncertainWrite
        spinner.stopAnimating(); loading.isHidden = false; web.isHidden = true; retry.isHidden = false
        status.text = ordersRecovery ? "提交或支付状态暂时无法核实。\n请先查看“我的订单”，避免重复提交或付款。" : message
        retry.setTitle(ordersRecovery ? "查看我的订单" : "重新连接",for:.normal)
        UIAccessibility.post(notification:.announcement,argument:status.text)
    }
    private func loadSection(_ index:Int) {
        guard SportsNavigation.sections.indices.contains(index) else { return }
        web.stopLoading()
        for page in previousWindows { page.stopLoading(); page.navigationDelegate = nil; page.uiDelegate = nil }
        previousWindows.removeAll()
        uncertainWrite = false; currentTarget = SportsNavigation.sections[index]; retryURL = currentTarget!
        beginLoading(); activeNavigation = web.load(URLRequest(url:retryURL))
    }
    @objc private func recover() { loadSection(ordersRecovery ? 1 : SportsNavigation.section(retryURL)) }
    @objc private func refresh() {
        if paying || uncertainWrite || ordersRecovery {
            let alert = UIAlertController(title:"先核对订单状态",message:"支付或提交页面不自动重试，请在“我的订单”确认当前状态。",preferredStyle:.alert)
            alert.addAction(UIAlertAction(title:"继续查看",style:.cancel))
            alert.addAction(UIAlertAction(title:"我的订单",style:.default) { [weak self] _ in self?.loadSection(1) })
            present(alert,animated:true)
        } else { loadSection(SportsNavigation.section(retryURL)) }
    }
    private func leavePayment(_ action:@escaping () -> Void) {
        guard paying else { action(); return }
        let alert = UIAlertController(title:"离开支付页面？",message:"支付结果请在“我的订单”中查看。",preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:"继续支付",style:.cancel))
        alert.addAction(UIAlertAction(title:"离开",style:.default) { _ in action() })
        present(alert,animated:true)
    }
    @objc private func close() { leavePayment { [weak self] in self?.dismiss(animated:true) } }
    @objc private func back() {
        leavePayment { [weak self] in
            guard let self else { return }
            if self.web.canGoBack { self.web.goBack() } else { self.restoreWindow() }
        }
    }
    func tabBar(_ tabBar:UITabBar,didSelect item:UITabBarItem) {
        updateNavigation()
        leavePayment { [weak self] in self?.loadSection(item.tag) }
    }
    private func restoreWindow() {
        guard let previous = previousWindows.popLast() else { return }
        web.stopLoading(); web.navigationDelegate = nil; web.uiDelegate = nil; web.removeFromSuperview()
        deadline?.cancel(); attempt += 1
        web = previous; currentTarget = previous.url; uncertainWrite = false
        activeNavigation = nil
        attach(previous); reveal(); applyAppearance()
    }
    private func applyAppearance() {
        let mode = UserDefaults.standard.string(forKey:"appearance") ?? "system"
        overrideUserInterfaceStyle = mode == "dark" ? .dark : mode == "light" ? .light : .unspecified
        let palette = CampusPalette(key:UserDefaults.standard.string(forKey:"theme") ?? "blue",dark:traitCollection.userInterfaceStyle == .dark)
        view.backgroundColor = palette.paper; web?.backgroundColor = palette.paper
        status.textColor = palette.ink; retry.tintColor = palette.primary
        let appearance = UINavigationBarAppearance(); appearance.configureWithDefaultBackground(); appearance.backgroundColor = palette.paper
        appearance.titleTextAttributes = [.foregroundColor:palette.ink]
        navigationItem.standardAppearance = appearance; navigationItem.scrollEdgeAppearance = appearance
        navigationController?.navigationBar.tintColor = palette.dark ? palette.ink : palette.primary
        let bar = UITabBarAppearance(); bar.configureWithDefaultBackground()
        tabs.standardAppearance = bar; tabs.scrollEdgeAppearance = bar; tabs.isTranslucent = true
        tabs.tintColor = palette.dark ? palette.ink : palette.primary
        if let web { skin(web) { } }
    }
    private func skin(_ page:WKWebView,completion:@escaping () -> Void) {
        guard SportsNavigation.official(page.url),let data = try? JSONSerialization.data(withJSONObject:[css]),let encoded = String(data:data,encoding:.utf8) else { completion(); return }
        let palette = CampusPalette(key:UserDefaults.standard.string(forKey:"theme") ?? "blue",dark:traitCollection.userInterfaceStyle == .dark)
        let primary = CampusPalette.colors[palette.key]?[0] ?? 0x172E61
        // Darken the light theme's primary by 10%; all nine palettes exceed 4.5:1 on sports cards.
        let accent = [16,8,0].reduce(UInt32(0)) { value,shift in value | (UInt32((Double((primary >> shift)&255)*0.9).rounded()) << shift) }
        let lightAccent = String(format:"#%06x",accent)
        let script = "if(location.protocol==='https:'&&location.hostname==='\(SportsNavigation.host)'&&(location.pathname==='/website'||location.pathname.startsWith('/website/'))){" + palette.script + "(()=>{let s=document.getElementById('ams-sports-theme');if(!s){s=document.createElement('style');s.id='ams-sports-theme';document.head.append(s)}s.textContent=\(encoded)[0];document.documentElement.style.setProperty('--sports-muted','\(palette.dark ? "#a4afbf" : "#596476")');document.documentElement.style.setProperty('--sports-accent','\(palette.dark ? "var(--campus-accent)" : lightAccent)');})();" + presentation + "}"
        page.evaluateJavaScript(script) { _,_ in completion() }
    }
    func webView(_ page:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping (WKNavigationActionPolicy)->Void) {
        guard page === web, let url = action.request.url else { decisionHandler(.cancel); return }
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-sports-offline"),url.isFileURL,url.lastPathComponent == "sports-fixture.html" { decisionHandler(.allow); return }
        #endif
        // Frames cannot launch applications or navigate to arbitrary external sites.
        if let target = action.targetFrame, !target.isMainFrame {
            decisionHandler(SportsNavigation.trusted(url) ? .allow : .cancel); return
        }
        if url.absoluteString == "about:blank", !previousWindows.isEmpty, page.url == nil || page.url?.absoluteString == "about:blank" {
            decisionHandler(.allow); return
        }
        if SportsNavigation.trusted(url) {
            var target = URLComponents(url:url,resolvingAgainstBaseURL:false); target?.fragment = nil
            var current = page.url.flatMap { URLComponents(url:$0,resolvingAgainstBaseURL:false) }; current?.fragment = nil
            if target?.url == current?.url, action.request.httpMethod == nil || action.request.httpMethod == "GET", action.navigationType != .reload {
                decisionHandler(.allow); return
            }
            if !waiting { beginLoading() }
            currentTarget = url
            uncertainWrite = uncertainWrite || !["GET","HEAD"].contains(action.request.httpMethod ?? "GET")
            if SportsNavigation.official(url) { retryURL = SportsNavigation.safeRetry(url) }
            decisionHandler(.allow); return
        }
        decisionHandler(.cancel)
        let emptyPopup = !previousWindows.isEmpty && (page.url == nil || page.url?.absoluteString == "about:blank")
        let source = emptyPopup ? previousWindows.last?.url : action.sourceFrame.request.url
        guard action.sourceFrame.isMainFrame, SportsNavigation.trusted(source) else { return }
        if SportsNavigation.paymentApp(url) {
            guard UIApplication.shared.applicationState == .active else { return }
            UIApplication.shared.open(url,options:[:]) { [weak self] opened in
                if !opened { self?.notice("未能打开支付应用",message:"请确认已安装对应应用，或返回官方页面选择其他支付方式。") }
            }
            if emptyPopup { restoreWindow() }
            // Keep the actual page and POST in place. Returning never means payment success.
        } else if action.navigationType == .linkActivated, SportsNavigation.official(source), SportsNavigation.secure(url),url.host != nil {
            let alert = UIAlertController(title:"在浏览器打开？",message:url.host,preferredStyle:.alert)
            alert.addAction(UIAlertAction(title:"取消",style:.cancel))
            alert.addAction(UIAlertAction(title:"打开",style:.default) { _ in UIApplication.shared.open(url) })
            present(alert,animated:true)
        } else { notice("暂不支持此跳转",message:"请返回体育中心页面继续操作。") }
    }
    func webView(_ page:WKWebView,decidePolicyFor response:WKNavigationResponse,decisionHandler:@escaping (WKNavigationResponsePolicy)->Void) {
        if page === web,response.isForMainFrame,let http = response.response as? HTTPURLResponse,http.statusCode >= 400 {
            decisionHandler(.cancel); fail("体育中心暂时无法连接，请稍后重试。"); return
        }
        decisionHandler(.allow)
    }
    func webView(_ page:WKWebView,didStartProvisionalNavigation navigation:WKNavigation!) {
        guard page === web else { return }
        if !waiting { beginLoading() }
        activeNavigation = navigation
    }
    func webView(_ page:WKWebView,didFinish navigation:WKNavigation!) {
        guard page === web,navigation === activeNavigation,!failed,page.url?.absoluteString != "about:blank" else { return }
        let generation = attempt
        skin(page) { [weak self,weak page] in
            guard let self,let page,page === self.web,self.attempt == generation,!self.failed else { return }
            self.uncertainWrite = false; self.reveal()
        }
    }
    func webView(_ page:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error) {
        guard page === web,navigation === activeNavigation else { return }
        let failure = error as NSError
        if failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled { return }
        fail("体育中心页面加载失败，请检查网络后重试。")
    }
    func webView(_ page:WKWebView,didFail navigation:WKNavigation!,withError error:Error) { webView(page,didFailProvisionalNavigation:navigation,withError:error) }
    func webViewWebContentProcessDidTerminate(_ page:WKWebView) { if page === web { fail("页面进程已停止，请重新连接。") } }
    func webView(_ page:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for action:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView? {
        guard page === web,action.targetFrame == nil, SportsNavigation.trusted(page.url),
              let url = action.request.url,(SportsNavigation.trusted(url) || url.absoluteString == "about:blank"),UIApplication.shared.applicationState == .active else { return nil }
        // Returning a real WebView preserves target=_blank form bodies and WebKit's opener.
        let popup = makeWebView(configuration)
        previousWindows.append(web); web.removeFromSuperview(); web = popup
        currentTarget = url; uncertainWrite = !["GET","HEAD"].contains(action.request.httpMethod ?? "GET")
        attach(popup); beginLoading(); return popup
    }
    func webViewDidClose(_ page:WKWebView) { if page === web { restoreWindow() } }
    private func notice(_ title:String,message:String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title:title,message:message,preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:"知道了",style:.default)); present(alert,animated:true)
    }
    func webView(_ page:WKWebView,runJavaScriptAlertPanelWithMessage message:String,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping ()->Void) {
        guard page === web,presentedViewController == nil else { completionHandler(); return }
        let alert = UIAlertController(title:"体育中心",message:message,preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:"确定",style:.default) { _ in completionHandler() }); present(alert,animated:true)
    }
    func webView(_ page:WKWebView,runJavaScriptConfirmPanelWithMessage message:String,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping (Bool)->Void) {
        guard page === web,presentedViewController == nil else { completionHandler(false); return }
        let alert = UIAlertController(title:"体育中心",message:message,preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:"取消",style:.cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title:"确定",style:.default) { _ in completionHandler(true) }); present(alert,animated:true)
    }
    deinit { deadline?.cancel() }
}
