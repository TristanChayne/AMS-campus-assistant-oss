import Foundation
import Security
import CryptoKit

private enum ActivationFailure: Error { case message(String) }
private enum ActivationStore {
    static let tag = Data("cn.local.ams.ios.activation.v1".utf8)
    static func b64(_ data:Data)->String { data.base64EncodedString().replacingOccurrences(of:"+",with:"-").replacingOccurrences(of:"/",with:"_").replacingOccurrences(of:"=",with:"") }
    static func decode(_ value:String)->Data? { let text=value.replacingOccurrences(of:"-",with:"+").replacingOccurrences(of:"_",with:"/"); return Data(base64Encoded:text + String(repeating:"=",count:(4-text.count%4)%4)) }
    static func key() throws -> SecKey {
        let query:[String:Any] = [kSecClass as String:kSecClassKey,kSecAttrApplicationTag as String:tag,kSecAttrKeyType as String:kSecAttrKeyTypeRSA,kSecReturnRef as String:true]
        var result:CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary,&result) == errSecSuccess { return result as! SecKey }
        var error:Unmanaged<CFError>?
        guard let key=SecKeyCreateRandomKey([kSecAttrKeyType as String:kSecAttrKeyTypeRSA,kSecAttrKeySizeInBits as String:2048,kSecPrivateKeyAttrs as String:[kSecAttrIsPermanent as String:true,kSecAttrApplicationTag as String:tag,kSecAttrAccessible as String:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]] as CFDictionary,&error) else { throw ActivationFailure.message("无法保存设备授权，请重试。") }
        return key
    }
    static func der(_ tag:UInt8,_ body:Data)->Data {
        let count=body.count; let length:Data=count<128 ? Data([UInt8(count)]) : count<256 ? Data([0x81,UInt8(count)]) : Data([0x82,UInt8(count>>8),UInt8(count&255)])
        return Data([tag])+length+body
    }
    static func publicData(_ key:SecKey)throws->Data {
        var error:Unmanaged<CFError>?
        guard let pub=SecKeyCopyPublicKey(key),let raw=SecKeyCopyExternalRepresentation(pub,&error) as Data? else { throw ActivationFailure.message("设备验证未完成。") }
        return der(0x30,Data([0x30,0x0d,0x06,0x09,0x2a,0x86,0x48,0x86,0xf7,0x0d,0x01,0x01,0x01,0x05,0x00])+der(0x03,Data([0])+raw))
    }
    static func signed(_ key:SecKey,_ text:String)throws->String {
        var error:Unmanaged<CFError>?
        guard let data=SecKeyCreateSignature(key,.rsaSignatureMessagePKCS1v15SHA256,Data(text.utf8) as CFData,&error) as Data? else { throw ActivationFailure.message("设备验证未完成。") };return b64(data)
    }
    static func config()throws->[String:String] {
        guard let url=Bundle.main.url(forResource:"activation-config",withExtension:"json",subdirectory:"Assets"),let value=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:String] else { throw ActivationFailure.message("激活服务尚未配置。") };return value
    }
    static func verified(_ token:String,_ settings:[String:String],_ device:String)throws->[String:Any] {
        let parts=token.split(separator:".",omittingEmptySubsequences:false)
        guard parts.count==2,let payload=decode(String(parts[0])),let sig=decode(String(parts[1])),let spki=decode(settings["publicKey"] ?? ""),spki.count>24 else { throw ActivationFailure.message("授权校验失败。") }
        // RSA-2048 SubjectPublicKeyInfo has a 24-byte algorithm/bit-string prefix.
        let raw=spki.dropFirst(24)
        var error:Unmanaged<CFError>?
        guard let pub=SecKeyCreateWithData(Data(raw) as CFData,[kSecAttrKeyType as String:kSecAttrKeyTypeRSA,kSecAttrKeyClass as String:kSecAttrKeyClassPublic,kSecAttrKeySizeInBits as String:2048] as CFDictionary,&error),SecKeyVerifySignature(pub,.rsaSignatureMessagePKCS1v15SHA256,Data(parts[0].utf8) as CFData,sig as CFData,&error),let value=try JSONSerialization.jsonObject(with:payload) as? [String:Any],value["v"] as? Int==1,value["app"] as? String=="cn.local.ams",value["device"] as? String==device else { throw ActivationFailure.message("授权校验失败。") };return value
    }
    static func request(_ endpoint:URL,_ body:[String:String])async throws->[String:Any] {
        var request=URLRequest(url:endpoint);request.httpMethod="POST";request.timeoutInterval=15;request.setValue("application/json",forHTTPHeaderField:"Content-Type");request.httpBody=try JSONSerialization.data(withJSONObject:body)
        let config=URLSessionConfiguration.ephemeral;let session=URLSession(configuration:config);defer{session.invalidateAndCancel()}
        let (data,response)=try await session.data(for:request)
        guard data.count<8192,let value=try JSONSerialization.jsonObject(with:data) as? [String:Any] else { throw ActivationFailure.message("激活服务返回异常，请稍后重试。") }
        guard (response as? HTTPURLResponse)?.statusCode==200 else { throw ActivationFailure.message(value["message"] as? String ?? "激活未完成，请稍后重试。") };return value
    }
    static func authorize(_ code:String?) async throws {
        let settings=try config();guard let endpoint=URL(string:settings["endpoint"] ?? ""),endpoint.scheme=="https" else { throw ActivationFailure.message("激活服务尚未配置。") }
        let key=try key(),pub=try publicData(key),device=SHA256.hash(data:pub).map{String(format:"%02x",$0)}.joined()
        if let code {
            let response=try await request(endpoint,["code":code,"publicKey":b64(pub),"proof":try signed(key,"AMS-ACTIVATE-1\n"+code)])
            guard let grant=response["grant"] as? String else { throw ActivationFailure.message("授权校验失败。") }
            _=try verified(grant,settings,device)
            guard KeychainStore.save(grant,account:"iosActivationGrant") else { throw ActivationFailure.message("授权未保存，请用原码重试。") }
        } else {
            let grant=KeychainStore.read("iosActivationGrant");_ = try verified(grant,settings,device)
            var bytes=[UInt8](repeating:0,count:24);guard SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)==errSecSuccess else { throw ActivationFailure.message("设备验证未完成。") };let nonce=b64(Data(bytes))
            let response=try await request(endpoint.deletingLastPathComponent().appendingPathComponent("check"),["grant":grant,"nonce":nonce,"publicKey":b64(pub),"proof":try signed(key,"AMS-CHECK-1\n"+grant+"\n"+nonce)])
            guard let status=response["status"] as? String else { throw ActivationFailure.message("授权校验失败。") };let value=try verified(status,settings,device)
            guard value["nonce"] as? String==nonce,value["grant"] as? String == (try verified(grant,settings,device))["grant"] as? String else { throw ActivationFailure.message("授权校验失败。") };guard value["enabled"] as? Bool==true else { KeychainStore.save("",account:"iosActivationGrant");throw ActivationFailure.message("激活已停用，请使用有效激活码重新激活。") }
        }
    }
}

