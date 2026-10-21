#if DEBUG
import Foundation
import WebKit

enum SchoolCookieSessionChecks {
    static func run(saving:Bool) {
        let account = "schoolCookiePersistenceTest"
        func report(_ checks:[String:Bool]) {
            guard let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first,let data = try? JSONSerialization.data(withJSONObject:checks,options:.sortedKeys) else { return }
            try? data.write(to:directory.appendingPathComponent("cookie-persistence-check.json"))
        }
        if saving {
            let properties:[HTTPCookiePropertyKey:Any] = [.domain:"uim.xjtlu.edu.cn",.path:"/__ams_diagnostic__",.name:"AMS_NONAUTH_DIAGNOSTIC",.value:"synthetic-only",.secure:"TRUE",.discard:"TRUE",HTTPCookiePropertyKey("HttpOnly"):"TRUE",HTTPCookiePropertyKey("SameSite"):"Strict"]
            var expiredProperties = properties; expiredProperties[.name] = "AMS_EXPIRED_DIAGNOSTIC"; expiredProperties.removeValue(forKey:.discard); expiredProperties[.maximumAge] = "-60"; expiredProperties[.expires] = Date(timeIntervalSinceNow:-60)
            var unrelatedProperties = properties; unrelatedProperties[.domain] = "example.com"
            var persistentProperties = properties; persistentProperties.removeValue(forKey:.discard); persistentProperties[.name] = "AMS_PERSISTENT_DIAGNOSTIC"; persistentProperties[.maximumAge] = "3600"
            let persistent = HTTPCookie(properties:persistentProperties)!
            let encoded = SchoolCookieSession.encode([HTTPCookie(properties:properties)!,HTTPCookie(properties:expiredProperties)!,HTTPCookie(properties:unrelatedProperties)!,persistent])
            let decoded = SchoolCookieSession.decode(encoded)
            report(["saved":KeychainStore.save(encoded,account:account),"expiredAndUnrelatedExcluded":decoded.count == 2,"expirationNotExtended":decoded.last?.expiresDate == persistent.expiresDate,"sessionOnlyPreserved":decoded.first?.isSessionOnly == true,"securePreserved":decoded.first?.isSecure == true,"httpOnlyPreserved":decoded.first?.isHTTPOnly == true,"scopePreserved":decoded.first?.path == "/__ams_diagnostic__"])
        } else {
            let decoded = SchoolCookieSession.decode(KeychainStore.read(account))
            KeychainStore.save("",account:account)
            guard let cookie = decoded.first else { report(["readAfterTermination":false]); return }
            let store = WKWebsiteDataStore.default().httpCookieStore
            store.setCookie(cookie) {
                store.getAllCookies { cookies in
                    let actual = cookies.first { $0.name == cookie.name && $0.domain == cookie.domain && $0.path == cookie.path }
                    store.delete(cookie) { report(["readAfterTermination":decoded.count == 2,"restoredIntoWebKit":actual != nil,"sessionOnlyPreserved":actual?.isSessionOnly == true,"securePreserved":actual?.isSecure == true,"httpOnlyPreserved":actual?.isHTTPOnly == true,"scopePreserved":actual?.path == cookie.path,"testKeyRemoved":KeychainStore.read(account).isEmpty]) }
                }
            }
        }
    }
}
#endif
