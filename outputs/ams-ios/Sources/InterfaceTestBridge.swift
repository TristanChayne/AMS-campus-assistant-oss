#if DEBUG
import Foundation

// Explicit simulator test mode; event driven, with no polling or user data.
final class InterfaceTestBridge {
    let action: (String)->Void
    init(action:@escaping (String)->Void) {
        self.action = action
        for command in ["settings","back","home","records","leave","reservations","room","seat","detail","closeDetail","authAudit","reviewAudit","reviewQR","reviewHht","reviewScan","hhtTutorial","hhtBack","hhtBind","hhtShowCode","hhtRefresh","hhtMoreChange","hhtMoreClear","hhtConfirmUnbind","hhtSuspend","hhtResume","hhtAudit","hhtExit"] {
            CFNotificationCenterAddObserver(CFNotificationCenterGetDarwinNotifyCenter(),Unmanaged.passUnretained(self).toOpaque(),{ _,observer,name,_,_ in
                guard let observer, let name else { return }
                let bridge = Unmanaged<InterfaceTestBridge>.fromOpaque(observer).takeUnretainedValue()
                let command = String(name.rawValue).components(separatedBy:".").last!
                DispatchQueue.main.async { bridge.action(command) }
            },("cn.local.ams.test." + command) as CFString,nil,.deliverImmediately)
        }
    }
    deinit { CFNotificationCenterRemoveEveryObserver(CFNotificationCenterGetDarwinNotifyCenter(),Unmanaged.passUnretained(self).toOpaque()) }
}
#endif
