import WidgetKit
import SwiftUI

/// Home Screen + Lock Screen widget for UNTO / FLOW.
/// Shows today's date and the tomato; tapping it opens the app straight onto a fresh tomato timer.
/// (It is intentionally static: a live countdown in a widget needs an App Group to share timer state,
/// which a free Apple ID "Personal Team" can't sign. The app's notifications handle the 00:00 alert.)

private let studioBackground = Color(red: 231.0 / 255.0, green: 232.0 / 255.0, blue: 226.0 / 255.0)
private let ink = Color(red: 15.0 / 255.0, green: 15.0 / 255.0, blue: 15.0 / 255.0)
private let openTimerURL = URL(string: "untoflow://timer")!

struct DayEntry: TimelineEntry {
    let date: Date
}

struct DayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry {
        DayEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        completion(DayEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        // Refresh just after midnight so the date on the widget stays current
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())
        let nextRefresh = calendar.date(byAdding: .day, value: 1, to: startOfToday)
            ?? Date().addingTimeInterval(24 * 60 * 60)
        completion(Timeline(entries: [DayEntry(date: Date())], policy: .after(nextRefresh)))
    }
}

struct UntoFlowWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DayEntry

    /// Dates stay in English in the app, e.g. "WED · OCT 14"
    private var dateText: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE · MMM d"
        return formatter.string(from: entry.date).uppercased()
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "timer")
                    .font(.system(size: 22, weight: .medium))
            }
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("UNTO / FLOW")
                    .font(.system(size: 15, weight: .semibold, design: .serif))
                Text("Start a tomato")
                    .font(.system(size: 13, design: .serif))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            VStack(spacing: 4) {
                Text(dateText)
                    .font(.system(size: 12, weight: .semibold, design: .serif))
                    .foregroundStyle(ink.opacity(0.65))
                Image("Tomato")
                    .resizable()
                    .scaledToFit()
                Text("UNTO / FLOW")
                    .font(.system(size: 14, weight: .semibold, design: .serif))
                    .foregroundStyle(ink)
            }
        }
    }
}

struct UntoFlowWidget: Widget {
    let kind = "UntoFlowWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DayProvider()) { entry in
            UntoFlowWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    studioBackground
                }
                .widgetURL(openTimerURL)
        }
        .configurationDisplayName("UNTO / FLOW")
        .description("Open a focus tomato in one tap.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

@main
struct UntoFlowWidgetBundle: WidgetBundle {
    var body: some Widget {
        UntoFlowWidget()
    }
}
