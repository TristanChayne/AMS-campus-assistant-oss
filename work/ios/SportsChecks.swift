// Appended only to a disposable app copy by prepare-sports-checks.py.
#if DEBUG
private final class SportsFixture: NSObject, WKURLSchemeHandler {
    var posted = false
    var bodyReceived = false
    func webView(_ webView:WKWebView,start task:WKURLSchemeTask) {
        let request = task.request
        if request.httpMethod == "POST" {
            posted = true
            bodyReceived = request.httpBody?.isEmpty == false || request.httpBodyStream != nil
        }
        let html = """
        <!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action ams-sports-fixture:;">
        <style>body{margin:0;padding:20px;font:16px -apple-system;background:#f5f6f8;color:#17233a}h1{font-size:24px}.notice{color:#805064}.projects{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}button{font:inherit;min-height:44px;border-radius:10px;border:1px solid #ddd;background:white}input{min-height:44px;max-width:100%}</style>
        <p class="notice">离线测试 · 虚构页面 · 不连接学校或支付</p><h1>体育馆预约</h1>
        <div class="projects"><button>羽毛球</button><button>篮球</button><button>乒乓球</button><button>游泳</button></div>
        <p>本页仅检查原生导航、键盘和支付弹窗传输。</p>
        <input placeholder="键盘测试，不填写真实信息">
        <form id="transport" action="ams-sports-fixture://local/popup" method="post" target="sports-payment-fixture"><input type="hidden" name="synthetic" value="NOT-A-REAL-ORDER"><button>测试弹窗传输</button></form>
        </html>
        """
        let data = Data(html.utf8)
        task.didReceive(URLResponse(url:request.url!,mimeType:"text/html",expectedContentLength:data.count,textEncodingName:"utf-8"))
        task.didReceive(data); task.didFinish()
    }
    func webView(_ webView:WKWebView,stop task:WKURLSchemeTask) { }
}

private func sportsFixtureTrusted(_ url:URL?) -> Bool { url?.scheme == "ams-sports-fixture" || SportsNavigation.trusted(url) }

extension SportsController {
    private func runSportsChecks(_ fixture:SportsFixture) {
        var checks:[String:Bool] = [:]
        checks["initialPageVisible"] = !web.isHidden && loading.isHidden
        checks["nativeThreeSections"] = tabs.items?.map(\.title) == ["场馆预约","我的订单","我的票券"]
        checks["rootHasCloseNoHistoryBack"] = navigationItem.rightBarButtonItems?.count == 2 && navigationItem.leftBarButtonItem == nil
        checks["nativeTabHeightFits"] = tabs.bounds.height >= tabs.sizeThatFits(CGSize(width:view.bounds.width,height:0)).height
        checks["nativeTabUsesSystemMaterial"] = tabs.isTranslucent && tabs.standardAppearance.backgroundColor == nil
        checks["pageExtendsBehindTab"] = web.frame.maxY >= tabs.frame.maxY
        checks["bottomControlsRemainScrollable"] = web.scrollView.contentInset.bottom >= tabs.bounds.height
        let parent = web!
        let store = parent.configuration.websiteDataStore
        parent.evaluateJavaScript("window.open('ams-sports-fixture://local/popup','sports-payment-fixture');document.getElementById('transport').submit()") { [weak self] _,_ in
            DispatchQueue.main.asyncAfter(deadline:.now()+2) {
                guard let self else { return }
                checks["popupPreserved"] = self.previousWindows.count == 1 && self.web !== parent
                checks["popupSharesDataStore"] = self.web.configuration.websiteDataStore === store
                checks["popupPostNotConvertedToGet"] = fixture.posted
                checks["popupBodyTransported"] = fixture.bodyReceived
                self.restoreWindow()
                checks["popupCloseRestoresParent"] = self.web === parent && self.previousWindows.isEmpty && !self.web.isHidden
                self.beginLoading(); let generation = self.attempt
                self.webView(self.web,didFailProvisionalNavigation:self.activeNavigation,withError:NSError(domain:NSURLErrorDomain,code:NSURLErrorCancelled))
                checks["cancelledNavigationIgnored"] = self.waiting && !self.failed && self.attempt == generation
                let other = WKWebView(frame:.zero)
                self.webView(other,didFailProvisionalNavigation:nil,withError:URLError(.cannotFindHost))
                checks["otherWindowFailureIgnored"] = self.waiting && !self.failed
                self.currentTarget = SportsNavigation.sections[0]; self.uncertainWrite = false
                self.fail("模拟 DNS 失败")
                checks["networkFailureRecoverable"] = self.failed && !self.retry.isHidden && !self.spinner.isAnimating && !self.ordersRecovery
                self.currentTarget = URL(string:"https://sportscentre.xipueduinno.cn/website/pay")!
                self.fail("模拟支付错误")
                checks["paymentFailureChecksOrders"] = self.ordersRecovery && self.retry.title(for:.normal) == "查看我的订单"
                self.currentTarget = SportsNavigation.sections[0]; self.uncertainWrite = true
                self.fail("模拟提交错误")
                checks["postFailureChecksOrders"] = self.ordersRecovery
                self.uncertainWrite = false; self.currentTarget = SportsNavigation.sections[0]
                self.webViewWebContentProcessDidTerminate(self.web)
                checks["terminatedProcessRecoverable"] = self.failed && !self.retry.isHidden
                self.web.stopLoading(); self.beginLoading()
                DispatchQueue.main.asyncAfter(deadline:.now()+21) {
                    checks["real20SecondDeadline"] = self.failed && !self.spinner.isAnimating && !self.retry.isHidden
                    if let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first,let data = try? JSONSerialization.data(withJSONObject:checks,options:.sortedKeys) {
                        try? data.write(to:directory.appendingPathComponent("sports-checks.json"))
                    }
                }
            }
        }
    }
}
#endif
