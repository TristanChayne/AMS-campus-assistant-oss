// Append to a disposable CampusController.swift so checks exercise its real private methods.
// Launch that isolated app with --test-design --test-loading-regression; no school requests.
#if DEBUG
extension CampusController {
    func runLoadingRegressionChecks() {
        web.navigationDelegate = nil; web.stopLoading(); preloader.discardUnused(keeping:nil)
        var checks:[String:Bool] = [:]
        var completed = 0
        preparationResult = { _ in completed += 1 }
        loadingState = .ready; beginLoading()
        checks["startsWaiting"] = loadingState == .waiting && loadingSpinner.isAnimating && retry.isHidden
        let attempt = loadingAttempt
        beginLoading(); checks["waitingDoesNotResetDeadline"] = loadingAttempt == attempt
        webView(WKWebView(),didFailProvisionalNavigation:nil,withError:URLError(.cannotFindHost))
        checks["chromeFailureIgnored"] = loadingState == .waiting && completed == 0
        webView(web,didFailProvisionalNavigation:nil,withError:URLError(.cancelled))
        checks["cancelledNavigationIgnored"] = loadingState == .waiting
        webView(web,didFailProvisionalNavigation:nil,withError:URLError(.cannotFindHost))
        checks["dnsFailureRecoverable"] = loadingState == .failed && !loadingSpinner.isAnimating && !retry.isHidden && !loading.isHidden && loadingText.text?.contains("解析") == true && completed == 1
        webViewWebContentProcessDidTerminate(web)
        checks["terminatedProcessRecoverable"] = loadingText.text?.contains("进程") == true && !retry.isHidden
        web.evaluateJavaScript("window.__amsLoadingDiagnostics=()=> 'resources'") { [weak self] _,_ in
            guard let self else { return }
            self.beginLoading(); self.loadingTimedOut()
            checks["timeoutShowsFallbackImmediately"] = self.loadingState == .failed && !self.retry.isHidden && !self.loadingSpinner.isAnimating
            DispatchQueue.main.asyncAfter(deadline:.now()+0.5) {
                checks["resourceFailureClassified"] = self.loadingText.text?.contains("脚本或样式") == true
                self.beginLoading(); self.loadingTimedOut(); self.reload()
                let retryAttempt = self.loadingAttempt
                DispatchQueue.main.asyncAfter(deadline:.now()+0.5) {
                    checks["staleDiagnosticsCannotOverwriteRetry"] = self.loadingAttempt == retryAttempt && self.loadingState == .waiting && self.loadingSpinner.isAnimating && self.retry.isHidden
                    // Exercise the real 20-second dispatch deadline with a non-responsive page.
                    // The reloaded anonymous fixture must not finish via its normal chrome/ready bridge.
                    self.web.stopLoading()
                    self.web.configuration.userContentController.removeScriptMessageHandler(forName:"amsChrome")
                    self.web.configuration.userContentController.removeScriptMessageHandler(forName:"amsReady")
                    self.loadingState = .failed; self.beginLoading()
                    DispatchQueue.main.asyncAfter(deadline:.now()+21) {
                        checks["real20SecondTimeout"] = self.loadingState == .failed && !self.retry.isHidden && !self.loadingSpinner.isAnimating && !self.loading.isHidden
                        if let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first,
                           let data = try? JSONSerialization.data(withJSONObject:checks,options:.sortedKeys) {
                            try? data.write(to:directory.appendingPathComponent("loading-checks.json"))
                        }
                    }
                }
            }
        }
    }
}
#endif
