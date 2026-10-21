import Foundation

/// Main-frame policy only. The official service owns authentication and transactions.
enum SportsNavigation {
    static let host = "sportscentre.xipueduinno.cn"
    static let sections = ["court", "order#/", "member#/ticket"].map { URL(string:"https://\(host)/website/\($0)")! }

    static func secure(_ url:URL) -> Bool {
        url.scheme?.lowercased() == "https" && url.user == nil && url.password == nil && (url.port == nil || url.port == 443)
    }
    static func official(_ url:URL?) -> Bool {
        guard let url, secure(url), url.host?.lowercased() == host,
              let raw = URLComponents(url:url,resolvingAgainstBaseURL:false)?.percentEncodedPath,
              let path = raw.removingPercentEncoding else { return false }
        // Reject encoded separators, nested escapes and dot segments before allowing navigation.
        for segment in raw.split(separator:"/",omittingEmptySubsequences:false) {
            guard let decoded = String(segment).removingPercentEncoding,
                  ![".",".."].contains(decoded),
                  !decoded.contains(where:{ "/\\%?#".contains($0) || $0.isASCII && $0.asciiValue! < 32 || $0.asciiValue == 127 }) else { return false }
        }
        return !path.contains("//") && (path == "/website" || path.hasPrefix("/website/"))
    }
    static func payment(_ url:URL?) -> Bool {
        guard let url, secure(url), let host = url.host?.lowercased() else { return false }
        return ["wx.tenpay.com","payapp.weixin.qq.com","alipay.com"].contains(host) || host.hasSuffix(".alipay.com")
    }
    static func trusted(_ url:URL?) -> Bool { official(url) || payment(url) }
    static func paymentApp(_ url:URL) -> Bool {
        guard url.user == nil, url.password == nil, url.port == nil, url.fragment == nil,
              let path = URLComponents(url:url,resolvingAgainstBaseURL:false)?.percentEncodedPath else { return false }
        return (url.scheme?.lowercased() == "weixin" && url.host?.lowercased() == "wap" && path == "/pay")
            || (["alipays","alipay"].contains(url.scheme?.lowercased() ?? "") && url.host?.lowercased() == "platformapi" && path == "/startapp")
    }
    static func paying(_ url:URL?) -> Bool { payment(url) || official(url) && url?.path == "/website/pay" }
    static func section(_ url:URL?) -> Int { url?.path == "/website/order" ? 1 : url?.path == "/website/member" ? 2 : 0 }
    static func safeRetry(_ url:URL?) -> URL {
        guard official(url), url?.query == nil else { return sections[0] }
        return sections[section(url)]
    }
}
