import ActivityKit
import Foundation
import Security
import UIKit
import UserNotifications

// REMIND-001: course reminders. Local notifications always work offline; Live Activities start in the
// foreground, from a scheduled start (iOS 26+) or from the push server when the person enabled upload.
@MainActor
final class CourseReminderCenter: NSObject {
    static let shared = CourseReminderCenter()
    static let review = CourseReminderCenter(isReview: true)
    private static var reviewActive = false
    private var normalSuspended: Bool { !isReview && (Self.reviewActive || ActivationStore.isReviewGrant) }
    static let stateChanged = Notification.Name("CourseReminderStateChanged")
    private static let server = URL(string: "https://ams.tristanchayne.com/api/notify")!
    private var notificationPrefix: String { isReview ? "ams.review.course." : "ams.course." }
    private let isReview: Bool
    private let defaults: UserDefaults
    private var reviewRequest: (([String: Any]) async throws -> (Int, [String: Any]))?
    private var reviewPushReady = false
    private var reviewState: CourseActivityAttributes.ContentState?
    private var reviewChain: String?
    private var reviewPushModes: [String: Bool] = [:]

    private(set) var settings: ReminderSettings
    private(set) var schedule: ReminderSchedule?
    private var endedChains: [String: Double]   // chain -> time ended by the person
    private var appEnding = Set<String>()       // activity ids ended by the app itself
    private var observed = Set<String>()
    private var notificationsAllowed: Bool?
    private var serverProblem = false
    /// Planning clock; the simulator self-check replaces it so results do not depend on the time of day.
    var clock: () -> Date = { Date() }
    private var started = false
    private var timer: Timer?

    private init(isReview: Bool = false) {
        self.isReview = isReview
        defaults = isReview ? UserDefaults(suiteName: "AMSReviewReminders")! : .standard
        settings = (defaults.data(forKey: "reminder.settings")).flatMap { try? JSONDecoder().decode(ReminderSettings.self, from: $0) } ?? ReminderSettings()
        schedule = (defaults.data(forKey: "reminder.schedule")).flatMap { try? JSONDecoder().decode(ReminderSchedule.self, from: $0) }
        endedChains = defaults.dictionary(forKey: "reminder.ended") as? [String: Double] ?? [:]
        reviewPushModes = defaults.dictionary(forKey: "reminder.reviewPushModes") as? [String: Bool] ?? [:]
        super.init()
    }

    // MARK: lifecycle

