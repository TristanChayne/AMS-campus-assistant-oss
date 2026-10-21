import Foundation

@main struct ParityChecks {
    static func main() async throws {
        let now:TimeInterval = 200000
        precondition(!ActivationCadence.due(now:now,last:now-172799,attempt:0))
        precondition(ActivationCadence.due(now:now,last:now-172800,attempt:now-3600))
        precondition(!ActivationCadence.due(now:now,last:0,attempt:now-3599))
        precondition(ActivationCadence.due(now:now,last:now+1,attempt:now+1))
        precondition(ActivationCadence.due(now:now,last:0,attempt:0))
        var requests:[URLRequest] = []
        let service = HhtService(transport:{ request in
            requests.append(request)
            let data:[String:Any] = request.url!.path.contains("certificateLogin") ? ["token":"TEST_ONLY_TOKEN"] : ["qrCode":"TEST_ONLY_QR","status":1,"locked":0,"name":"测试"]
            return (try JSONSerialization.data(withJSONObject:["code":200,"data":data]),HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:nil)!)
        })
        let (next,_) = try await service.code(for:HhtBinding(mode:"openid",openid:"TEST+ONLY",token:""))
        precondition(next.token == "TEST_ONLY_TOKEN" && requests.count == 2)
        precondition(requests[0].url!.absoluteString.contains("%2B"))
        precondition(requests[1].value(forHTTPHeaderField:"satoken") == "TEST_ONLY_TOKEN")
        precondition(requests.allSatisfy { $0.url!.host == "api.215123.cn" && $0.value(forHTTPHeaderField:"Cookie") == nil })
        requests = []
        _ = try await service.code(for:HhtBinding(mode:"token",openid:"",token:"TEST_ONLY_TOKEN"))
        precondition(requests.count == 1)
        var recovered = false
        var attempts = 0
        let recovering = HhtService(transport:{ request in
            attempts += 1
            if !recovered { recovered = true; throw URLError(.notConnectedToInternet) }
            return (try JSONSerialization.data(withJSONObject:["code":200,"data":["qrCode":"TEST_ONLY_QR","status":1,"locked":0,"name":"测试"]]),HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:nil)!)
        })
        do { _ = try await recovering.code(for:HhtBinding(mode:"token",openid:"",token:"TEST_ONLY_TOKEN")); preconditionFailure("Offline request succeeded") } catch is URLError { }
        _ = try await recovering.code(for:HhtBinding(mode:"token",openid:"",token:"TEST_ONLY_TOKEN"))
        precondition(attempts == 2)
        var count = 0
        let expired = HhtService(transport:{ request in
            count += 1
            let login = request.url!.path.contains("certificateLogin")
            let code = login ? 200 : 401
            return (try JSONSerialization.data(withJSONObject:["code":code,"data":["token":"TEST_ONLY_TOKEN"]]),HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:nil)!)
        })
        do { _ = try await expired.code(for:HhtBinding(mode:"token",openid:"",token:"expired")); preconditionFailure("Expired token accepted") } catch HhtFailure.expired { }
        precondition(count == 1); count = 0
        do { _ = try await expired.code(for:HhtBinding(mode:"openid",openid:"TEST_ONLY_OPENID",token:"expired")); preconditionFailure("Expired retry accepted") } catch HhtFailure.expired { }
        precondition(count == 3) // fetch -> login -> fetch, no unbounded retry.
        let invalidCases:[[String:Any]] = [["qrCode":"","status":1],["qrCode":"TEST_ONLY","locked":1],["qrCode":"TEST_ONLY","status":0]]
        for invalid in invalidCases {
            let malformed = HhtService(transport:{ request in (try JSONSerialization.data(withJSONObject:["code":200,"data":invalid]),HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:nil)!) })
            do { _ = try await malformed.code(for:HhtBinding(mode:"token",openid:"",token:"TEST_ONLY")); preconditionFailure("Invalid code accepted") } catch { }
        }
        print("PASS: two-day/hour cadence, clock rollback, OpenId and token, isolated headers, plus encoding, one re-login only, expired/locked/invalid code, mocked network failure then recovery; mocked requests only")
    }
}
