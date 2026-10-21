import AppIntents
import SwiftUI

// REMIND-LAYOUT-002 course Live Activity views. Compiled into the app (for the height-budget self-check) and the
// Live Activity extension. Expanded look follows the approved GPT layout; geometry follows Apple's HIG:
// expanded island 371/408 x 84-160 pt with a 44 pt corner radius, inner radius = outer radius - margin.
// No second-by-second countdowns: iOS 18+ remaining minutes (system-refreshed), iOS 17 end time.

let campusBlue = Color(red: 0x6F/255, green: 0xA0/255, blue: 0xFF/255)
let courseScanURL = URL(string: "amscampus://scan")!

enum IslandGeometry {
    static let outerRadius: CGFloat = 44
    static let margin: CGFloat = 18                   // one margin on every expanded edge
    static var concentricRadius: CGFloat { outerRadius - margin }
    // Extra inset for the two short labels beside the camera, which sit inside the top corner curves.
    static let cornerLabelInset: CGFloat = 10
}

func courseClock(_ date: Date) -> String {
    let f = DateFormatter(); f.dateFormat = "HH:mm"; f.timeZone = TimeZone(identifier: "Asia/Shanghai")
    return f.string(from: date)
}

struct CoursePhase {
    let state: CourseActivityAttributes.ContentState
    let stale: Bool
    // A stale "before" state means class has started without an update reaching the phone.
    var after: Bool { state.phase == "after" || Date() >= state.endDate }
    var during: Bool { !after && (state.phase == "during" || (state.phase == "before" && (stale || Date() >= state.startDate))) }
    var label: String { after ? "已下课" : during ? "正在上课" : "即将上课" }
    var icon: String { after ? "checkmark.circle" : during ? "book" : "bell" }
    var left: String {
        guard let left = state.left else { return "" }
        return left > 0 ? "今日还剩 \(left) 节" : "今日最后一节"
    }
    var leftShort: String {
        guard let left = state.left else { return "" }
        return left > 0 ? "还剩 \(left) 节" : "最后一节"
    }
    var codePrefix: String {
        let code = state.code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let range = code.range(of: #"^[A-Za-z]+"#, options: .regularExpression) else { return "" }
        return String(code[range]).uppercased()
    }
}

/// Minutes until `target` (iOS 18+, system-refreshed, no seconds) or the clock time on iOS 17.
/// The live DateOffset text reserves width for its longest possible value and draws the glyphs at the leading
/// edge of that reservation, so it is always trailing-aligned and given a bounded frame by the caller.
struct CourseMinutes: View {
    let target: Date
    var body: some View {
        if #available(iOS 18.0, *) {
            Text(.currentDate, format: .offset(to: target, allowedFields: [.minute], maxFieldCount: 1, sign: .never))
                .monospacedDigit().multilineTextAlignment(.trailing)
        } else {
            Text(courseClock(target)).monospacedDigit()
        }
    }
}

/// Big value + small caption: "32 分钟" / "后下课" (iOS 18+) or "11:40" / "下课" (iOS 17).
struct CourseRemaining: View {
    let phase: CoursePhase
    var body: some View {
        VStack(alignment: .trailing, spacing: 0) {
            if phase.after {
                Text("已下课").font(.title3.weight(.semibold))
            } else {
                CourseMinutes(target: phase.during ? phase.state.endDate : phase.state.startDate)
                    .font(.title3.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.85)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                Text(caption).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
        }
    }
    private var caption: String {
        if #available(iOS 18.0, *) { return phase.during ? "后下课" : "后上课" }
        return phase.during ? "下课" : "上课"
    }
}

/// Linear progress driven by the system clock (moves without updates).
struct CourseProgress: View {
    let phase: CoursePhase
    var body: some View {
        if phase.during {
            ProgressView(timerInterval: phase.state.startDate...phase.state.endDate, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                .tint(campusBlue)
        }
    }
}

enum CourseSurface { case island, lockScreen }

/// "扫码签到" and "结束提醒". In the island the outer bottom corners are concentric with the island corners
/// (radius 44 - margin, same centre), so the buttons run parallel to the outline instead of cutting into it.
struct CourseActions: View {
    let chain: String
    let surface: CourseSurface
    var body: some View {
        HStack(spacing: 10) {
            Link(destination: courseScanURL) {
                Label("扫码签到", systemImage: "qrcode.viewfinder").courseButton(shape(outer: .leading))
            }
            Button(intent: EndCourseReminderIntent(chain: chain)) {
                Label("结束提醒", systemImage: "xmark").courseButton(shape(outer: .trailing))
            }
            .buttonStyle(.plain)
        }
        .accessibilityElement(children: .contain)
    }
    static let height: CGFloat = 32
    private func shape(outer: HorizontalEdge) -> UnevenRoundedRectangle {
        switch surface {
        case .lockScreen:
            return UnevenRoundedRectangle(cornerRadii: .init(topLeading: 10, bottomLeading: 10, bottomTrailing: 10, topTrailing: 10))
        case .island:
            let big = IslandGeometry.concentricRadius, top = Self.height - big, inner: CGFloat = 10
            return outer == .leading
                ? UnevenRoundedRectangle(cornerRadii: .init(topLeading: top, bottomLeading: big, bottomTrailing: inner, topTrailing: inner))
                : UnevenRoundedRectangle(cornerRadii: .init(topLeading: inner, bottomLeading: inner, bottomTrailing: big, topTrailing: top))
        }
    }
}

private extension View {
    func courseButton(_ shape: UnevenRoundedRectangle) -> some View {
        font(.caption.weight(.medium)).lineLimit(1)
            .frame(maxWidth: .infinity, minHeight: CourseActions.height, maxHeight: CourseActions.height)
            .background(shape.fill(Color.white.opacity(0.14)))
    }
}

/// Icon + course code, shortened to the prefix when space runs out.
struct CourseStatus: View {
    let phase: CoursePhase
    var withLabel = false
    var body: some View {
        ViewThatFits(in: .horizontal) {
            if withLabel {
                Label("\(phase.label)\(phase.state.code.isEmpty ? "" : " · \(phase.state.code)")", systemImage: phase.icon)
                    .fixedSize(horizontal: true, vertical: false)
            }
            Label(phase.state.code.isEmpty ? phase.label : phase.state.code, systemImage: phase.icon)
                .fixedSize(horizontal: true, vertical: false)
            Label(phase.codePrefix.isEmpty ? phase.label : phase.codePrefix, systemImage: phase.icon)
                .fixedSize(horizontal: true, vertical: false)
            Image(systemName: phase.icon)
        }
        .font(.caption.weight(.semibold)).foregroundStyle(campusBlue).lineLimit(1)
        .accessibilityLabel("\(phase.label) · \(phase.state.code)")
    }
}

/// Title / room on the left, remaining time on the right (independent columns).
struct CourseDetails: View {
    let phase: CoursePhase
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(phase.state.title).font(.headline).lineLimit(1).truncationMode(.tail)
                Label(phase.state.room.isEmpty ? "地点待确认" : phase.state.room, systemImage: "mappin.and.ellipse")
                    .font(.subheadline).lineLimit(1).truncationMode(.tail)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            CourseRemaining(phase: phase)
                .frame(width: 96, alignment: .trailing).layoutPriority(1)
        }
    }
}

