import Foundation
import UIKit
import CryptoKit

enum AppServiceConfig {
    static let enabled = true
    static let baseURL = URL(string: "https://ams.tristanchayne.com")!
    static let configPath = "/api/public/ios/config"
    static let appID = "cn.xjtlu.ams.ios"
    static let channel = "development"
    static let timeout: TimeInterval = 8
    static let refreshInterval: TimeInterval = 86400
    static let retryInterval: TimeInterval = 3600
}

struct PublicConfig: Codable {
    struct Announcement: Codable { let id: String; let title: String; let message: String; var source: String? = nil; var publishedAt: String? = nil; var expiresAt: Date? = nil; var important: Bool? = nil; var url: URL? = nil }
    struct Release: Codable {
        let version: String; let build: Int; let url: URL; let notes: String
        var identity:String { version+"(\(build))" }
        func newer(than version:String,build currentBuild:Int) -> Bool {
            let order = self.version.compare(version,options:.numeric)
            return order == .orderedDescending || (order == .orderedSame && build > currentBuild)
        }
    }
    struct DailyLines: Codable { let version: String; let url: URL; let sha256: String }
    var dailyLines: DailyLines? = nil
    let schemaVersion: Int
    let announcement: Announcement?
    let release: Release?
}

final class AppService {
    private let session:URLSession
    private let defaults:UserDefaults
    private let enabled:Bool
    init(session:URLSession = URLSession(configuration:.ephemeral),defaults:UserDefaults = .standard,enabled:Bool = AppServiceConfig.enabled) { self.session = session; self.defaults = defaults; self.enabled = enabled }
    func refresh() async -> PublicConfig? {
        guard enabled else { return nil }
        let now = Date().timeIntervalSince1970
        guard now >= defaults.double(forKey: "publicConfig.nextCheck") else { return cached() }
        defaults.set(now + AppServiceConfig.retryInterval, forKey: "publicConfig.nextCheck")
        var url = URLComponents(url: AppServiceConfig.baseURL.appendingPathComponent(AppServiceConfig.configPath), resolvingAgainstBaseURL: false)!
        url.queryItems = ["appID": AppServiceConfig.appID, "platform": "ios", "version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0", "build": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1", "channel": AppServiceConfig.channel, "locale": Locale.current.identifier].map { URLQueryItem(name: $0.key, value: $0.value) }
        var request = URLRequest(url: url.url!, timeoutInterval: AppServiceConfig.timeout)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, response) = try await session.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200,data.count <= 65536 else { return cached() }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            let config = try decoder.decode(PublicConfig.self, from: data)
            guard config.schemaVersion == 1 else { return cached() }
            if let lines = config.dailyLines { await updateLines(lines) }
            defaults.set(data, forKey: "publicConfig.cache")
            defaults.set(now + AppServiceConfig.refreshInterval, forKey: "publicConfig.nextCheck")
            return config
        } catch { return cached() }
    }
    static func decode(_ data: Data) throws -> PublicConfig { let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601; return try decoder.decode(PublicConfig.self,from:data) }
    static var dailyScript: String {
        guard let data = UserDefaults.standard.data(forKey:"dailyLines.cache"), let text = String(data:data,encoding:.utf8) else { return "" }
        return "if(location.hostname==='ams.xjtlu.edu.cn')window.__amsRemoteDaily=\(text);"
    }
    private func updateLines(_ lines: PublicConfig.DailyLines) async {
        guard lines.version != defaults.string(forKey:"dailyLines.version"), lines.url.scheme == "https", lines.url.host == AppServiceConfig.baseURL.host else { return }
        do {
            let (data,response) = try await session.data(for:URLRequest(url:lines.url,timeoutInterval:8))
            guard (response as? HTTPURLResponse)?.statusCode == 200, data.count <= 8_000_000,
                SHA256.hash(data:data).map({String(format:"%02x",$0)}).joined() == lines.sha256.lowercased(),
                let rows = try JSONSerialization.jsonObject(with:data) as? [[String:Any]], !rows.isEmpty,
                rows.allSatisfy({ ($0["text"] as? String).map { !$0.isEmpty && $0.count <= 54 } ?? false }) else { return }
            defaults.set(data,forKey:"dailyLines.cache"); defaults.set(lines.version,forKey:"dailyLines.version")
        } catch { }
    }
    private func cached() -> PublicConfig? { guard let data = defaults.data(forKey:"publicConfig.cache"), let config = try? Self.decode(data), config.schemaVersion == 1 else { return nil }; return config }
}

