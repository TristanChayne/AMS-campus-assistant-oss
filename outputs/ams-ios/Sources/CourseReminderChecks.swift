#if DEBUG
import ActivityKit
import Foundation
import SwiftUI
import UIKit

// REMIND-001 simulator self-check (--test-course-reminder). Synthetic timetable only; no school or server requests
// (upload stays off). Writes Documents/course-reminder-checks.json. With --keep-activity the last activity stays for screenshots.
@MainActor
enum CourseReminderChecks {
    static func run(keep: Bool) {
        Task {
            var results: [[String: Any]] = []
            func check(_ name: String, _ passed: Bool, _ detail: String = "") { results.append(["name": name, "passed": passed, "detail": detail]) }
            // Progress trail (Documents/course-reminder-progress.txt) so a stalled run shows where it stopped.
            let trail = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("course-reminder-progress.txt")
            try? "".write(to: trail, atomically: true, encoding: .utf8)
            func step(_ name: String) { if let h = try? FileHandle(forWritingTo: trail) { h.seekToEndOfFile(); h.write(Data("\(Date()) \(name)\n".utf8)); try? h.close() } }
            step("start")
            let center = CourseReminderCenter.shared
            let f = DateFormatter(); f.timeZone = ReminderPlanner.china; f.dateFormat = "yyyy-MM-dd"
            let t = DateFormatter(); t.timeZone = ReminderPlanner.china; t.dateFormat = "HH:mm"
            // Live checks run against a fixed clock (tomorrow 12:00 China time) so they never cross midnight.
            let realNow = Date()
            let tomorrow = Calendar(identifier: .gregorian).date(byAdding: .day, value: 1, to: realNow)!
            let now = ReminderPlanner.date(f.string(from: tomorrow), "12:00")!
            let run = Int(realNow.timeIntervalSince1970)   // unique keys: ended chains persist between runs
            func course(_ key: String, _ startOffset: TimeInterval, _ minutes: TimeInterval, code: String) -> ReminderCourse {
                let s = now.addingTimeInterval(startOffset)
                return ReminderCourse(key: "\(key)-\(run)", date: f.string(from: s), start: t.string(from: s), end: t.string(from: s.addingTimeInterval(minutes * 60)), rawEnd: nil, title: "高等数学 \(key)", code: code, room: "SA169", location: nil)
            }

            // Planner (pure).
            let d = ReminderPlanner.date("2026-10-14", "09:00")
            check("china-time", d.map { Int($0.timeIntervalSince1970) } == 1_791_939_600, "\(String(describing: d))")
            check("invalid-date", ReminderPlanner.date("2026-02-30", "09:00") == nil)
            var s = ReminderSettings(); s.enabled = true
            // Fixed daytime classes so the planner checks never cross midnight.
            func fixed(_ key: String, _ start: String, _ end: String, code: String) -> ReminderCourse { ReminderCourse(key: key, date: "2026-10-14", start: start, end: end, rawEnd: nil, title: key, code: code, room: "SA169", location: nil) }
            let sched = ReminderSchedule(version: 1, dates: ["2026-10-14"], courses: [fixed("a", "09:00", "10:00", code: "A1"), fixed("b", "10:10", "11:10", code: "B1"), fixed("c", "13:20", "14:20", code: "C1")])
            let base = ReminderPlanner.date("2026-10-14", "08:00")!
            let chains = ReminderPlanner.chains(ReminderPlanner.items(sched, s), s)
            check("merge-gap", chains.map(\.count) == [2, 1], "\(chains.map(\.count))")
            s.merge = false
            check("merge-off", ReminderPlanner.chains(ReminderPlanner.items(sched, s), s).count == 3)
            s.mutedCodes = ["B1"]
            check("mute", ReminderPlanner.items(sched, s).map(\.course.code) == ["A1", "C1"])
            let st = ReminderPlanner.state(chains[0], at: base.addingTimeInterval(2 * 3600 + 5 * 60))
            check("between-classes-shows-next", st?.state.phase == "before" && st?.state.code == "B1", "\(String(describing: st?.state))")
            check("after-chain", ReminderPlanner.state(chains[0], at: base.addingTimeInterval(4 * 3600)) == nil)

            // Live Activity: a class starting in 5 minutes is inside the 15-minute window.
            // Fire and forget: an end request can stay unanswered while other apps' activities are running.
            for a in Activity<CourseActivityAttributes>.activities { Task { await a.end(nil, dismissalPolicy: .immediate) } }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            center.clock = { now }
            step("planner-done")
            check("activities-enabled", ActivityAuthorizationInfo().areActivitiesEnabled)
            center.receiveChange(#"{"enabled":true,"mode":"island","leadMin":15,"merge":true,"upload":false}"#)
            let live = ReminderSchedule(version: 1, dates: [f.string(from: now)], courses: [course("live1", 5 * 60, 50, code: "MTH101"), course("live2", 60 * 60, 50, code: "CPT102")])
            let data = try! JSONEncoder().encode(live)
            center.receiveSchedule(String(data: data, encoding: .utf8)!)
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            step("schedule-sent")
            var acts = Activity<CourseActivityAttributes>.activities.filter { $0.activityState == .active }
            check("starts-in-window", acts.count == 1 && acts.first?.attributes.chain == live.courses[0].key, "\(acts.map(\.attributes.chain))")
            // Without the push server each class is its own activity (nothing could switch it to the next class in the background).
            check("before-phase-local-single", acts.first?.content.state.phase == "before" && acts.first?.content.state.next == nil && acts.first?.content.staleDate == ReminderPlanner.date(live.courses[0].date, live.courses[0].start), "\(String(describing: acts.first?.content.state))")
            center.syncActivities()
            try? await Task.sleep(nanoseconds: 800_000_000)
            check("no-duplicate", Activity<CourseActivityAttributes>.activities.filter { $0.activityState == .active }.count == 1)

            step("live-started")
            // Switching to notification-only ends it; switching back restarts it.
            center.receiveChange(#"{"mode":"notify"}"#)
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            check("notify-mode-ends", Activity<CourseActivityAttributes>.activities.filter { $0.activityState == .active }.isEmpty)
            center.receiveChange(#"{"mode":"island"}"#)
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            acts = Activity<CourseActivityAttributes>.activities.filter { $0.activityState == .active }
            check("island-restarts", acts.count == 1)

            // Muting the course ends its activity.
            center.receiveChange(#"{"mute":{"code":"MTH101","muted":true}}"#)
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            check("mute-ends", Activity<CourseActivityAttributes>.activities.filter { $0.activityState == .active && $0.attributes.chain == live.courses[0].key }.isEmpty)
            center.receiveChange(#"{"mute":{"code":"MTH101","muted":false}}"#)
            try? await Task.sleep(nanoseconds: 1_000_000_000)

            step("mute-done")
            // The end button path: stays ended even after a resync.
            if let chain = Activity<CourseActivityAttributes>.activities.first(where: { $0.activityState == .active })?.attributes.chain {
                await center.userEnded(chain: chain)
                center.syncActivities()
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                check("user-end-sticks", Activity<CourseActivityAttributes>.activities.filter { $0.activityState == .active && $0.attributes.chain == chain }.isEmpty)
            } else { check("user-end-sticks", false, "no active activity") }

            step("user-end-done")
            // Web state for the settings page.
            let script = center.webStateScript()
            check("web-state", script.contains("__amsSetCourseReminder") && script.contains("\"available\":true"))

            center.clock = { Date() }
            // Screenshots need real time: one class in progress, the next soon after (skipped close to midnight).
            let realCourse = { (key: String, offset: TimeInterval, minutes: TimeInterval, code: String) -> ReminderCourse in
                let s = realNow.addingTimeInterval(offset)
                return ReminderCourse(key: "\(key)-\(run)", date: f.string(from: s), start: t.string(from: s), end: t.string(from: s.addingTimeInterval(minutes * 60)), rawEnd: nil, title: "高等数学 \(key)", code: code, room: "SA169", location: nil)
            }
            // --demo-before: the class starts in 10 minutes (inside the 15-minute window) to show the before-class look.
            let demoBefore = ProcessInfo.processInfo.arguments.contains("--demo-before")
            let nearMidnight = f.string(from: realNow) != f.string(from: realNow.addingTimeInterval((demoBefore ? 75 : 55) * 60))
            let withNext = f.string(from: realNow) == f.string(from: realNow.addingTimeInterval((demoBefore ? 115 : 90) * 60))
            if keep && !nearMidnight {
                let show = ReminderSchedule(version: 1, dates: [f.string(from: realNow)], courses: [realCourse("show1", demoBefore ? 10 * 60 : -10 * 60, 60, "MTH101")] + (withNext ? [realCourse("show2", demoBefore ? 80 * 60 : 60 * 60, 30, "CPT102")] : []))
                center.receiveSchedule(String(data: try! JSONEncoder().encode(show), encoding: .utf8)!)
            } else {
                center.receiveChange(#"{"enabled":false}"#)
            }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            // --demo-second: an extra independent activity (another class, in progress) so two Live Activities run
            // at once and the system shows the minimal presentation. Ends the next time the app syncs in the foreground.
            if keep && ProcessInfo.processInfo.arguments.contains("--demo-second") {
                let second = CourseActivityAttributes.ContentState(phase: "during", title: "线性代数", code: "MTH103", room: "SB222", location: nil,
                    start: realNow.addingTimeInterval(-5 * 60).timeIntervalSince1970, end: realNow.addingTimeInterval(45 * 60).timeIntervalSince1970, next: nil, left: 0)
                do {
                    _ = try Activity.request(attributes: CourseActivityAttributes(chain: "demo-second-\(run)"),
                                             content: ActivityContent(state: second, staleDate: realNow.addingTimeInterval(45 * 60)), pushType: nil)
                    check("demo-second-started", true)
                } catch { check("demo-second-started", false, "\(error)") }
            }
            if keep && nearMidnight { check("keep-shows-current", true, "skipped: less than 55 minutes before midnight") }
            if keep && !nearMidnight {
                let shown = Activity<CourseActivityAttributes>.activities.map { "\($0.attributes.chain):\($0.activityState):\($0.content.state.phase):left=\($0.content.state.left ?? -1)" }
                check("keep-shows-current", shown.contains { $0.hasPrefix("show1-") && $0.contains("active:\(demoBefore ? "before" : "during"):left=\(withNext ? 1 : 0)") }, shown.joined(separator: ","))
            }
            step("keep-done")
            // Height budget (REMIND-LAYOUT-002): the island and lock screen are capped at 160 pt by the system.
            func measure<V: View>(_ view: V, width: CGFloat, size: DynamicTypeSize) -> CGFloat {
                let host = UIHostingController(rootView: view.environment(\.dynamicTypeSize, size).environment(\.colorScheme, .dark))
                return host.sizeThatFits(in: CGSize(width: width, height: .greatestFiniteMagnitude)).height
            }
            let sample = CourseActivityAttributes.ContentState(phase: "during", title: "概率论与数理统计及其在工程实践中的应用", code: "MTH101", room: "Science Building SA169", location: nil,
                start: realNow.addingTimeInterval(-600).timeIntervalSince1970, end: realNow.addingTimeInterval(2400).timeIntervalSince1970, next: nil, left: 2)
            let samplePhase = CoursePhase(state: sample, stale: false)
            let islandWidth: CGFloat = 371 - 2 * IslandGeometry.margin
            for size in [DynamicTypeSize.large, .accessibility3] {
                let body = measure(CourseIslandBody(phase: samplePhase, chain: "x"), width: islandWidth, size: size)
                let card = measure(CourseCard(phase: samplePhase, chain: "x"), width: 374, size: size)
                // Island: bottom region plus ~52 pt for the camera row and margins must stay under 160.
                check("height-island-\(size)", body + 52 <= 150, "bottom=\(Int(body.rounded())) total≈\(Int((body + 52).rounded()))")
                check("height-lock-\(size)", card <= 155, "card=\(Int(card.rounded()))")
            }
            step("heights-done")
            // Compact slots are 52.33 pt on standard iPhones: the live minutes must not reserve more.
            let compact = UIHostingController(rootView: CompactTrailing(phase: samplePhase).environment(\.colorScheme, .dark))
                .sizeThatFits(in: CGSize(width: 200, height: 36.67)).width   // finite proposal: an infinite one never settles
            check("compact-trailing-width", compact <= 52.33, "width=\(Int(compact.rounded()))")
            step("compact-done")
            let passed = results.allSatisfy { $0["passed"] as? Bool == true }
            if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
               let json = try? JSONSerialization.data(withJSONObject: ["passed": passed, "results": results], options: [.prettyPrinted, .sortedKeys]) {
                try? json.write(to: dir.appendingPathComponent("course-reminder-checks.json"))
            }
        }
    }
}
#endif
