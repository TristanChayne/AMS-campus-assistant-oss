import UIKit
import Security
import CryptoKit
import UserNotifications

private enum ActivationFailure: Error { case message(String) }
@MainActor enum ActivationStore {
    static let tag = Data("cn.local.ams.ios.activation.v1".utf8)
    private static var checking = false
    static func resetCheck() { for name in ["lastCheck","lastAttempt","revoked"] { UserDefaults.standard.removeObject(forKey:"activation."+name) } }
    private static func check(_ grant:String,_ settings:[String:String],_ key:SecKey,_ pub:Data,_ device:String) async throws -> Bool {
        guard let endpoint = URL(string:settings["endpoint"] ?? ""),endpoint.scheme == "https" else { throw ActivationFailure.message("激活服务尚未配置。") }
        let original = try verified(grant,settings,device)
        var bytes=[UInt8](repeating:0,count:24);guard SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)==errSecSuccess else { throw ActivationFailure.message("设备验证未完成。") };let nonce=b64(Data(bytes))
        let response=try await request(endpoint.deletingLastPathComponent().appendingPathComponent("check"),["grant":grant,"nonce":nonce,"publicKey":b64(pub),"proof":try signed(key,"AMS-CHECK-1\n"+grant+"\n"+nonce)])
        guard let status=response["status"] as? String else { throw ActivationFailure.message("授权校验失败。") };let value=try verified(status,settings,device)
        guard value["nonce"] as? String==nonce,value["grant"] as? String == original["grant"] as? String,let enabled=value["enabled"] as? Bool,let days=value["intervalDays"] as? Int,(1...365).contains(days) else { throw ActivationFailure.message("授权校验失败。") }
        // A reply to an earlier installation grant must not change the current grant.
        guard KeychainStore.read("iosActivationGrant") == grant else { return false }
        UserDefaults.standard.set(Date().timeIntervalSince1970,forKey:"activation.lastCheck")
        UserDefaults.standard.set(!enabled,forKey:"activation.revoked")
        return !enabled
    }
    static let updated = Notification.Name("AMSActivationUpdated")
    private struct CheckUnsupported: Error {}
    private static var recheck = false
    /// Server check on every launch and return to foreground (ADMIN-BE-001 / D-020), one at a time; a request arriving
    /// meanwhile (e.g. the school account changed) runs once more afterwards. Network failure keeps the current state;
    /// only an explicit disable from the server revokes. Returns true when this installation is disabled.
    static func checkNow() async -> Bool {
        let grant = KeychainStore.read("iosActivationGrant")
        guard !grant.isEmpty else { return false }
        if checking { recheck = true; return UserDefaults.standard.bool(forKey:"activation.revoked") }
        checking = true; defer { checking = false }
        repeat {
            recheck = false
            do {
                let settings=try config(),key=try key(),pub=try publicData(key),device=SHA256.hash(data:pub).map{String(format:"%02x",$0)}.joined()
                do { _ = try await clientCheck(grant,settings,key,pub,device) }
                catch is CheckUnsupported {
                    // Older server: the periodic legacy check applies.
                    let defaults = UserDefaults.standard, now = Date().timeIntervalSince1970
                    if ActivationCadence.due(now:now,last:defaults.double(forKey:"activation.lastCheck"),attempt:defaults.double(forKey:"activation.lastAttempt")) {
                        defaults.set(now,forKey:"activation.lastAttempt"); _ = try await check(grant,settings,key,pub,device)
                    }
                }
            } catch { }
        } while recheck
        NotificationCenter.default.post(name:updated,object:nil)
        return UserDefaults.standard.bool(forKey:"activation.revoked")
    }
    private static func clientCheck(_ grant:String,_ settings:[String:String],_ key:SecKey,_ pub:Data,_ device:String) async throws -> Bool {
        guard let endpoint = URL(string:settings["endpoint"] ?? ""),endpoint.scheme == "https" else { throw ActivationFailure.message("激活服务尚未配置。") }
        let original = try verified(grant,settings,device)
        var bytes=[UInt8](repeating:0,count:24);guard SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)==errSecSuccess else { throw ActivationFailure.message("设备验证未完成。") };let nonce=b64(Data(bytes))
        let defaults = UserDefaults.standard, name = defaults.string(forKey:"account.name"), revision = defaults.integer(forKey:"account.revision")
        let info = Bundle.main.infoDictionary, version = "\(info?["CFBundleShortVersionString"] as? String ?? "") (\(info?["CFBundleVersion"] as? String ?? ""))"
        var system = utsname(); uname(&system)
        let model = String(withUnsafeBytes(of:&system.machine) { String(decoding:$0.prefix { $0 != 0 },as:UTF8.self) }.prefix(80))
        let appVersion = String(version.prefix(40)), bundle = Bundle.main.bundleIdentifier ?? ""
        // Remote notification token for AMS messages (D-021), with the APNs environment of this build.
        let alertToken = defaults.string(forKey:"push.alertToken") ?? ""
        #if DEBUG
        let apnsEnv = "sandbox"
        #else
        let apnsEnv = "production"
        #endif
        // The proof covers the account, device metadata and push token, so none can be written for another installation.
        let body:[String:Any] = ["grant":grant,"nonce":nonce,"platform":"ios","account":["name":name.map { $0 as Any } ?? NSNull(),"revision":revision],
            "publicKey":b64(pub),"proof":try signed(key,"AMS-CHECK-2\n\(grant)\n\(nonce)\nios\n\(revision)\n\(name ?? "")\n\(bundle)\n\(appVersion)\n\(model)\n\(alertToken)\n\(alertToken.isEmpty ? "" : apnsEnv)"),
            "appVersion":appVersion,"model":model,"bundleId":bundle,"alertToken":alertToken.isEmpty ? NSNull() : alertToken,"apnsEnv":alertToken.isEmpty ? NSNull() : apnsEnv]
        var request=URLRequest(url:endpoint.deletingLastPathComponent().appendingPathComponent("client/check"));request.httpMethod="POST";request.timeoutInterval=10
        request.setValue("application/json",forHTTPHeaderField:"Content-Type");request.httpBody=try JSONSerialization.data(withJSONObject:body)
        let session=URLSession(configuration:.ephemeral);defer{session.invalidateAndCancel()}
        let (data,response)=try await session.data(for:request)
        let status=(response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 404 || status == 405 { throw CheckUnsupported() }
        guard status == 200,data.count < 262144,let reply=try JSONSerialization.jsonObject(with:data) as? [String:Any],let token=reply["status"] as? String else { throw ActivationFailure.message("授权校验失败。") }
        let value=try verified(token,settings,device,version:2)
        guard value["nonce"] as? String==nonce,value["grant"] as? String == original["grant"] as? String,let enabled=value["enabled"] as? Bool else { throw ActivationFailure.message("授权校验失败。") }
        guard KeychainStore.read("iosActivationGrant") == grant else { return false }
        defaults.set(Date().timeIntervalSince1970,forKey:"activation.lastCheck")
        defaults.set(!enabled,forKey:"activation.revoked")
        if let id = value["installationId"] as? String { defaults.set(id,forKey:"activation.installationId") }
        if let server = (value["account"] as? [String:Any])?["revision"] as? Int, server > defaults.integer(forKey:"account.revision") { defaults.set(server,forKey:"account.revision") }
        // Announcements and the Apple release come from the signed status and reach the campus page in the public configuration shape.
        let seen = defaults.string(forKey:"announcement.seen"), list = value["announcements"] as? [[String:Any]] ?? []
        let announcement = list.first { $0["id"] as? String != seen } ?? list.first
        let release = (value["release"] as? [String:Any])?["ios"]
        if let config = try? JSONSerialization.data(withJSONObject:["schemaVersion":1,"announcement":announcement ?? NSNull(),"release":release ?? NSNull()] as [String:Any]) { defaults.set(config,forKey:"deviceCheck.config") }
        return !enabled
    }
    /// Login, account switch or logout, read from the saved AMS session (`account`). A newer revision lets the server
    /// ignore late requests made for the previous account; the check then runs right away.
    static func accountChanged() {
        var name:String? = nil
        if let data = KeychainStore.read("amsSession").data(using:.utf8),let user = try? JSONSerialization.jsonObject(with:data) as? [String:Any],
           let account = (user["account"] as? String)?.trimmingCharacters(in:.whitespacesAndNewlines),!account.isEmpty,account.count <= 120 { name = account }
        let defaults = UserDefaults.standard
        guard defaults.string(forKey:"account.name") != name else { return }
        if let name { defaults.set(name,forKey:"account.name") } else { defaults.removeObject(forKey:"account.name") }
        defaults.set(defaults.integer(forKey:"account.revision") + 1,forKey:"account.revision")
        Task { _ = await checkNow() }
    }
    /// A new remote notification token is sent with the next check right away.
    static func receiveAlertToken(_ token:Data) {
        let value = token.map { String(format:"%02x",$0) }.joined()
        guard UserDefaults.standard.string(forKey:"push.alertToken") != value else { return }
        UserDefaults.standard.set(value,forKey:"push.alertToken")
        Task { _ = await checkNow() }
    }
    /// AMS messages cannot be switched off in the app (D-021); the system permission is asked once after activation.
    static func askNotificationPermissionOnce() {
        guard !UserDefaults.standard.bool(forKey:"push.permissionAsked") else { return }
        UserDefaults.standard.set(true,forKey:"push.permissionAsked")
        Task {
            let center = UNUserNotificationCenter.current()
            guard await center.notificationSettings().authorizationStatus == .notDetermined else { return }
            _ = try? await center.requestAuthorization(options:[.alert,.sound])
        }
    }
    /// Proves that a course reminder registration belongs to this activated installation; the server links the two
    /// and refuses a disabled installation.
    static func linkProof(deviceId:String) -> [String:String]? {
        let grant = KeychainStore.read("iosActivationGrant")
        var bytes=[UInt8](repeating:0,count:24)
        guard !grant.isEmpty,let signingKey = try? key(),let pub = try? publicData(signingKey),SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)==errSecSuccess else { return nil }
        let nonce = b64(Data(bytes))
        guard let proof = try? signed(signingKey,"AMS-LINK-1\n\(grant)\n\(deviceId)\n\(nonce)") else { return nil }
        return ["grant":grant,"nonce":nonce,"publicKey":b64(pub),"proof":proof]
    }
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
    static func verified(_ token:String,_ settings:[String:String],_ device:String,version:Int=1)throws->[String:Any] {
        let parts=token.split(separator:".",omittingEmptySubsequences:false)
        guard parts.count==2,let payload=decode(String(parts[0])),let sig=decode(String(parts[1])),let spki=decode(settings["publicKey"] ?? ""),spki.count>24 else { throw ActivationFailure.message("授权校验失败。") }
        // RSA-2048 SubjectPublicKeyInfo has a 24-byte algorithm/bit-string prefix.
        let raw=spki.dropFirst(24)
        var error:Unmanaged<CFError>?
        guard let pub=SecKeyCreateWithData(Data(raw) as CFData,[kSecAttrKeyType as String:kSecAttrKeyTypeRSA,kSecAttrKeyClass as String:kSecAttrKeyClassPublic,kSecAttrKeySizeInBits as String:2048] as CFDictionary,&error),SecKeyVerifySignature(pub,.rsaSignatureMessagePKCS1v15SHA256,Data(parts[0].utf8) as CFData,sig as CFData,&error),let value=try JSONSerialization.jsonObject(with:payload) as? [String:Any],value["v"] as? Int==version,value["app"] as? String=="cn.local.ams",value["device"] as? String==device else { throw ActivationFailure.message("授权校验失败。") };return value
    }
    static func request(_ endpoint:URL,_ body:[String:String])async throws->[String:Any] {
        var request=URLRequest(url:endpoint);request.httpMethod="POST";request.timeoutInterval=15;request.setValue("application/json",forHTTPHeaderField:"Content-Type");request.httpBody=try JSONSerialization.data(withJSONObject:body)
        let config=URLSessionConfiguration.ephemeral;let session=URLSession(configuration:config);defer{session.invalidateAndCancel()}
        let (data,response)=try await session.data(for:request)
        guard data.count<8192,let value=try JSONSerialization.jsonObject(with:data) as? [String:Any] else { throw ActivationFailure.message("激活服务返回异常，请稍后重试。") }
        guard (response as? HTTPURLResponse)?.statusCode==200 else { throw ActivationFailure.message(value["message"] as? String ?? "激活未完成，请稍后重试。") };return value
    }
    // Suppress ordinary reminder uploads while the saved activation belongs to the isolated demo.
    static var isReviewGrant: Bool {
        let payload = KeychainStore.read("iosActivationGrant").split(separator: ".").first.map(String.init) ?? ""
        guard let data = decode(payload), let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
        return value["mode"] as? String == "demo"
    }
    static func authorize(_ code:String?) async throws -> URLRequest? {
        let settings=try config();guard let endpoint=URL(string:settings["endpoint"] ?? ""),endpoint.scheme=="https" else { throw ActivationFailure.message("激活服务尚未配置。") }
        let key=try key(),pub=try publicData(key),device=SHA256.hash(data:pub).map{String(format:"%02x",$0)}.joined()
        if let code {
            let response=try await request(endpoint,["code":code,"publicKey":b64(pub),"proof":try signed(key,"AMS-ACTIVATE-1\n"+code)])
            guard let grant=response["grant"] as? String else { throw ActivationFailure.message("授权校验失败。") }
            _=try verified(grant,settings,device)
            guard KeychainStore.save(grant,account:"iosActivationGrant") else { throw ActivationFailure.message("授权未保存，请用原码重试。") }
            resetCheck(); UserDefaults.standard.set(Date().timeIntervalSince1970,forKey:"activation.lastCheck")
        } else {
            let grant=KeychainStore.read("iosActivationGrant"),value=try verified(grant,settings,device)
            // Disabled earlier: ask the server once more, so a device that was enabled again continues without a new code.
            if UserDefaults.standard.bool(forKey:"activation.revoked") { _ = try? await clientCheck(grant,settings,key,pub,device) }
            guard !UserDefaults.standard.bool(forKey:"activation.revoked") else { throw ActivationFailure.message("激活已停用，请使用有效激活码重新激活。") }
            // Normal grants enter offline; the foreground container performs the due check.
            // Demo bootstrap remains online and must not fall through to school accounts.
            if value["mode"] as? String == "demo",try await check(grant,settings,key,pub,device) { throw ActivationFailure.message("激活已停用，请使用有效激活码重新激活。") }
        }
        let grant=KeychainStore.read("iosActivationGrant"),value=try verified(grant,settings,device)
        guard value["mode"] as? String == "demo" else { return nil }
        let timestamp=String(Int(Date().timeIntervalSince1970));var bytes=[UInt8](repeating:0,count:24)
        guard SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)==errSecSuccess else { throw ActivationFailure.message("设备验证未完成。") }
        let nonce=b64(Data(bytes));var request=URLRequest(url:endpoint.deletingLastPathComponent().appendingPathComponent("demo/bootstrap"));request.httpMethod="POST";request.timeoutInterval=20;request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        request.httpBody=try JSONSerialization.data(withJSONObject:["grant":grant,"publicKey":b64(pub),"timestamp":timestamp,"nonce":nonce,"proof":try signed(key,"AMS-DEMO-1\n"+grant+"\n"+timestamp+"\n"+nonce)])
        return request
    }
}