final class AnnouncementController: UIViewController {
    private let announcement: PublicConfig.Announcement
    init(_ value: PublicConfig.Announcement) { announcement = value; super.init(nibName:nil,bundle:nil); modalPresentationStyle = .pageSheet }
    static func show(_ value:PublicConfig.Announcement,from controller:UIViewController) {
        if value.important == true { controller.present(AnnouncementController(value),animated:true); return }
        let banner = UIButton(configuration:.tinted()); banner.setTitle("校园提醒 · \(value.title)   查看",for:.normal); banner.translatesAutoresizingMaskIntoConstraints = false; controller.view.addSubview(banner)
        banner.addAction(UIAction { [weak controller,weak banner] _ in banner?.removeFromSuperview(); controller?.present(AnnouncementController(value),animated:true) },for:.touchUpInside)
        NSLayoutConstraint.activate([banner.topAnchor.constraint(equalTo:controller.view.safeAreaLayoutGuide.topAnchor,constant:8),banner.leadingAnchor.constraint(equalTo:controller.view.leadingAnchor,constant:16),banner.trailingAnchor.constraint(equalTo:controller.view.trailingAnchor,constant:-16),banner.heightAnchor.constraint(greaterThanOrEqualToConstant:48)])
        DispatchQueue.main.asyncAfter(deadline:.now()+8) { [weak banner] in banner?.removeFromSuperview() }
    }
    required init?(coder:NSCoder) { fatalError() }
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .systemBackground
        sheetPresentationController?.detents = [.medium(),.large()]; sheetPresentationController?.prefersGrabberVisible = true
        let scroll = UIScrollView(); scroll.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(scroll)
        let stack = UIStackView(); stack.axis = .vertical; stack.spacing = 20; stack.translatesAutoresizingMaskIntoConstraints = false; scroll.addSubview(stack)
        for (text,font) in [("校园提醒 · \(announcement.publishedAt ?? "")",UIFont.preferredFont(forTextStyle:.subheadline)),(announcement.title,UIFont.preferredFont(forTextStyle:.title2)),(announcement.message,UIFont.preferredFont(forTextStyle:.body)),("来源：\(announcement.source ?? "AMS 开发者")",UIFont.preferredFont(forTextStyle:.caption1))] {
            let label = UILabel(); label.text = text; label.font = font; label.numberOfLines = 0; label.adjustsFontForContentSizeCategory = true; stack.addArrangedSubview(label)
        }
        if let url = announcement.url, url.scheme == "https" {
            let button = UIButton(configuration:.filled()); button.setTitle("查看详情",for:.normal); button.addAction(UIAction { _ in UIApplication.shared.open(url) },for:.touchUpInside); stack.addArrangedSubview(button)
        }
        let done = UIButton(configuration:.tinted()); done.setTitle("知道了",for:.normal); done.addAction(UIAction { [weak self] _ in guard let self else { return }; UserDefaults.standard.set(self.announcement.id,forKey:"announcement.seen"); self.dismiss(animated:true) },for:.touchUpInside); stack.addArrangedSubview(done)
        NSLayoutConstraint.activate([scroll.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor,constant:28),scroll.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),scroll.leadingAnchor.constraint(equalTo:view.leadingAnchor),scroll.trailingAnchor.constraint(equalTo:view.trailingAnchor),stack.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor),stack.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor,constant:-24),stack.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor,constant:24),stack.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor,constant:-24),stack.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor,constant:-48)])
    }
}

#if DEBUG
final class DistributionPreviewController: UIViewController {
    private let headline = UITextField()
    private let importance = UISwitch()
    private let body = UITextView()
    private let quote = UITextField()
    private let status = UILabel()
    override func viewDidLoad() {
        super.viewDidLoad(); title = "模拟分发"; view.backgroundColor = .systemGroupedBackground
        let stack = UIStackView(); stack.axis = .vertical; stack.spacing = 18; stack.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(stack)
        let note = UILabel(); note.text = "仅本机模拟，不向其他用户发送通知"; note.numberOfLines = 0; note.textColor = .secondaryLabel; stack.addArrangedSubview(note)
        headline.borderStyle = .roundedRect; headline.text = "图书馆开放时间调整"; stack.addArrangedSubview(headline)
        body.font = .preferredFont(forTextStyle:.body); body.text = "这是一条模拟校园提醒。请关注学校发布的最新安排。"; body.backgroundColor = .secondarySystemGroupedBackground; body.layer.cornerRadius = 12; body.heightAnchor.constraint(equalToConstant:130).isActive = true; stack.addArrangedSubview(body)
        let severity = UIStackView(); let severityLabel = UILabel(); severityLabel.text = "重要公告（自动展开）"; severity.addArrangedSubview(severityLabel); severity.addArrangedSubview(importance); stack.addArrangedSubview(severity)
        addButton("模拟分发公告",stack:stack) { [weak self] in guard let self else { return }; self.view.endEditing(true); let announcement = PublicConfig.Announcement(id:"preview-"+UUID().uuidString,title:self.headline.text ?? "校园提醒",message:self.body.text,source:"模拟分发 · 非学校公告",publishedAt:"预览",important:self.importance.isOn); AnnouncementController.show(announcement,from:self) }
        quote.borderStyle = .roundedRect; quote.text = "把今天过好，就是向前一步。"; stack.addArrangedSubview(quote)
        addButton("模拟更新句库",stack:stack) { [weak self] in
            guard let self, let text = self.quote.text, !text.isEmpty, text.count <= 54, let data = try? JSONSerialization.data(withJSONObject:[["text":text]]) else { return }
            UserDefaults.standard.set(data,forKey:"dailyLines.cache"); UserDefaults.standard.set("preview",forKey:"dailyLines.version"); self.status.text = "已替换旧句库缓存，明天起采用新句库；今日已展示的句子保持不变。"
        }
        addButton("恢复内置句库",stack:stack) { [weak self] in UserDefaults.standard.removeObject(forKey:"dailyLines.cache"); UserDefaults.standard.removeObject(forKey:"dailyLines.version"); self?.status.text = "已清除模拟句库，重新打开主页使用内置内容。" }
        addButton("打开主页验收",stack:stack) { [weak self] in self?.navigationController?.pushViewController(CampusTabController(),animated:true) }
        status.numberOfLines = 0; status.textColor = .secondaryLabel; stack.addArrangedSubview(status)
        NSLayoutConstraint.activate([stack.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor,constant:24),stack.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:24),stack.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-24)])
    }
    private func addButton(_ title:String,stack:UIStackView,action:@escaping ()->Void) { let button = UIButton(configuration:.tinted()); button.setTitle(title,for:.normal); button.addAction(UIAction { _ in action() },for:.touchUpInside); stack.addArrangedSubview(button) }
}
#endif
