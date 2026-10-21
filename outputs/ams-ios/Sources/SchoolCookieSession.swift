import Foundation
import WebKit

// Preserve the school's cookie scope and expiration; the server still validates the session.
enum SchoolCookieSession {
    private static let account = "schoolCookieSession"
    private static var restoring = false, restored = false
    private static var waiters: [()->Void] = []
    private static var generation = 0
    private static func school(_ cookie:HTTPCookie) -> Bool {
        let domain = cookie.domain.hasPrefix(".") ? String(cookie.domain.dropFirst()) : cookie.domain
        return domain == "xjtlu.edu.cn" || domain.hasSuffix(".xjtlu.edu.cn")
    }
    static func encode(_ cookies:[HTTPCookie]) -> String {
        let properties = cookies.filter { school($0) && ($0.expiresDate.map{$0 > Date()} ?? true) }.compactMap { cookie -> [String:Any]? in
            guard let source = cookie.properties else { return nil }
            var result:[String:Any] = [:]
            for (key,value) in source {
                if value is String || value is NSNumber || value is Date { result[key.rawValue] = value }
                else if let url = value as? URL { result[key.rawValue] = url.absoluteString }
            }
            // Reconstructing Max-Age would restart its lifetime. Keep the original deadline.
            result.removeValue(forKey:HTTPCookiePropertyKey.maximumAge.rawValue)
            if let expires = cookie.expiresDate { result[HTTPCookiePropertyKey.expires.rawValue] = expires }
            return result
        }
        guard let data = try? PropertyListSerialization.data(fromPropertyList:properties,format:.binary,options:0) else { return "" }
        return data.base64EncodedString()
    }
    static func decode(_ encoded:String) -> [HTTPCookie] {
        guard let data = Data(base64Encoded:encoded),let list = (try? PropertyListSerialization.propertyList(from:data,options:[],format:nil)) as? [[String:Any]] else { return [] }
        return list.compactMap { item in
            var properties:[HTTPCookiePropertyKey:Any] = [:]
            for (key,value) in item { properties[HTTPCookiePropertyKey(key)] = value }
            guard let cookie = HTTPCookie(properties:properties),school(cookie),cookie.expiresDate.map({$0 > Date()}) ?? true else { return nil }
            return cookie
        }
    }
    static func restore(_ completion:@escaping ()->Void) {
        if restored { completion(); return }
        waiters.append(completion)
        guard !restoring else { return }; restoring = true
        let group = DispatchGroup(),epoch = generation
        for cookie in decode(KeychainStore.read(account)) {
            group.enter(); WKWebsiteDataStore.default().httpCookieStore.setCookie(cookie) { group.leave() }
        }
        group.notify(queue:.main) {
            guard generation == epoch else { return }
            restored = true; restoring = false
            let pending = waiters; waiters.removeAll(); pending.forEach{$0()}
        }
    }
    static func save() {
        guard restored else { return }
        let epoch = generation
        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
            guard generation == epoch else { return }
            KeychainStore.save(encode(cookies),account:account)
        }
    }
    static func clear() {
        generation += 1; KeychainStore.save("",account:account)
        restored = true; restoring = false
        let pending = waiters; waiters.removeAll(); pending.forEach{$0()}
    }
}