/// Expanded island bottom region: details, progress, buttons.
struct CourseIslandBody: View {
    let phase: CoursePhase
    let chain: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            CourseDetails(phase: phase)
            CourseProgress(phase: phase)
            CourseActions(chain: chain, surface: .island)
        }
        // The island is capped at 160 pt: keep the default text size as the largest here.
        .dynamicTypeSize(...DynamicTypeSize.large)
    }
}

/// Lock Screen / banner card: same content, standard 14 pt margin, within 160 pt.
struct CourseCard: View {
    let phase: CoursePhase
    let chain: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                CourseStatus(phase: phase, withLabel: true)
                Spacer(minLength: 0)
                Text(phase.left).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            CourseDetails(phase: phase)
            CourseProgress(phase: phase)
            CourseActions(chain: chain, surface: .lockScreen)
        }
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .padding(14)
    }
}

// MARK: compact and minimal

/// Compact leading: course code; prefix (MTH) or icon when it does not fit. No progress ring here.
struct CompactLeading: View {
    let phase: CoursePhase
    var limited = false
    var body: some View {
        ViewThatFits(in: .horizontal) {
            if !limited && !phase.state.code.isEmpty { Text(phase.state.code).fixedSize() }
            if !phase.codePrefix.isEmpty { Text(phase.codePrefix).fixedSize() }
            Image(systemName: phase.icon)
        }
        .font(.caption.weight(.semibold)).foregroundStyle(campusBlue)
        .dynamicTypeSize(...DynamicTypeSize.large)
        .accessibilityLabel("\(phase.label) · \(phase.state.code)")
    }
}

/// Compact trailing: room before class, remaining minutes in class, "已下课" after. Static texts take their natural
/// width; the live minutes get a fixed 46 pt column ("120分钟" fits), otherwise its width reservation stretches the island.
struct CompactTrailing: View {
    let phase: CoursePhase
    var limited = false
    static let minutesWidth: CGFloat = 46
    var body: some View {
        Group {
            // iOS 27 shows activities of several apps as width-limited compact islands: no text here (it would
            // overlap the leading prefix), only a state mark: bell before class, a small system-driven ring in
            // class, a check mark after.
            if limited {
                if phase.during {
                    ProgressView(timerInterval: phase.state.startDate...phase.state.endDate, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                        .progressViewStyle(.circular).tint(campusBlue).frame(width: 14, height: 14)
                } else {
                    Image(systemName: phase.after ? "checkmark" : "bell.fill")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(campusBlue)
                        .frame(width: 14, height: 14)
                }
            }
            else if phase.after { Text("已下课").fixedSize() }
            else if phase.during {
                CourseMinutes(target: phase.state.endDate)
                    .lineLimit(1).minimumScaleFactor(0.8)
                    .frame(width: Self.minutesWidth, alignment: .trailing)
            } else {
                ViewThatFits(in: .horizontal) {
                    Text(phase.state.room.isEmpty ? courseClock(phase.state.startDate) : phase.state.room).fixedSize()
                    Text(courseClock(phase.state.startDate)).fixedSize()
                }
            }
        }
        .font(.caption.weight(.semibold))
        .dynamicTypeSize(...DynamicTypeSize.large)
    }
}

/// Minimal: bell before class, system-driven progress ring in class, check mark after.
struct CourseMinimal: View {
    let phase: CoursePhase
    var body: some View {
        if phase.during {
            ProgressView(timerInterval: phase.state.startDate...phase.state.endDate, countsDown: false) { EmptyView() } currentValueLabel: {
                Image(systemName: "book.fill").font(.system(size: 9))
            }
            .progressViewStyle(.circular).tint(campusBlue)
        } else {
            Image(systemName: phase.icon).foregroundStyle(campusBlue)
        }
    }
}