final class ActivationController: UIViewController {
    private let code=UITextField(),button=UIButton(type:.system),message=UILabel()
    private var working=false
    override func viewDidLoad() {
        super.viewDidLoad();overrideUserInterfaceStyle = .light
        view.backgroundColor=UIColor(red:245/255,green:246/255,blue:248/255,alpha:1)
        let scroll=UIScrollView();scroll.translatesAutoresizingMaskIntoConstraints=false;view.addSubview(scroll)
        NSLayoutConstraint.activate([scroll.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),scroll.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),scroll.leadingAnchor.constraint(equalTo:view.leadingAnchor),scroll.trailingAnchor.constraint(equalTo:view.trailingAnchor)])
        let stack=UIStackView();stack.axis = .vertical;stack.spacing=14;stack.translatesAutoresizingMaskIntoConstraints=false;scroll.addSubview(stack)
        NSLayoutConstraint.activate([stack.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor,constant:40),stack.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor,constant:-25),stack.centerXAnchor.constraint(equalTo:scroll.frameLayoutGuide.centerXAnchor),stack.leadingAnchor.constraint(greaterThanOrEqualTo:scroll.frameLayoutGuide.leadingAnchor,constant:28),stack.trailingAnchor.constraint(lessThanOrEqualTo:scroll.frameLayoutGuide.trailingAnchor,constant:-28),stack.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor,constant:-56)])
        if let url=Bundle.main.url(forResource:"activation-icon",withExtension:"png",subdirectory:"Assets"),let image=UIImage(contentsOfFile:url.path) { let icon=UIImageView(image:image);icon.layer.cornerRadius=12;icon.clipsToBounds=true;icon.accessibilityLabel="AMS 校园助手";let row=UIStackView(arrangedSubviews:[icon,UIView()]);icon.widthAnchor.constraint(equalToConstant:52).isActive=true;icon.heightAnchor.constraint(equalToConstant:52).isActive=true;stack.addArrangedSubview(row) }
        func label(_ text:String,_ size:CGFloat,_ color:UIColor,_ bold:Bool=false)->UILabel { let v=UILabel();v.text=text;v.numberOfLines=0;v.font=bold ? .boldSystemFont(ofSize:size):.systemFont(ofSize:size);v.textColor=color;return v }
        let muted=UIColor(red:105/255,green:117/255,blue:138/255,alpha:1),ink=UIColor(red:24/255,green:35/255,blue:58/255,alpha:1)
        stack.addArrangedSubview(label("CAMPUS DAY",11,muted));stack.addArrangedSubview(label("开启校园助手",29,ink,true));stack.addArrangedSubview(label("首次使用需要激活。激活后，退出学校账号或更新应用都不受影响。",14,muted))
        let spacer=UIView();spacer.heightAnchor.constraint(equalToConstant:4).isActive=true;stack.addArrangedSubview(spacer)
        code.placeholder="粘贴激活码";code.accessibilityLabel="激活码";code.autocapitalizationType = .allCharacters;code.autocorrectionType = .no;code.backgroundColor = .white;code.layer.cornerRadius=12;code.font = .systemFont(ofSize:14);let inset=UIView(frame:CGRect(x:0,y:0,width:14,height:1));code.leftView=inset;code.leftViewMode = .always;code.heightAnchor.constraint(equalToConstant:52).isActive=true;stack.addArrangedSubview(code)
        button.setTitle("激活并进入",for:.normal);button.setTitleColor(.white,for:.normal);button.backgroundColor=UIColor(red:23/255,green:46/255,blue:97/255,alpha:1);button.layer.cornerRadius=12;button.heightAnchor.constraint(equalToConstant:52).isActive=true;button.addTarget(self,action:#selector(submit),for:.touchUpInside);stack.addArrangedSubview(button)
        message.numberOfLines=0;message.textColor=UIColor(red:154/255,green:81/255,blue:66/255,alpha:1);message.font = .systemFont(ofSize:13);stack.addArrangedSubview(message)
        stack.addArrangedSubview(label("卸载应用后，需要重新激活。\n激活后会记录本机当前登录的学校账户名，用于设备管理；不接收密码。",12,muted));let footer=label("由 Tristan Chayne 制作\nlinlantc@gmail.com",11,muted);footer.textAlignment = .center;stack.setCustomSpacing(50,after:stack.arrangedSubviews.last!);stack.addArrangedSubview(footer)
        // Keychain can outlive uninstall; an app-private marker distinguishes a new installation.
        let marker=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("activation-install-v1")
        if !FileManager.default.fileExists(atPath:marker.path) { KeychainStore.save("",account:"iosActivationGrant");ActivationStore.resetCheck();try? FileManager.default.createDirectory(at:marker.deletingLastPathComponent(),withIntermediateDirectories:true);try? Data([1]).write(to:marker) }
        #if DEBUG
        let args=ProcessInfo.processInfo.arguments
        if let index=args.firstIndex(of:"--test-activation-code"),args.indices.contains(index+1) { run(args[index+1]);return }
        #endif
        if !KeychainStore.read("iosActivationGrant").isEmpty { run(nil) }
    }
    override func viewWillAppear(_ animated:Bool) { super.viewWillAppear(animated);navigationController?.setNavigationBarHidden(true,animated:false) }
    @objc private func submit() { let text=(code.text ?? "").trimmingCharacters(in:.whitespacesAndNewlines).uppercased();guard text.range(of:"^AMS-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$",options:.regularExpression) != nil else { message.text="请检查激活码格式";return };run(text) }
    private func run(_ value:String?) {
        guard !working else{return};working=true;button.isEnabled=false;code.isEnabled=false;button.setTitle("正在验证…",for:.normal);message.text=""
        Task { do { let review=try await ActivationStore.authorize(value);navigationController?.setViewControllers([CampusTabController(reviewRequest:review)],animated:false) } catch { if case ActivationFailure.message(let text)=error { message.text=text } else { message.text="无法连接激活服务，请检查网络后重试。" };UIAccessibility.post(notification:.announcement,argument:message.text) };working=false;button.isEnabled=true;code.isEnabled=true;button.setTitle("激活并进入",for:.normal) }
    }
}
