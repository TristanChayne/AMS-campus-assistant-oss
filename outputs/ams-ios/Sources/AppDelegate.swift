import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Also runs when the system launches the app in the background for a pushed Live Activity token.
        CourseReminderCenter.shared.start()
        // D-021: every install receives AMS messages; the token travels with the per-open check.
        application.registerForRemoteNotifications()
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        ActivationStore.receiveAlertToken(deviceToken)
    }
    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "AMS", sessionRole: session.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

/// Shortcut from the course Live Activity (amscampus://scan). Consumed by the main AMS page once it is ready.
enum PendingShortcut {
    static let changed = Notification.Name("AMSPendingShortcutChanged")
    static var scan = false
    static func accept(_ urls: [URL]) {
        guard urls.contains(where: { $0.scheme == "amscampus" && $0.host == "scan" }) else { return }
        scan = true
        NotificationCenter.default.post(name: changed, object: nil)
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) { PendingShortcut.accept(URLContexts.map(\.url)) }
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        PendingShortcut.accept(options.urlContexts.map(\.url))
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        var root: UIViewController = ActivationController()
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-distribution") { root = DistributionPreviewController() }
        if ProcessInfo.processInfo.arguments.contains("--test-hht") { root = UIViewController() }
        if ProcessInfo.processInfo.arguments.contains("--test-cookie-save") || ProcessInfo.processInfo.arguments.contains("--test-cookie-read") {
            root = UIViewController()
            SchoolCookieSessionChecks.run(saving:ProcessInfo.processInfo.arguments.contains("--test-cookie-save"))
        }
        if ProcessInfo.processInfo.arguments.contains("--test-session-save") || ProcessInfo.processInfo.arguments.contains("--test-session-read") {
            let saving = ProcessInfo.processInfo.arguments.contains("--test-session-save"),account = "amsSessionPersistenceTest"
            let passed = saving ? KeychainStore.save("synthetic-session",account:account) : KeychainStore.read(account) == "synthetic-session"
            if !saving { KeychainStore.save("",account:account) }
            if let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first,let data = try? JSONSerialization.data(withJSONObject:["phase":saving ? "save" : "read-after-termination","passed":passed,"status":Int(KeychainStore.lastStatus)] as [String:Any]) { try? data.write(to:directory.appendingPathComponent("session-persistence-check.json")) }
            root = UIViewController()
        }
        if ProcessInfo.processInfo.arguments.contains("--test-xipu") { root = XipuCodeController() }
        if ProcessInfo.processInfo.arguments.contains("--test-xipu-layout") { root = XipuCodeController(); window.overrideUserInterfaceStyle = ProcessInfo.processInfo.arguments.contains("--test-dark") ? .dark : .light }
        if ProcessInfo.processInfo.arguments.contains("--test-room") { root = CampusController(url:URL(string:"https://roombookings.xjtlu.edu.cn/")!) }
        if ProcessInfo.processInfo.arguments.contains("--test-sports") { root = SportsController() }
        if ProcessInfo.processInfo.arguments.contains("--test-course-reminder") { root = UIViewController(); CourseReminderChecks.run(keep:ProcessInfo.processInfo.arguments.contains("--keep-activity")) }
        if ProcessInfo.processInfo.arguments.contains("--test-room-records") { root = CampusController(url:URL(string:"https://roombookings.xjtlu.edu.cn/#/ic/userinfo")!) }
        if ProcessInfo.processInfo.arguments.contains("--test-record-layout") { root = CampusController(url:URL(string:"https://seatbookings.xjtlu.edu.cn/#/ic/userinfo")!) }
        #endif
        let navigation = UINavigationController(rootViewController: root)
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-hht") { navigation.setViewControllers([root,HhtController()],animated:false) }
        #endif
        window.rootViewController = navigation
        window.makeKeyAndVisible()
        self.window = window
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-record-return"),let nav = window.rootViewController as? UINavigationController {
            nav.setViewControllers([UIViewController(),CampusController(url:URL(string:"https://seatbookings.xjtlu.edu.cn/#/ic/userinfo")!)],animated:false)
        }
        #endif
    }
}