import Foundation
import Security

enum KeychainStore {
    #if DEBUG
    private(set) static var lastStatus: OSStatus = errSecSuccess
    #endif
    static func read(_ account: String) -> String {
        let query: [String: Any] = [kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:"cn.local.ams.ios", kSecAttrAccount as String:account, kSecReturnData as String:true]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }
    @discardableResult static func save(_ value: String, account: String) -> Bool {
        let query: [String: Any] = [kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:"cn.local.ams.ios", kSecAttrAccount as String:account]
        if value.isEmpty { SecItemDelete(query as CFDictionary); return true }
        let data = Data(value.utf8)
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String:data] as CFDictionary)
        #if DEBUG
        lastStatus = status
        #endif
        if status == errSecSuccess { return true }
        guard status == errSecItemNotFound else { return false }
        var item = query; item[kSecValueData as String] = data; item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let added = SecItemAdd(item as CFDictionary, nil)
        #if DEBUG
        lastStatus = added
        #endif
        return added == errSecSuccess
    }
}

@main struct Check {
 static func main() async throws {
  let key=SecKeyCreateRandomKey([kSecAttrKeyType as String:kSecAttrKeyTypeRSA,kSecAttrKeySizeInBits as String:2048] as CFDictionary,nil)!
  let pub=try ActivationStore.publicData(key),device=SHA256.hash(data:pub).map{String(format:"%02x",$0)}.joined()
  let payload=ActivationStore.b64(try JSONSerialization.data(withJSONObject:["v":1,"app":"cn.local.ams","device":device]))
  let token=payload+"."+(try ActivationStore.signed(key,payload))
  let settings=["publicKey":ActivationStore.b64(pub)]
  _ = try ActivationStore.verified(token,settings,device)
  do { _ = try ActivationStore.verified("e30."+token.split(separator:".")[1],settings,device);fatalError("Tampered token accepted") } catch {}
  let code="AMS-"+UUID().uuidString.replacingOccurrences(of:"-",with:"").prefix(24).enumerated().map{ $0.offset>0 && $0.offset%8==0 ? "-"+String($0.element):String($0.element) }.joined()
  let endpoint=URL(string:"https://ams.tristanchayne.com/api/activate")!
  do { _=try await ActivationStore.request(endpoint,["code":code,"publicKey":ActivationStore.b64(pub),"proof":try ActivationStore.signed(key,"AMS-ACTIVATE-1\n"+code)]);fatalError("Unknown code accepted") } catch ActivationFailure.message(let message) { guard message.contains("激活码无效") else { fatalError("Unexpected server rejection: "+message) } }
  print("PASS: Swift RSA/SPKI grant verification, tampering rejection, live device proof and invalid-code rejection; no real activation used")
 }
}
