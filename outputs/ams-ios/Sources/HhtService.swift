import Foundation

struct HhtBinding: Codable {
    var mode: String
    var openid: String
    var token: String
    static let empty = HhtBinding(mode:"openid",openid:"",token:"")
}

enum HhtFailure: Error { case expired, service(String), invalid }

private final class HhtConnection: NSObject, URLSessionTaskDelegate {
    lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false; config.httpCookieStorage = nil
        config.timeoutIntervalForRequest = 12
        return URLSession(configuration:config,delegate:self,delegateQueue:nil)
    }()
    func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping (URLRequest?) -> Void) { completionHandler(nil) }
    func close() { session.invalidateAndCancel() }
}

final class HhtService {
    typealias Transport = (URLRequest) async throws -> (Data, URLResponse)
    private let connection = HhtConnection()
    private let transport: Transport?
    init(transport:Transport? = nil) { self.transport = transport }
    deinit { connection.close() }
    func code(for saved:HhtBinding) async throws -> (HhtBinding,[String:Any]) {
        var next = saved
        if next.token.isEmpty { next.token = try await login(next.openid) }
        let data:[String:Any]
        do { data = try await request("/pms/welcome/make-code-info",token:next.token) }
        catch let failure as HhtFailure {
            switch failure {
            case .expired, .service:
                guard !next.openid.isEmpty else { throw failure }
                next.token = try await login(next.openid)
                data = try await request("/pms/welcome/make-code-info",token:next.token)
            case .invalid: throw failure
            }
        }
        guard (data["locked"] as? Int ?? 0) == 0, (data["status"] as? Int ?? 1) == 1 else { throw HhtFailure.service("慧湖通当前身份或通行状态不可用，请在官方小程序确认。") }
        guard let raw = data["qrCode"] as? String, !raw.isEmpty, raw != "null", raw.utf16.count <= 2048 else { throw HhtFailure.service("取码服务未返回可用二维码，请稍后重试。") }
        return (next,data)
    }
    private func login(_ openid:String) async throws -> String {
        guard !openid.isEmpty else { throw HhtFailure.expired }
        var components = URLComponents()
        components.queryItems = [URLQueryItem(name:"openId",value:openid)]
        let data = try await request("/web-app/auth/certificateLogin?" + (components.percentEncodedQuery ?? "").replacingOccurrences(of:"+",with:"%2B"),token:"")
        guard let token = data["token"] as? String, !token.isEmpty, token != "null" else { throw HhtFailure.expired }
        return token
    }
    private func request(_ path:String,token:String) async throws -> [String:Any] {
        guard let url = URL(string:"https://api.215123.cn" + path) else { throw HhtFailure.invalid }
        var request = URLRequest(url:url); request.timeoutInterval = 12
        request.setValue("application/json",forHTTPHeaderField:"Accept")
        if !token.isEmpty { request.setValue(token,forHTTPHeaderField:"satoken") }
        let result:(Data,URLResponse)
        if let transport { result = try await transport(request) } else { result = try await connection.session.data(for:request) }
        guard let response = result.1 as? HTTPURLResponse else { throw HhtFailure.invalid }
        if response.statusCode == 401 || response.statusCode == 403 { throw HhtFailure.expired }
        guard response.statusCode == 200, result.0.count <= 262144, let body = try JSONSerialization.jsonObject(with:result.0) as? [String:Any] else { throw HhtFailure.invalid }
        let code = body["code"] as? Int ?? 0
        if code == 401 || code == 403 { throw HhtFailure.expired }
        guard code == 200 else { throw HhtFailure.service("慧湖通暂未返回成功结果，请在官方小程序确认登录后重试。") }
        guard let data = body["data"] as? [String:Any] else { throw HhtFailure.invalid }
        return data
    }
}
