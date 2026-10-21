import UIKit

// Keep the authenticated WebView alive while UIKit owns the system tab bar.
final class CampusTabController: UITabBarController, UITabBarControllerDelegate {
    private let campus: CampusController
    init(reviewRequest:URLRequest? = nil) { campus = CampusController(reviewRequest:reviewRequest); super.init(nibName:nil,bundle:nil) }
    required init?(coder:NSCoder) { fatalError() }
    private let hosts = (0..<4).map { _ in UIViewController() }
    private weak var currentHost: UIViewController?
    private(set) var isSelectingPage = false
    override func viewDidLoad() {
        super.viewDidLoad()
        delegate = self
        navigationItem.backBarButtonItem = UIBarButtonItem(title:"返回",style:.plain,target:nil,action:nil)
        for (index,pair) in zip(["课表","签到记录","请假","预约"],["calendar","chart.bar","doc.text","calendar.badge.clock"]).enumerated() {
            hosts[index].tabBarItem = UITabBarItem(title:pair.0,image:UIImage(systemName:pair.1),tag:index)
        }
        setViewControllers(hosts,animated:false)
        attach(to:hosts[0])
        tabBar.isHidden = true
        NotificationCenter.default.addObserver(self,selector:#selector(checkActivation),name:UIApplication.didBecomeActiveNotification,object:nil)
        NotificationCenter.default.addObserver(self,selector:#selector(activationUpdated),name:ActivationStore.updated,object:nil)
    }
    deinit { NotificationCenter.default.removeObserver(self) }
    override func viewDidAppear(_ animated:Bool) { super.viewDidAppear(animated); checkActivation(); ActivationStore.askNotificationPermissionOnce() }
    // Every launch and return to foreground asks the server (per-open check; legacy cadence on older servers).
    @objc private func checkActivation() {
        guard viewIfLoaded?.window != nil else { return }
        Task { [weak self] in if await ActivationStore.checkNow() { self?.showActivation() } }
    }
    // A check started elsewhere (e.g. after a school account change) may report a disable.
    @objc private func activationUpdated() { if UserDefaults.standard.bool(forKey:"activation.revoked") { showActivation() } }
    private func showActivation() {
        guard let navigationController,navigationController.viewControllers.contains(where:{$0 === self}) else { return }
        navigationController.topViewController?.dismiss(animated:false)
        navigationController.setViewControllers([ActivationController()],animated:false)
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        if let selectedViewController, campus.view.superview !== selectedViewController.view { attach(to:selectedViewController) }
    }
    private func attach(to host:UIViewController) {
        guard currentHost !== host || campus.view.superview !== host.view else { return }
        campus.willMove(toParent:nil); campus.view.removeFromSuperview(); campus.removeFromParent()
        host.addChild(campus)
        campus.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.addSubview(campus.view)
        NSLayoutConstraint.activate([campus.view.topAnchor.constraint(equalTo:host.view.topAnchor),campus.view.bottomAnchor.constraint(equalTo:host.view.bottomAnchor),campus.view.leadingAnchor.constraint(equalTo:host.view.leadingAnchor),campus.view.trailingAnchor.constraint(equalTo:host.view.trailingAnchor)])
        campus.didMove(toParent:host); currentHost = host
    }
    func setChrome(visible:Bool,index:Int) {
        guard isViewLoaded else { return }
        tabBar.isHidden = !visible
        if hosts.indices.contains(index),selectedIndex != index { selectedIndex = index; attach(to:hosts[index]) }
        view.setNeedsLayout()
    }
    func selectPage(_ index:Int) {
        guard hosts.indices.contains(index) else { return }
        selectedIndex = index
        tabBarController(self,didSelect:hosts[index])
    }
    func tabBarController(_ tabBarController:UITabBarController,didSelect viewController:UIViewController) {
        guard let index = hosts.firstIndex(where:{$0 === viewController}) else { return }
        isSelectingPage = true
        attach(to:viewController)
        campus.selectTab(index)
        isSelectingPage = false
    }
    // Navigation belongs to the shared content, including its existing return buttons.
    override var childForStatusBarStyle:UIViewController? { campus }
}
