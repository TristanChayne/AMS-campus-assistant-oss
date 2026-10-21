package cn.local.ams;

public final class SportsNavigationChecks {
    private static void expect(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        for (String path : new String[]{"court", "order#/", "order#/detail?tradeId=TEST", "member#/ticket", "login", "pay?tradeId=TEST", "paySuccess"})
            expect(SportsNavigation.official("https://sportscentre.xipueduinno.cn/website/" + path), path);
        expect(SportsNavigation.official("HTTPS://SPORTSCENTRE.XIPUEDUINNO.CN:443/website/court"), "case and default HTTPS port");
        expect(SportsNavigation.official("https://sportscentre.xipueduinno.cn/website/%63ourt"), "encoded unreserved character in official route");
        expect(SportsNavigation.official("https://sportscentre.xipueduinno.cn/website/%E4%BD%93%E8%82%B2"), "UTF-8 encoded official path segment");
        expect(SportsNavigation.official("https://sportscentre.xipueduinno.cn/website/ord%65r#/detail?tradeId=TEST"), "encoded order route with fragment and query");

        for (String url : new String[]{
            "http://sportscentre.xipueduinno.cn/website/court",
            "https://sportscentre.xipueduinno.cn.evil.test/website/court",
            "https://court.sportscentre.xipueduinno.cn/website/court",
            "https://evil.test/website/court",
            "https://sportscentre.xipueduinno.cn@evil.test/website/court",
            "https://user@sportscentre.xipueduinno.cn/website/court",
            "https://sportscentre.xipueduinno.cn:444/website/court",
            "https://sportscentre.xipueduinno.cn/website-other",
            "https://sportscentre.xipueduinno.cn/website/court/../admin",
            "https://sportscentre.xipueduinno.cn/website/%2e%2e/admin",
            "https://sportscentre.xipueduinno.cn/website/%2E%2E/admin",
            "https://sportscentre.xipueduinno.cn/website/%2e./admin",
            "https://sportscentre.xipueduinno.cn/website%2fcourt",
            "https://sportscentre.xipueduinno.cn/website/%2Fadmin",
            "https://sportscentre.xipueduinno.cn/website/%5Cadmin",
            "https://sportscentre.xipueduinno.cn/website/%252e%252e/admin",
            "https://sportscentre.xipueduinno.cn/website/%3Fadmin",
            "https://sportscentre.xipueduinno.cn/website/%23admin",
            "https://sportscentre.xipueduinno.cn/website/%00admin",
            "https://sportscentre.xipueduinno.cn/website/%E4%ZZ",
            "https://sportscentre.xipueduinno.cn/website//court/admin",
            "file:///website/court",
            "javascript:alert(1)"
        }) expect(!SportsNavigation.official(url), "Rejected official route: " + url);

        for (String url : new String[]{
            "https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=TEST",
            "https://payapp.weixin.qq.com/",
            "https://mapi.alipay.com/gateway.do",
            "https://alipay.com/"
        }) expect(SportsNavigation.payment(url), "Allowed payment host: " + url);
        expect(SportsNavigation.trusted("https://mapi.alipay.com/gateway.do"), "Known payment transition remains trusted");
        for (String url : new String[]{
            "https://wx.tenpay.com.evil.test/",
            "https://evil.test/wx.tenpay.com/",
            "https://alipay.com.evil.test/gateway.do",
            "https://evil.alipay.com.evil.test/gateway.do",
            "https://notalipay.com/gateway.do",
            "https://alipay.com@evil.test/gateway.do",
            "http://wx.tenpay.com/",
            "https://user@wx.tenpay.com/",
            "https://wx.tenpay.com:444/"
        }) expect(!SportsNavigation.payment(url), "Rejected payment route: " + url);

        expect(SportsNavigation.app("weixin://wap/pay?prepayid=TEST"), "WeChat pay route");
        expect(SportsNavigation.app("alipays://platformapi/startapp?appId=TEST"), "Alipay start route");
        for (String url : new String[]{
            "intent://x#Intent;scheme=alipays;end",
            "weixin://scanqrcode/",
            "weixin://other/pay?prepayid=TEST",
            "weixin://wap/scanqrcode",
            "weixin://wap:80/pay?prepayid=TEST",
            "weixin://user@wap/pay?prepayid=TEST",
            "weixin://wap/%70ay?prepayid=TEST",
            "weixin://wap/pay#fragment",
            "alipays://other/startapp?appId=TEST",
            "alipays://platformapi/login",
            "file:///etc/test",
            "javascript:alert(1)",
            "ams-local://logout"
        }) expect(!SportsNavigation.app(url), "Rejected app route: " + url);

        String official = "https://sportscentre.xipueduinno.cn/website/court";
        expect(SportsNavigation.externalHttpsPrompt(official, "https://example.edu/info", true), "Gesture-gated external HTTPS");
        expect(!SportsNavigation.externalHttpsPrompt(official, "https://example.edu/info", false), "External HTTPS requires a user gesture");
        expect(!SportsNavigation.externalHttpsPrompt("https://evil.test/", "https://example.edu/info", true), "External HTTPS requires official source");
        expect(!SportsNavigation.externalHttpsPrompt(official, "http://example.edu/", true), "No HTTP downgrade prompt");
        expect(!SportsNavigation.externalHttpsPrompt(official, "https://user@example.edu/", true), "No external URL userinfo");
        expect(!SportsNavigation.externalHttpsPrompt(official, "https://example.edu:444/", true), "No nonstandard external port");

        expect(SportsNavigation.safeRetryUrl(official).endsWith("/website/court"), "Safe court retry");
        expect(SportsNavigation.safeRetryUrl("https://sportscentre.xipueduinno.cn/website/order#/detail?tradeId=TEST").endsWith("/website/order#/"), "Safe order retry drops detail and identifiers");
        expect(SportsNavigation.safeRetryUrl("https://sportscentre.xipueduinno.cn/website/ord%65r#/detail?tradeId=TEST").endsWith("/website/order#/"), "Encoded order route canonicalizes to safe order root");
        expect(SportsNavigation.safeRetryUrl("https://sportscentre.xipueduinno.cn/website/member#/ticket").endsWith("/website/member#/ticket"), "Safe ticket retry");
        expect(SportsNavigation.safeRetryUrl("https://sportscentre.xipueduinno.cn/website/pay?tradeId=TEST").endsWith("/website/court"), "Payment failure never retries payment URL");
        expect(SportsNavigation.safeRetryUrl("https://sportscentre.xipueduinno.cn/website/order/cancelPay?tradeId=TEST").endsWith("/website/court"), "Mutating endpoint is never a retry target");
        expect(SportsNavigation.safeRetryUrl("https://evil.test/").endsWith("/website/court"), "Untrusted failure falls back to a safe page");
        expect(!SportsNavigation.official(null) && !SportsNavigation.payment(null) && !SportsNavigation.app(null), "Missing source");
        System.out.println("PASS HTTPS host/path parsing, encoded path rejection, payment and app route allowlists, gesture-gated external links, safe retry targets.");
    }
}
