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
