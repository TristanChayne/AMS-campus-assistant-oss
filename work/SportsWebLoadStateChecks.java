package cn.local.ams;

public final class SportsWebLoadStateChecks {
    private static final String COURT = "https://sportscentre.xipueduinno.cn/website/court";
    private static final String ORDER = "https://sportscentre.xipueduinno.cn/website/order#/";
    private static final String MEMBER = "https://sportscentre.xipueduinno.cn/website/member#/ticket";

    private static void expect(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void expectDisplay(SportsWebLoadState state, SportsWebLoadState.Display display, String message) {
        expect(state.display() == display, message + ": " + state.display());
    }

    public static void main(String[] args) {
        SportsWebLoadState ssl = new SportsWebLoadState();
        ssl.beginNavigation(COURT);
        ssl.onPageStarted(COURT);
        expect(!ssl.shouldFailForSsl(COURT + ".css", COURT), "Subresource SSL error must not fail a pending document");
        expectDisplay(ssl, SportsWebLoadState.Display.LOADING, "Subresource SSL error keeps the page loading");
        expect(ssl.shouldFailForSsl(COURT, COURT), "A certificate error for the pending main document must be identified");
        expect(ssl.failMainDocument(COURT), "Main document SSL failure transitions to error");
        expectDisplay(ssl, SportsWebLoadState.Display.ERROR, "Main document SSL failure shows the error state");
        expect(!ssl.markCommitted(COURT), "A failed main document cannot be committed afterward");

        SportsWebLoadState normal = new SportsWebLoadState();
        long normalId = normal.beginNavigation(COURT + "#/today");
        normal.onPageStarted(COURT);
        expect(normal.markCommitted(COURT), "Normal main document commit is accepted despite a fragment");
        expectDisplay(normal, SportsWebLoadState.Display.LOADING, "Commit alone does not reveal pre-injection content");
        expect(!normal.beginVisualPreparation(COURT), "Commit-visible alone waits for linked resources and page finish");
        expect(normal.markFinished(COURT), "Main page finish is recorded");
        expect(normal.isReadyForVisualPreparation(COURT), "Commit and page finish make visual preparation eligible");
        expect(normal.beginVisualPreparation(COURT), "Visual preparation starts once");
        expect(!normal.beginVisualPreparation(COURT), "Duplicate callbacks do not start injection twice");
        expect(normal.markVisualReady(normalId, COURT), "Visual state callback releases the current page");
        expectDisplay(normal, SportsWebLoadState.Display.CONTENT, "Normal page becomes visible only after visual readiness");

        expect(SportsWebLoadState.isMainHttpError(true, 404), "Main-frame 404 is a failure");
        expect(SportsWebLoadState.isMainHttpError(true, 500), "Main-frame 500 is a failure");
        expect(!SportsWebLoadState.isMainHttpError(false, 500), "Subresource 500 is not a page failure");
        expect(!SportsWebLoadState.isMainHttpError(true, 200), "Successful main response is not a failure");
        SportsWebLoadState http = new SportsWebLoadState();
        http.beginNavigation(ORDER);
        http.onPageStarted("https://sportscentre.xipueduinno.cn/website/order");
        expect(!http.failMainDocument("https://sportscentre.xipueduinno.cn/website/court"), "Stale HTTP failure cannot replace a newer main route");
        expect(http.failMainDocument("https://sportscentre.xipueduinno.cn/website/order"), "Matching main 404/500 response transitions to error");
        expectDisplay(http, SportsWebLoadState.Display.ERROR, "Main HTTP failure stays in error state");
        SportsWebLoadState redirectedHttp = new SportsWebLoadState();
        redirectedHttp.beginNavigation(COURT);
        expect(redirectedHttp.failMainDocument("https://sportscentre.xipueduinno.cn/website/login", "https://sportscentre.xipueduinno.cn/website/login"), "Current redirected main HTTP error is identified by WebView URL");

        SportsWebLoadState sequence = new SportsWebLoadState();
        long first = sequence.beginNavigation(COURT);
        sequence.onPageStarted(COURT);
        long second = sequence.beginNavigation(ORDER);
        expect(second > first, "A later route gets a newer generation");
        expect(!sequence.markCommitted(COURT), "Stale page commit is ignored after a tab switch");
        expect(!sequence.markVisualReady(first, COURT), "Stale visual callback is ignored after a tab switch");
        expect(!sequence.failMainDocument(COURT), "Stale main error cannot hide the selected tab");
        expect(sequence.markCommitted("https://sportscentre.xipueduinno.cn/website/order"), "Current order route commits");
        expect(sequence.markFinished("https://sportscentre.xipueduinno.cn/website/order"), "Current order route finishes");
        expect(sequence.beginVisualPreparation(ORDER), "Current order route begins injection");
        expect(sequence.markVisualReady(second, ORDER), "Current visual callback is accepted");
        expectDisplay(sequence, SportsWebLoadState.Display.CONTENT, "Current page becomes visible after tab switch");

        SportsWebLoadState reverseCallbacks = new SportsWebLoadState();
        long reverseId = reverseCallbacks.beginNavigation(MEMBER);
        reverseCallbacks.onPageStarted("https://sportscentre.xipueduinno.cn/website/member");
        expect(reverseCallbacks.markFinished("https://sportscentre.xipueduinno.cn/website/member"), "Page finish can arrive before commit notification");
        expect(!reverseCallbacks.beginVisualPreparation(MEMBER), "Finish alone does not reveal a stale page");
        expect(reverseCallbacks.markCommitted("https://sportscentre.xipueduinno.cn/website/member"), "Later commit notification completes the gate");
        expect(reverseCallbacks.beginVisualPreparation(MEMBER), "Both callback orders reach one visual preparation");
        expect(reverseCallbacks.markVisualReady(reverseId, MEMBER), "Reverse-order visual callback is accepted");

        SportsWebLoadState redirect = new SportsWebLoadState();
        long beforeRedirect = redirect.beginNavigation(COURT);
        long afterRedirect = redirect.onPageStarted("https://sportscentre.xipueduinno.cn/website/login");
        expect(afterRedirect > beforeRedirect, "A main-frame redirect invalidates prior callbacks");
        expect(!redirect.shouldFailForSsl(COURT, "https://sportscentre.xipueduinno.cn/website/login"), "A prior route SSL callback is stale after redirect");
        expect(redirect.shouldFailForSsl("https://sportscentre.xipueduinno.cn/website/login", "https://sportscentre.xipueduinno.cn/website/login"), "Current redirected document remains tracked");

        SportsWebLoadState redirectedSsl = new SportsWebLoadState();
        redirectedSsl.beginNavigation(COURT);
        expect(redirectedSsl.shouldFailForSsl("https://sportscentre.xipueduinno.cn/website/login", "https://sportscentre.xipueduinno.cn/website/login"), "Current WebView URL identifies a redirected main document before commit");
        expect(redirectedSsl.failMainDocument("https://sportscentre.xipueduinno.cn/website/login", "https://sportscentre.xipueduinno.cn/website/login"), "Redirected main SSL failure transitions to error");

        SportsWebLoadState committed = new SportsWebLoadState();
        committed.beginNavigation(COURT);
        committed.onPageStarted(COURT);
        committed.markCommitted(COURT);
        expect(!committed.shouldFailForSsl(COURT + ".image", COURT), "Post-commit subresource SSL error does not hide content");
        expect(!committed.shouldFailForSsl(COURT, COURT), "Post-commit SSL callback cannot demote a committed page");

        SportsWebLoadState popup = new SportsWebLoadState();
        popup.beginNavigation(null);
        popup.onPageStarted("https://mapi.alipay.com/gateway.do");
        expect(popup.shouldFailForSsl("https://mapi.alipay.com/gateway.do", "https://mapi.alipay.com/gateway.do"), "Popup main-document SSL failure is tracked independently");
        expectDisplay(normal, SportsWebLoadState.Display.CONTENT, "Popup failure state does not affect the previous WebView");
        System.out.println("PASS main/subresource SSL, main-frame HTTP 404/500, normal visual commit, redirects, stale callbacks, tab switches and isolated popup state.");
    }
}
