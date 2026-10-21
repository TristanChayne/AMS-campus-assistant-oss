import ActivityKit
import AppIntents
import Foundation

// REMIND-001. Compiled into both the app and the Live Activity extension.
// ContentState must match outputs/ams-notify/src/schedule.mjs contentState(): epoch seconds, not Date,
// because APNs content-state is decoded with the default JSONDecoder.
struct CourseActivityAttributes: ActivityAttributes {
    struct Brief: Codable, Hashable {
        var title: String
        var code: String
        var room: String
        var start: Double
        var end: Double
    }
    struct ContentState: Codable, Hashable {
        var phase: String          // before | during | after
        var title: String
        var code: String
        var room: String
        var location: String?
        var start: Double
        var end: Double
        var next: Brief?
        var left: Int?             // classes later the same day, not counting this one
        var startDate: Date { Date(timeIntervalSince1970: start) }
        var endDate: Date { Date(timeIntervalSince1970: end) }
    }
    var chain: String
}

// Lock screen / Dynamic Island button. LiveActivityIntent runs in the app process.
struct EndCourseReminderIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "结束课程提醒"
    static var isDiscoverable = false
    @Parameter(title: "Chain") var chain: String
    init() { chain = "" }
    init(chain: String) { self.chain = chain }
    func perform() async throws -> some IntentResult {
        #if AMS_APP
        await CourseReminderCenter.shared.userEnded(chain: chain)
        #endif
        return .result()
    }
}
