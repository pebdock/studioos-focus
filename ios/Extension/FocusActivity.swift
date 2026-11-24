import ActivityKit
import SwiftUI
import WidgetKit

struct Countdown: View {
    let state: FocusAttributes.ContentState
    var body: some View {
        if let end = state.deadline {
            Text(timerInterval: min(Date.now, end)...end, countsDown: true).monospacedDigit()
        } else {
            Text(Duration.seconds(state.seconds).formatted(.time(pattern: .minuteSecond))).monospacedDigit()
        }
    }
}

@main
struct FocusActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusAttributes.self) { context in
            VStack(alignment: .leading) {
                Label(context.state.deadline == nil ? "In pausa" : "Studio", systemImage: "timer")
                Text(context.attributes.title).font(.headline)
                Countdown(state: context.state).font(.title)
            }.padding()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "timer") }
                DynamicIslandExpandedRegion(.trailing) { Countdown(state: context.state) }
                DynamicIslandExpandedRegion(.bottom) { Text(context.attributes.title) }
            } compactLeading: {
                Image(systemName: context.state.deadline == nil ? "pause.fill" : "timer")
            } compactTrailing: {
                Countdown(state: context.state).frame(maxWidth: 56)
            } minimal: { Image(systemName: "timer") }
        }
    }
}