    func start() {
        guard !started else { return }
        started = true
        UNUserNotificationCenter.current().delegate = self
        NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.becameActive() }
        }
        NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.timer?.invalidate(); self?.timer = nil }
        }
        // After a server check (account switch, re-enable) the upload may now be accepted.
        NotificationCenter.default.addObserver(forName: ActivationStore.updated, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in await self?.syncServer() }
        }
        observeActivities()
        Task { await refreshPermission(); syncAll() }
    }

    private func becameActive() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in Task { @MainActor in if self?.isReview == true { await self?.syncReviewServer() }; self?.syncActivities() } }
        Task { await refreshPermission(); if isReview { await syncReviewServer() }; syncAll() }
    }

    private func owns(_ chain: String) -> Bool { chain.hasPrefix("review-") == isReview }

    func configureReview(_ request: @escaping ([String: Any]) async throws -> (Int, [String: Any])) async {
        guard isReview else { return }
        Self.reviewActive = true
        reviewRequest = request
        start()
        await syncReviewServer()
    }

    func applyReviewResponse(_ value: [String: Any]) {
        guard isReview else { return }
        reviewPushReady = value["pushReady"] as? Bool == true
        if let state = value["state"], let chain = value["chain"] as? String, owns(chain),
           let data = try? JSONSerialization.data(withJSONObject: state),
           let decoded = try? JSONDecoder().decode(CourseActivityAttributes.ContentState.self, from: data) {
            reviewState = decoded; reviewChain = chain
        }
        if let schedule = value["schedule"], let data = try? JSONSerialization.data(withJSONObject: schedule),
           let json = String(data: data, encoding: .utf8) { receiveSchedule(json) }
        syncReviewActivities()
        publish()
    }

    private func syncReviewServer() async {
        guard let request = reviewRequest else { return }
        do {
            if defaults.bool(forKey: "reminder.pendingDelete") {
                let (status, _) = try await request(["op": "delete"])
                guard status == 200 else { serverProblem = true; publish(); return }
                defaults.removeObject(forKey: "reminder.pendingDelete")
                reviewPushReady = false
            }
            let encoded = try JSONEncoder().encode(settings)
            let prefs = try JSONSerialization.jsonObject(with: encoded)
            let (status, value) = try await request(["op": "prefs", "prefs": prefs])
            serverProblem = status != 200
            if status == 200 { applyReviewResponse(value) }
        } catch { serverProblem = true; publish() }
    }

    func testReviewNotification() async -> Bool {
        guard isReview, settings.enabled, settings.notify else { return false }
        await requestPermission()
        guard notificationsAllowed == true else { publish(); return false }
        let content = UNMutableNotificationContent()
        content.title = "课前通知演示"
        content.body = "SOE106TC · Programming with C++ · DE-2001（演示课程）"
        content.sound = .default
        do {
            try await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: notificationPrefix + "test", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)))
            return true
        } catch { return false }
    }

    // MARK: web bridge

    func receiveSchedule(_ json: String) {
        guard json.utf8.count <= 65536, let data = json.data(using: .utf8), let value = try? JSONDecoder().decode(ReminderSchedule.self, from: data),
              value.version == 1, value.courses.count <= 60 else { return }
        guard value != schedule else { return }
        schedule = value
        defaults.set(data, forKey: "reminder.schedule")
        syncAll()
    }

    func receiveChange(_ json: String) {
        guard json.utf8.count <= 2000, let data = json.data(using: .utf8), let change = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        var next = settings
        var uploadChanged = false
        if let decided = change["decided"] as? Bool, decided { next.decided = true }
        if let enabled = change["enabled"] as? Bool { next.enabled = enabled; if enabled { next.decided = true } }
        // Builds before D-021 (and the self-check) send one exclusive mode.
        if let mode = change["mode"] as? String, ["island", "notify"].contains(mode) { next.island = mode == "island"; next.notify = mode == "notify" }
        if let channel = change["channel"] as? [String: Any], let key = channel["key"] as? String, let on = channel["on"] as? Bool {
            if key == "island" { next.island = on } else if key == "notify" { next.notify = on }
        }
        // Both channels off means reminders off (D-021). One channel stays selected for the next time reminders are
        // switched on, so "on" never means "on but nothing reminds".
        if !next.island && !next.notify { next.island = true; if !(next.enabled && !settings.enabled) { next.enabled = false } }
        if let lead = change["leadMin"] as? Int, ReminderSettings.leadChoices.contains(lead) { next.leadMin = lead }
        if let merge = change["merge"] as? Bool { next.merge = merge }
        if let mute = change["mute"] as? [String: Any], let code = mute["code"] as? String, !code.isEmpty, code.count <= 40, let muted = mute["muted"] as? Bool {
            next.mutedCodes.removeAll { $0 == code }
            if muted { next.mutedCodes.append(code) }
        }
        if let upload = change["upload"] as? Bool, upload != next.upload { next.upload = upload; uploadChanged = true }
        if change["openSettings"] as? Bool == true, let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
        guard next != settings else { publish(); return }
        let turnedOn = next.enabled && (!settings.enabled || (next.notify && !settings.notify))
        settings = next
        if let data = try? JSONEncoder().encode(settings) { defaults.set(data, forKey: "reminder.settings") }
        Task {
            if turnedOn { await requestPermission() }
            if uploadChanged && !settings.upload { await deleteServerDevice() }
            syncAll()
        }
    }

    // Logout: the timetable belongs to that account.
    func clearForLogout() {
        if isReview { reviewState = nil; reviewChain = nil; reviewPushReady = false; Self.reviewActive = false }
        schedule = nil
        defaults.removeObject(forKey: "reminder.schedule")
        if settings.upload { settings.upload = false; if let data = try? JSONEncoder().encode(settings) { defaults.set(data, forKey: "reminder.settings") }; Task { await deleteServerDevice() } }
        syncAll()
    }

    func webStateScript() -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: webState()), let json = String(data: data, encoding: .utf8) else { return "" }
        return "window.__amsCourseReminderBridge=true;window.__amsSetCourseReminder&&window.__amsSetCourseReminder(\(json))"
    }

    private func webState() -> [String: Any] {
        var status = ""
        var link = false
        let activitiesOn = ActivityAuthorizationInfo().areActivitiesEnabled
        let notificationsOff = notificationsAllowed == false
        if settings.enabled {
            if notificationsOff && (settings.notify || !activitiesOn) { status = "系统通知已关闭，课前不会弹出提醒。"; link = true }
            else if settings.island && !activitiesOn { status = "系统设置中已关闭 AMS 的实时活动，暂时改用课前通知。"; link = true }
            else if schedule == nil { status = "打开课表后会自动安排提醒。" }
            else {
                let count = upcoming().count
                status = count > 0 ? "已安排 \(count) 节课的提醒（学校只提供 3 天课表，请隔几天打开一次 App）。" : "接下来 3 天内没有需要提醒的课程。"
            }
            if settings.upload && serverProblem { status += " 提醒服务器暂时连不上，已改用本机提醒。" }
            else if settings.upload && !serverReady && schedule != nil { status += " 自动提醒尚未就绪，暂时保留课前通知。" }
            if useIsland && !settings.upload { status += " 未开启“未打开 App 也提醒”时，灵动岛下课后要打开 App 才会收起，连堂不会自动切到下一节。" }
        }
        // D-021 page: two independent channels; a channel blocked by a system setting is greyed with its own reason.
        let channels: [[String: Any]] = [
            ["key": "island", "label": "灵动岛与锁屏", "short": "灵动岛", "detail": "上课前倒计时、上课中进度，显示在灵动岛和锁屏", "on": settings.island,
             "blocked": !activitiesOn, "blockedText": "系统设置中已关闭 AMS 的实时活动"],
            ["key": "notify", "label": "课前通知", "short": "通知", "detail": "上课前弹出一条通知", "on": settings.notify,
             "blocked": notificationsOff, "blockedText": "系统通知已关闭"]
        ]
        var seen = Set<String>(), courses: [[String: String]] = []
        for course in schedule?.courses ?? [] where !course.code.isEmpty && seen.insert(course.code).inserted { courses.append(["code": course.code, "title": course.title]) }
        return ["available": true, "decided": settings.decided, "enabled": settings.enabled, "channels": channels,
                "leadMin": settings.leadMin, "merge": settings.merge, "mutedCodes": settings.mutedCodes, "courses": courses,
                "upload": ["available": true, "enabled": settings.upload], "status": status, "settingsLink": link]
    }

    private func publish() { NotificationCenter.default.post(name: Self.stateChanged, object: nil) }

    // MARK: planning

    private func upcoming(now: Date? = nil) -> [ReminderItem] {
        guard let schedule else { return [] }
        let now = now ?? clock()
        return ReminderPlanner.items(schedule, settings).filter { $0.end > now }
    }

    // Chains are formed from the whole timetable so a chain keeps its first-class key after that class ends.
    // Without the push server nothing can move a Live Activity to the next class in the background, so local
    // activities (and their notification fallback) cover one class each.
    private func chains(now: Date? = nil) -> [[ReminderItem]] {
        let now = now ?? clock()
        guard let schedule else { return [] }
        var grouping = settings
        if !settings.upload { grouping.merge = false }
        return ReminderPlanner.chains(ReminderPlanner.items(schedule, grouping), grouping).filter { $0[$0.count - 1].end > now }
    }

    // Every class in the timetable, muted ones included (they still take place), for "classes left today".
    private func allClasses() -> [ReminderItem] {
        guard let schedule else { return [] }
        var all = settings; all.mutedCodes = []
        return ReminderPlanner.items(schedule, all)
    }

    private var useIsland: Bool { settings.enabled && settings.island && ActivityAuthorizationInfo().areActivitiesEnabled }

    private func syncAll() {
        guard !normalSuspended else { return }
        pruneEnded()
        syncActivities()
        Task {
            await syncNotifications()
            await syncServer()
            publish()
        }
    }

    private func pruneEnded() {
        let cutoff = Date().addingTimeInterval(-2 * 86400).timeIntervalSince1970
        endedChains = endedChains.filter { $0.value > cutoff }
        defaults.set(endedChains, forKey: "reminder.ended")
    }

    // MARK: Live Activities

    func syncActivities() {
        guard !normalSuspended else { return }
        if isReview { syncReviewActivities(); return }
        let now = clock()
        let current = useIsland ? chains().first { ReminderPlanner.window($0, settings).contains(now) && endedChains[$0[0].course.key] == nil } : nil
        let currentKey = current?[0].course.key
        var hasCurrent = false
        for activity in Activity<CourseActivityAttributes>.activities where owns(activity.attributes.chain) {
            let pending: Bool
            if #available(iOS 26.0, *) { pending = activity.activityState == .pending } else { pending = false }
            if activity.attributes.chain == currentKey, !hasCurrent, !pending, let current, let value = ReminderPlanner.state(current, at: now, day: allClasses()) {
                hasCurrent = true
                if activity.content.state != value.state {
                    Task { await activity.update(ActivityContent(state: value.state, staleDate: value.stale)) }
                }
            } else if pending && useIsland && !settings.upload && endedChains[activity.attributes.chain] == nil && chains().contains(where: { $0[0].course.key == activity.attributes.chain }) {
                continue   // a future scheduled start (iOS 26) that still matches the timetable
            } else {
                appEnding.insert(activity.id)
                let final = activity.content.state
                Task { await activity.end(ActivityContent(state: final, staleDate: nil), dismissalPolicy: .immediate) }
            }
        }
        if let current, !hasCurrent, let value = ReminderPlanner.state(current, at: now, day: allClasses()) {
            do {
                _ = try Activity.request(attributes: CourseActivityAttributes(chain: current[0].course.key),
                                         content: ActivityContent(state: value.state, staleDate: value.stale),
                                         pushType: settings.upload ? .token : nil)
                reportActivity(chain: current[0].course.key, ["local": true])
            } catch {}
        }
        scheduleNextStart(after: now, current: currentKey)
    }

    // The reviewer chooses a server-owned timeline; epoch dates also work across midnight.
    private func syncReviewActivities() {
        let state = reviewState, chain = reviewChain
        let active = useIsland && state?.phase != "after" && (state?.endDate ?? .distantPast) > Date()
            && !settings.mutedCodes.contains("SOE106TC") && chain.map { endedChains[$0] == nil } == true
        var found = false
        for activity in Activity<CourseActivityAttributes>.activities where owns(activity.attributes.chain) {
            if active, activity.attributes.chain == chain, reviewPushModes[activity.id] == settings.upload, let state {
                found = true
                if activity.content.state != state { Task { await activity.update(ActivityContent(state: state, staleDate: state.phase == "before" ? state.startDate : state.endDate)) } }
            } else {
                appEnding.insert(activity.id)
                Task { await activity.end(nil, dismissalPolicy: .immediate) }
            }
        }
        if active, !found, let chain, let state {
            if let activity = try? Activity.request(attributes: CourseActivityAttributes(chain: chain),
                                     content: ActivityContent(state: state, staleDate: state.phase == "before" ? state.startDate : state.endDate),
                                     pushType: settings.upload ? .token : nil) {
                reviewPushModes[activity.id] = settings.upload
                defaults.set(reviewPushModes, forKey: "reminder.reviewPushModes")
            }
        }
    }

    // iOS 26: without the push server, schedule the next chain to start on its own.
    private func scheduleNextStart(after now: Date, current: String?) {
        guard #available(iOS 26.0, *), useIsland, !settings.upload else { return }
        let pending = Activity<CourseActivityAttributes>.activities.filter { $0.activityState == .pending && owns($0.attributes.chain) }
        guard pending.isEmpty, let next = chains().first(where: { $0[0].course.key != current && ReminderPlanner.window($0, settings).lowerBound > now && endedChains[$0[0].course.key] == nil }) else { return }
        let begin = ReminderPlanner.window(next, settings).lowerBound
        guard let value = ReminderPlanner.state(next, at: begin, day: allClasses()) else { return }
        let alert = AlertConfiguration(title: "即将上课", body: "\(next[0].course.title)\(next[0].course.room.isEmpty ? "" : " · \(next[0].course.room)") · \(next[0].course.start) 开始", sound: .default)
        _ = try? Activity.request(attributes: CourseActivityAttributes(chain: next[0].course.key),
                                  content: ActivityContent(state: value.state, staleDate: value.stale),
                                  pushType: nil, style: .standard, alertConfiguration: alert, start: begin)
    }

    func userEnded(chain: String) async {
        if !isReview, chain.hasPrefix("review-") { await Self.review.userEnded(chain: chain); return }
        guard owns(chain) else { return }
        endedChains[chain] = Date().timeIntervalSince1970
        defaults.set(endedChains, forKey: "reminder.ended")
        // Not awaited: ActivityKit can leave an end request unanswered, which would stall the button's intent.
        for activity in Activity<CourseActivityAttributes>.activities where activity.attributes.chain == chain {
            appEnding.insert(activity.id)
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        reportActivity(chain: chain, ["ended": true])
        publish()
    }

    private func observeActivities() {
        if !isReview, #available(iOS 17.2, *) {
            Task {
                for await data in Activity<CourseActivityAttributes>.pushToStartTokenUpdates {
                    defaults.set(Self.hex(data), forKey: "reminder.startToken")
                    defaults.removeObject(forKey: "reminder.startTokenSent")
                    if settings.upload { await sendStartToken(Self.hex(data)) }
                }
            }
        }
        for activity in Activity<CourseActivityAttributes>.activities where owns(activity.attributes.chain) { observe(activity) }
        Task { for await activity in Activity<CourseActivityAttributes>.activityUpdates { observe(activity) } }
    }

    private func observe(_ activity: Activity<CourseActivityAttributes>) {
        guard owns(activity.attributes.chain), observed.insert(activity.id).inserted else { return }
        let chain = activity.attributes.chain, id = activity.id
        Task { for await data in activity.pushTokenUpdates { reportActivity(chain: chain, ["updateToken": Self.hex(data)]) } }
        Task {
            for await state in activity.activityStateUpdates where state == .dismissed || state == .ended {
                // Ended before the class finished and not by the app: the person removed it.
                if !appEnding.contains(id), activity.content.state.endDate > Date(), activity.content.state.phase != "after" {
                    endedChains[chain] = Date().timeIntervalSince1970
                    defaults.set(endedChains, forKey: "reminder.ended")
                    reportActivity(chain: chain, ["ended": true])
                }
                break
            }
        }
    }

    // MARK: notifications

    private func refreshPermission() async {
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        notificationsAllowed = status == .notDetermined ? nil : [.authorized, .provisional, .ephemeral].contains(status)
    }

    private func requestPermission() async {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
        notificationsAllowed = granted
    }

    private func syncNotifications() async {
        guard !normalSuspended else { return }
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(notificationPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: pending)
        guard settings.enabled, notificationsAllowed == true, let schedule else { return }
        // A chain's notification is dropped only when its Live Activity is confirmed to appear without the app:
        // already showing, scheduled to start on this phone (iOS 26), or the push server is fully ready.
        var showing = Set<String>(), scheduled = Set<String>()
        for activity in Activity<CourseActivityAttributes>.activities where owns(activity.attributes.chain) {
            if #available(iOS 26.0, *), activity.activityState == .pending { scheduled.insert(activity.attributes.chain) }
            else if activity.activityState == .active { showing.insert(activity.attributes.chain) }
        }
        let server = serverReady
        let now = clock(), lead = TimeInterval(settings.leadMin * 60)
        var count = 0
        for chain in chains() where endedChains[chain[0].course.key] == nil {
            let key = chain[0].course.key
            // Pre-class notification: when its switch is on, or as the fallback while the Live Activity cannot appear.
            if !settings.notify && useIsland && (showing.contains(key) || scheduled.contains(key) || server) { continue }
            for item in chain where count < 50 {
                let fire = item.start.addingTimeInterval(-lead)
                guard fire > now else { continue }
                let content = UNMutableNotificationContent()
                content.title = "\(settings.leadMin) 分钟后上课"
                content.body = "\(item.course.title)\(item.course.room.isEmpty ? "" : " · \(item.course.room)") · \(item.course.start) 开始"
                content.sound = .default
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: fire.timeIntervalSince(now), repeats: false)
                try? await center.add(UNNotificationRequest(identifier: notificationPrefix + item.course.key, content: content, trigger: trigger))
                count += 1
            }
        }
        // Only three days are available from the school; remind the person to refresh before they run out.
        if let last = schedule.dates.max(), let fire = ReminderPlanner.date(last, "20:00"), fire > now {
            let content = UNMutableNotificationContent()
            content.title = "课程提醒需要更新课表"
            content.body = "学校只提供 3 天课表，打开 AMS 刷新后，才能继续提醒之后的课程。"
            try? await center.add(UNNotificationRequest(identifier: notificationPrefix + "refresh", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: fire.timeIntervalSince(now), repeats: false)))
        }
    }

    // MARK: push server (only with the person's consent)

    // The server can start Live Activities only when registered, holding this phone's start token and the
    // current timetable, and reporting that its APNs key is configured.
    private var serverReady: Bool {
        if isReview { return settings.upload && reviewPushReady && !serverProblem }
        return settings.upload && !serverProblem && defaults.bool(forKey: "reminder.registered") && defaults.bool(forKey: "reminder.pushReady")
            && defaults.bool(forKey: "reminder.startTokenSent") && uploadBody() != nil && defaults.data(forKey: "reminder.uploadedTimetable") == uploadBody()
    }

    private func uploadBody() -> Data? {
        guard let schedule else { return nil }
        let courses = schedule.courses.map { ["key": $0.key, "date": $0.date, "start": $0.start, "end": $0.end, "title": $0.title, "code": $0.code, "room": $0.room, "location": $0.location ?? ""] }
        // Coverage tells the server which dates the snapshot spans, so a day without classes is not read as missing data.
        let coverage: [String: String] = schedule.dates.min().map { ["from": $0, "to": schedule.dates.max() ?? $0] } ?? [:]
        // accountRevision binds the snapshot to the current school account; the server refuses a late upload for a previous one.
        return try? JSONSerialization.data(withJSONObject: ["courses": courses, "coverage": coverage, "accountRevision": defaults.integer(forKey: "account.revision")], options: [.sortedKeys])
    }

    private func syncServer() async {
        guard !normalSuspended else { return }
        if isReview { await syncReviewServer(); return }
        guard settings.upload else { await retryPendingDelete(); return }
        defaults.removeObject(forKey: "reminder.pendingDelete")   // re-enabled before a pending delete finished
        if !defaults.bool(forKey: "reminder.registered") {
            #if DEBUG
            let env = "sandbox"
            #else
            let env = "production"
            #endif
            // The registration proves which activated installation it belongs to (ADMIN-BE-001); a disabled device is refused.
            let deviceId = credential("reminder.deviceId", UUID().uuidString)
            guard let link = ActivationStore.linkProof(deviceId: deviceId) else { return }
            let (ok, _, _) = await call("POST", "/register", ["consent": true, "deviceId": deviceId, "secret": credential("reminder.secret", Self.randomSecret()), "platform": "ios", "bundleId": Bundle.main.bundleIdentifier ?? "", "apnsEnv": env, "link": link], auth: false)
            guard ok else { return }
            defaults.set(true, forKey: "reminder.registered"); defaults.set(true, forKey: "reminder.linked")
        }
        // Registered before installations were linked: link once.
        if !defaults.bool(forKey: "reminder.linked"), let link = ActivationStore.linkProof(deviceId: KeychainStore.read("reminder.deviceId")) {
            let (ok, _, _) = await call("PUT", "/link", ["link": link])
            if ok { defaults.set(true, forKey: "reminder.linked") }
        }
        if !defaults.bool(forKey: "reminder.startTokenSent"), let token = defaults.string(forKey: "reminder.startToken") { await sendStartToken(token) }
        await call("PUT", "/prefs", ["enabled": useIsland, "leadMin": settings.leadMin, "merge": settings.merge, "mutedCodes": settings.mutedCodes, "skipKeys": []])
        // Upload whenever the server's copy differs from the latest snapshot, including after a failed attempt.
        if let body = uploadBody(), defaults.data(forKey: "reminder.uploadedTimetable") != body,
           let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any] {
            let (ok, _, _) = await call("PUT", "/timetable", object)
            if ok { defaults.set(body, forKey: "reminder.uploadedTimetable") }
        }
        for (chain, _) in endedChains { await call("PUT", "/activity", ["chain": chain, "ended": true]) }
    }

    private func sendStartToken(_ token: String) async {
        guard !isReview, !normalSuspended else { return }
        let (ok, _, _) = await call("PUT", "/token", ["startToken": token])
        if ok { defaults.set(true, forKey: "reminder.startTokenSent") }
    }

    // Withdrawal keeps the credentials until the server confirms the deletion, retrying on later syncs.
    private func deleteServerDevice() async {
        if isReview {
            defaults.set(true, forKey: "reminder.pendingDelete")
            await syncReviewServer()
            return
        }
        defaults.set(true, forKey: "reminder.pendingDelete")
        await retryPendingDelete()
    }

    private func retryPendingDelete() async {
        guard defaults.bool(forKey: "reminder.pendingDelete") else { return }
        if defaults.bool(forKey: "reminder.registered"), !KeychainStore.read("reminder.deviceId").isEmpty {
            let (ok, status, _) = await call("DELETE", "/device", nil)
            guard ok || status == 401 else { return }   // 401: the server no longer knows this device
        }
        for key in ["reminder.pendingDelete", "reminder.registered", "reminder.uploadedTimetable", "reminder.startTokenSent", "reminder.pushReady", "reminder.linked", "reminder.alertTokenSent"] { defaults.removeObject(forKey: key) }
        KeychainStore.save("", account: "reminder.deviceId")
        KeychainStore.save("", account: "reminder.secret")
        serverProblem = false
    }

    private func reportActivity(chain: String, _ fields: [String: Any]) {
        if isReview {
            guard owns(chain), settings.upload || fields["ended"] as? Bool == true, let request = reviewRequest else { return }
            var body = fields; body["op"] = "activity"; body["chain"] = chain
            body["bundleId"] = Bundle.main.bundleIdentifier ?? ""
            #if DEBUG
            body["apnsEnv"] = "sandbox"
            #else
            body["apnsEnv"] = "production"
            #endif
            Task { if let (status, value) = try? await request(body), status == 200 { applyReviewResponse(value) } }
            return
        }
        guard !normalSuspended, settings.upload, defaults.bool(forKey: "reminder.registered") else { return }
        var body = fields; body["chain"] = chain
        Task { await call("PUT", "/activity", body) }
    }

    @discardableResult
    private func call(_ method: String, _ path: String, _ body: [String: Any]?, auth: Bool = true) async -> (ok: Bool, status: Int, json: [String: Any]?) {
        var request = URLRequest(url: Self.server.appendingPathComponent(String(path.dropFirst())), timeoutInterval: 15)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if auth {
            let id = KeychainStore.read("reminder.deviceId"), secret = KeychainStore.read("reminder.secret")
            guard !id.isEmpty, !secret.isEmpty else { return (false, 0, nil) }
            request.setValue(id, forHTTPHeaderField: "X-AMS-Device")
            request.setValue("Bearer \(secret)", forHTTPHeaderField: "Authorization")
        }
        if let body { request.httpBody = try? JSONSerialization.data(withJSONObject: body) }
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            // Unknown device or a different secret: register again from scratch next time.
            if status == 401 || (status == 409 && path == "/register") {
                for key in ["reminder.registered", "reminder.uploadedTimetable", "reminder.startTokenSent", "reminder.linked", "reminder.alertTokenSent"] { defaults.removeObject(forKey: key) }
                KeychainStore.save("", account: "reminder.deviceId"); KeychainStore.save("", account: "reminder.secret")
            }
            if let push = json?["push"] as? Bool { defaults.set(push, forKey: "reminder.pushReady") }
            serverProblem = !(200..<300).contains(status)
            return (!serverProblem, status, json)
        } catch {
            serverProblem = true
            return (false, 0, nil)
        }
    }

    private func credential(_ account: String, _ fresh: @autoclosure () -> String) -> String {
        let value = KeychainStore.read(account)
        if !value.isEmpty { return value }
        let created = fresh(); KeychainStore.save(created, account: account); return created
    }

    private static func randomSecret() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private static func hex(_ data: Data) -> String { data.map { String(format: "%02x", $0) }.joined() }
}

extension CourseReminderCenter: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
