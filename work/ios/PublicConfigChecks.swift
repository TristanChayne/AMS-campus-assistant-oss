import Foundation

private final class ConfigProtocol: URLProtocol {
    static var calls = 0, status = 200
    static var payload = Data()
    static var failure:URLError?
    override class func canInit(with request:URLRequest) -> Bool { true }
    override class func canonicalRequest(for request:URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.calls += 1
        if let failure = Self.failure { client?.urlProtocol(self,didFailWithError:failure); return }
        client?.urlProtocol(self,didReceive:HTTPURLResponse(url:request.url!,statusCode:Self.status,httpVersion:nil,headerFields:nil)!,cacheStoragePolicy:.notAllowed)
        client?.urlProtocol(self,didLoad:Self.payload)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() { }
}

@main
struct PublicConfigChecks {
    static func main() async throws {
        let empty = try JSONDecoder().decode(PublicConfig.self,from:Data("{\"schemaVersion\":1,\"announcement\":null,\"release\":null}".utf8))
        precondition(empty.schemaVersion == 1 && empty.release == nil && empty.announcement == nil)
        let complete = try JSONDecoder().decode(PublicConfig.self,from:Data("{\"schemaVersion\":1,\"announcement\":{\"id\":\"test\",\"title\":\"维护说明\",\"message\":\"测试\"},\"release\":{\"version\":\"0.2.0\",\"build\":2,\"url\":\"https://testflight.apple.com/join/example\",\"notes\":\"测试\"}}".utf8))
        precondition(complete.release?.build == 2 && complete.announcement?.id == "test")
        precondition(complete.release!.newer(than:"0.1.0",build:70))
        precondition(!complete.release!.newer(than:"0.2.0",build:2))
        precondition(complete.release!.newer(than:"0.2.0",build:1))
        precondition(!complete.release!.newer(than:"0.3.0",build:1))
        do { _ = try JSONDecoder().decode(PublicConfig.self,from:Data("{\"schemaVersion\":1,\"release\":{\"build\":\"invalid\"}}".utf8)); preconditionFailure("Malformed response accepted") } catch {}
        let result = await AppService(enabled:false).refresh()
        precondition(result == nil, "Disabled service must not issue a request or return cached content")
        let suite = "AMS.PublicConfigChecks."+UUID().uuidString
        let defaults = UserDefaults(suiteName:suite)!
        defer { defaults.removePersistentDomain(forName:suite) }
        let configuration = URLSessionConfiguration.ephemeral; configuration.protocolClasses = [ConfigProtocol.self]
        let session = URLSession(configuration:configuration)
        defer { session.invalidateAndCancel() }
        let service = AppService(session:session,defaults:defaults,enabled:true)
        ConfigProtocol.payload = Data("{\"schemaVersion\":1,\"announcement\":null,\"release\":{\"version\":\"0.2.0\",\"build\":2,\"url\":\"https://testflight.apple.com/join/example\",\"notes\":\"测试\"}}".utf8)
        let response1 = await service.refresh(); precondition(response1?.release?.build == 2)
        precondition(ConfigProtocol.calls == 1)
        _ = await service.refresh(); precondition(ConfigProtocol.calls == 1)
        defaults.set(0,forKey:"publicConfig.nextCheck"); ConfigProtocol.status = 404
        let response2 = await service.refresh(); precondition(response2?.release?.build == 2)
        defaults.set(0,forKey:"publicConfig.nextCheck"); ConfigProtocol.status = 200; ConfigProtocol.payload = Data("invalid".utf8)
        let response3 = await service.refresh(); precondition(response3?.release?.build == 2)
        defaults.set(0,forKey:"publicConfig.nextCheck"); ConfigProtocol.failure = URLError(.timedOut)
        let response4 = await service.refresh(); precondition(response4?.release?.build == 2)
        precondition(ConfigProtocol.calls == 4)
        print("PASS: public config parsing, version/build comparison, disabled requests, mock success, cadence, 404/malformed/timeout cache retention; isolated defaults and no live network")
    }
}
