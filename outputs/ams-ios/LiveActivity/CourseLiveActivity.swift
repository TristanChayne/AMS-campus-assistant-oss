import ActivityKit
import SwiftUI
import WidgetKit

// REMIND-LAYOUT-002 Live Activity configuration. Views live in Shared/CourseActivityViews.swift.
@main
struct AMSLiveActivityBundle: WidgetBundle {
    var body: some Widget { CourseLiveActivity() }
}

@available(iOS 27.0, *)
private struct WidthAwareLeading: View {
    @Environment(\.isDynamicIslandLimitedInWidth) private var limited
    let phase: CoursePhase
    var body: some View { CompactLeading(phase: phase, limited: limited) }
}

@available(iOS 27.0, *)
private struct WidthAwareTrailing: View {
    @Environment(\.isDynamicIslandLimitedInWidth) private var limited
    let phase: CoursePhase
    var body: some View { CompactTrailing(phase: phase, limited: limited) }
}

struct CourseLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CourseActivityAttributes.self) { context in
            CourseCard(phase: CoursePhase(state: context.state, stale: context.isStale), chain: context.attributes.chain)
        } dynamicIsland: { context in
            let phase = CoursePhase(state: context.state, stale: context.isStale)
            return DynamicIsland {
                // Short labels beside the camera, pulled in from the top corner curves.
                DynamicIslandExpandedRegion(.leading) {
                    CourseStatus(phase: phase)
                        .padding(.leading, IslandGeometry.cornerLabelInset)
                        .dynamicTypeSize(...DynamicTypeSize.large)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(phase.leftShort).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        .padding(.trailing, IslandGeometry.cornerLabelInset)
                        .dynamicTypeSize(...DynamicTypeSize.large)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    CourseIslandBody(phase: phase, chain: context.attributes.chain)
                }
            } compactLeading: {
                if #available(iOS 27.0, *) { WidthAwareLeading(phase: phase) }
                else { CompactLeading(phase: phase) }
            } compactTrailing: {
                if #available(iOS 27.0, *) { WidthAwareTrailing(phase: phase) }
                else { CompactTrailing(phase: phase) }
            } minimal: {
                CourseMinimal(phase: phase)
            }
            .contentMargins(.all, IslandGeometry.margin, for: .expanded)
            .keylineTint(campusBlue)
        }
    }
}
