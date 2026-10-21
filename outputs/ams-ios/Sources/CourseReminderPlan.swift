import Foundation

// REMIND-001 planning, mirroring outputs/ams-notify/src/schedule.mjs. School times are China Standard Time.
struct ReminderCourse: Codable, Hashable {
    let key: String
    let date: String
    let start: String
    let end: String
    let rawEnd: String?
    let title: String
    let code: String
    let room: String
    let location: String?
}

struct ReminderSchedule: Codable, Equatable {
    let version: Int
    let dates: [String]
    let courses: [ReminderCourse]
}

struct ReminderSettings: Codable, Equatable {
    var decided = false          // the first-login choice (cloud / local / off) has been made
    var enabled = false
    // D-021: two independent channels instead of one "mode". When the Live Activity cannot be shown (system setting),
    // the pre-class notification still covers that class.
    var island = true            // Live Activity on the Dynamic Island and lock screen
    var notify = false           // a notification before each class
    var leadMin = 15
    var merge = true
    var mutedCodes: [String] = []
    var upload = false
    static let leadChoices = [5, 10, 15, 20, 30]

    private enum CodingKeys: String, CodingKey { case decided, enabled, island, notify, mode, leadMin, merge, mutedCodes, upload }
    init() {}
    // Missing keys (settings saved by an older build) keep their defaults instead of failing the whole decode.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        decided = try c.decodeIfPresent(Bool.self, forKey: .decided) ?? false
        enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
        // Builds before D-021 stored mode "island" (Live Activity with notification fallback) or "notify".
        let legacy = try c.decodeIfPresent(String.self, forKey: .mode)
        island = try c.decodeIfPresent(Bool.self, forKey: .island) ?? (legacy != "notify")
        notify = try c.decodeIfPresent(Bool.self, forKey: .notify) ?? (legacy == "notify")
        leadMin = try c.decodeIfPresent(Int.self, forKey: .leadMin) ?? 15
        merge = try c.decodeIfPresent(Bool.self, forKey: .merge) ?? true
        mutedCodes = try c.decodeIfPresent([String].self, forKey: .mutedCodes) ?? []
        upload = try c.decodeIfPresent(Bool.self, forKey: .upload) ?? false
        if enabled || upload { decided = true }
        if !island && !notify { island = true; enabled = false }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(decided, forKey: .decided); try c.encode(enabled, forKey: .enabled)
        try c.encode(island, forKey: .island); try c.encode(notify, forKey: .notify)
        try c.encode(leadMin, forKey: .leadMin); try c.encode(merge, forKey: .merge)
        try c.encode(mutedCodes, forKey: .mutedCodes); try c.encode(upload, forKey: .upload)
    }
}

struct ReminderItem: Equatable {
    let course: ReminderCourse
    let start: Date
    let end: Date
}

enum ReminderPlanner {
    static let mergeGap: TimeInterval = 30 * 60
    static let maxSpan: TimeInterval = 8 * 3600
    static let linger: TimeInterval = 5 * 60
    static let china = TimeZone(identifier: "Asia/Shanghai")!

    static func date(_ day: String, _ time: String) -> Date? {
        let d = day.split(separator: "-").compactMap { Int($0) }, t = time.split(separator: ":").compactMap { Int($0) }
        guard d.count == 3, t.count == 2, (0...23).contains(t[0]), (0...59).contains(t[1]) else { return nil }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = china
        let parts = DateComponents(year: d[0], month: d[1], day: d[2], hour: t[0], minute: t[1])
        guard let value = calendar.date(from: parts), calendar.component(.day, from: value) == d[2] else { return nil }
        return value
    }

    static func items(_ schedule: ReminderSchedule, _ settings: ReminderSettings) -> [ReminderItem] {
        schedule.courses.compactMap { c in
            guard !settings.mutedCodes.contains(c.code), let s = date(c.date, c.start), let e = date(c.date, c.end), e > s else { return nil }
            return ReminderItem(course: c, start: s, end: e)
        }.sorted { $0.start < $1.start }
    }

    static func chains(_ items: [ReminderItem], _ settings: ReminderSettings) -> [[ReminderItem]] {
        var out: [[ReminderItem]] = []
        let lead = TimeInterval(settings.leadMin * 60)
        for item in items {
            if settings.merge, let last = out.last, let tail = last.last, item.start >= tail.end, item.start.timeIntervalSince(tail.end) <= mergeGap,
               item.end.addingTimeInterval(linger).timeIntervalSince(last[0].start.addingTimeInterval(-lead)) <= maxSpan {
                out[out.count - 1].append(item)
            } else { out.append([item]) }
        }
        return out
    }

    static func brief(_ i: ReminderItem) -> CourseActivityAttributes.Brief {
        .init(title: i.course.title, code: i.course.code, room: i.course.room, start: i.start.timeIntervalSince1970, end: i.end.timeIntervalSince1970)
    }

    // State at `now`, or nil once the whole chain has ended. A "before" state goes stale exactly at class start, so a
    // Live Activity that receives no update (local mode, app in background) is redrawn as "in class" at that moment.
    // `day` is every class of the timetable (muted ones included) for the "classes left today" count.
    static func state(_ chain: [ReminderItem], at now: Date, day: [ReminderItem] = []) -> (state: CourseActivityAttributes.ContentState, stale: Date)? {
        for (index, item) in chain.enumerated() {
            let next = index + 1 < chain.count ? brief(chain[index + 1]) : nil
            func make(_ phase: String) -> CourseActivityAttributes.ContentState {
                .init(phase: phase, title: item.course.title, code: item.course.code, room: item.course.room, location: item.course.location, start: item.start.timeIntervalSince1970, end: item.end.timeIntervalSince1970, next: next,
                      left: day.filter { $0.course.date == item.course.date && $0.start > item.start }.count)
            }
            if now < item.start { return (make("before"), item.start) }
            if now < item.end { return (make("during"), item.end) }
        }
        return nil
    }

    static func window(_ chain: [ReminderItem], _ settings: ReminderSettings) -> ClosedRange<Date> {
        chain[0].start.addingTimeInterval(-TimeInterval(settings.leadMin * 60))...chain[chain.count - 1].end
    }
}
