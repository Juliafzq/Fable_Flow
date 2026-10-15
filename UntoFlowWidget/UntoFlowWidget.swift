import WidgetKit
import SwiftUI

/// Home Screen, Mac desktop and Lock Screen widgets for UNTO / FLOW.
///
/// - Small: a tomato you can set (− / +), start, pause and stop, with a live countdown.
/// - Medium: the same tomato with big countdown digits, plus today's to-do list from the front of the
///   card. Tap a task to cross it out (the app picks the change up next time it's open).
/// - Lock Screen: live countdown while a tomato runs.
///
/// The timer runs inside the widget itself. Today's tasks come from the app through
/// `WidgetSharedStore` (a shared Keychain item, since a free Apple ID can't sign App Groups).

private let studioBackground = Color(red: 231.0 / 255.0, green: 232.0 / 255.0, blue: 226.0 / 255.0)
private let ink = Color(red: 15.0 / 255.0, green: 15.0 / 255.0, blue: 15.0 / 255.0)
private let openTimerURL = URL(string: "untoflow://timer")!
private let maxMediumTasks = 5

// MARK: - Timeline

struct FlowEntry: TimelineEntry {
    let date: Date
    let timer: WidgetTimerState
    let card: WidgetCardSnapshot

    var phase: WidgetTimerState.Phase { timer.phase(at: date) }
}

struct FlowProvider: TimelineProvider {
    func placeholder(in context: Context) -> FlowEntry {
        FlowEntry(
            date: Date(),
            timer: WidgetTimerState(),
            card: WidgetCardSnapshot(tasks: [
                WidgetCardTask(id: "1", title: "Math study", isCompleted: true),
                WidgetCardTask(id: "2", title: "Build deck", isCompleted: false),
                WidgetCardTask(id: "3", title: "Pick up package", isCompleted: false),
            ])
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (FlowEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : currentEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FlowEntry>) -> Void) {
        let now = Date()
        let entry = currentEntry(at: now)
        var entries = [entry]
        // When a running tomato reaches 00:00, flip the widget back to its set length.
        if case .running(let endDate) = entry.phase {
            entries.append(FlowEntry(date: endDate, timer: entry.timer, card: entry.card))
        }
        // Refresh just after midnight so the date stays current.
        let calendar = Calendar.current
        let nextMidnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))
            ?? now.addingTimeInterval(24 * 60 * 60)
        completion(Timeline(entries: entries, policy: .after(nextMidnight)))
    }

    private func currentEntry(at date: Date) -> FlowEntry {
        FlowEntry(
            date: date,
            timer: WidgetTimerStore.load(),
            card: WidgetSharedStore.loadCard() ?? WidgetCardSnapshot()
        )
    }
}

// MARK: - Shared pieces

private func clockText(seconds: TimeInterval) -> String {
    let total = max(0, Int(seconds.rounded(.up)))
    let hours = total / 3600
    let minutes = (total % 3600) / 60
    let secs = total % 60
    if hours > 0 {
        return String(format: "%d:%02d:%02d", hours, minutes, secs)
    }
    return String(format: "%02d:%02d", minutes, secs)
}

/// Live countdown while running; the paused or set time otherwise.
private struct CountdownText: View {
    let entry: FlowEntry

    var body: some View {
        switch entry.phase {
        case .running(let endDate):
            Text(timerInterval: entry.date...endDate, countsDown: true)
        case .paused(let remaining):
            Text(clockText(seconds: remaining))
        case .idle:
            Text(clockText(seconds: TimeInterval(entry.timer.minutes * 60)))
        }
    }
}

/// The tomato itself is the start / pause button.
private struct TomatoButton: View {
    let entry: FlowEntry
    let size: CGFloat

    private var badgeSymbol: String {
        if case .running = entry.phase { return "pause.fill" }
        return "play.fill"
    }

    var body: some View {
        Button(intent: StartPauseTimerIntent()) {
            Image("Tomato")
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
                .overlay(alignment: .bottomTrailing) {
                    Image(systemName: badgeSymbol)
                        .font(.system(size: size * 0.16, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: size * 0.34, height: size * 0.34)
                        .background(Circle().fill(ink))
                }
        }
        .buttonStyle(.plain)
    }
}

private struct RoundControl: View {
    let symbol: String

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(ink)
            .frame(width: 28, height: 28)
            .background(Circle().fill(ink.opacity(0.08)))
    }
}

/// − / + while idle; ■ stop while running or paused.
private struct TimerControls: View {
    let entry: FlowEntry

    var body: some View {
        if entry.phase == .idle {
            HStack(spacing: 8) {
                Button(intent: AdjustTimerIntent(deltaMinutes: -WidgetTimerState.minuteStep)) {
                    RoundControl(symbol: "minus")
                }
                .buttonStyle(.plain)
                Button(intent: AdjustTimerIntent(deltaMinutes: WidgetTimerState.minuteStep)) {
                    RoundControl(symbol: "plus")
                }
                .buttonStyle(.plain)
            }
        } else {
            Button(intent: StopTimerIntent()) {
                RoundControl(symbol: "stop.fill")
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Small

private struct SmallTimerView: View {
    let entry: FlowEntry

    var body: some View {
        VStack(spacing: 6) {
            CountdownText(entry: entry)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(ink)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            TomatoButton(entry: entry, size: 62)
            TimerControls(entry: entry)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Medium

private struct TaskListView: View {
    let entry: FlowEntry

    private var dateText: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE · MMM d"
        return formatter.string(from: entry.date).uppercased()
    }

    var body: some View {
        let tasks = entry.card.tasks
        VStack(alignment: .leading, spacing: 4) {
            Text(dateText)
                .font(.system(size: 10, weight: .semibold, design: .serif))
                .foregroundStyle(ink.opacity(0.55))
            if tasks.isEmpty {
                Text("Open the app to load today's card.")
                    .font(.system(size: 12, design: .serif))
                    .foregroundStyle(ink.opacity(0.55))
            } else {
                ForEach(Array(tasks.prefix(maxMediumTasks).enumerated()), id: \.element.id) { index, task in
                    Button(intent: ToggleCardTaskIntent(taskID: task.id)) {
                        HStack(spacing: 6) {
                            Text(String(format: "%02d", index + 1))
                                .font(.system(size: 10, weight: .medium, design: .monospaced))
                                .foregroundStyle(ink.opacity(0.4))
                            Text(task.title)
                                .font(.system(size: 13, design: .serif))
                                .strikethrough(task.isCompleted, color: ink.opacity(0.7))
                                .foregroundStyle(task.isCompleted ? ink.opacity(0.4) : ink)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                if tasks.count > maxMediumTasks {
                    Text("+\(tasks.count - maxMediumTasks) more")
                        .font(.system(size: 10, design: .serif))
                        .foregroundStyle(ink.opacity(0.45))
                }
            }
            Spacer(minLength: 0)
        }
    }
}

private struct MediumView: View {
    let entry: FlowEntry

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                CountdownText(entry: entry)
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(ink)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                HStack(spacing: 10) {
                    TomatoButton(entry: entry, size: 56)
                    TimerControls(entry: entry)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Rectangle()
                .fill(ink.opacity(0.12))
                .frame(width: 1)

            TaskListView(entry: entry)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Lock Screen

private struct CircularView: View {
    let entry: FlowEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            if case .running = entry.phase {
                CountdownText(entry: entry)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.6)
            } else {
                Image(systemName: "timer")
                    .font(.system(size: 22, weight: .medium))
            }
        }
    }
}

private struct RectangularView: View {
    let entry: FlowEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            switch entry.phase {
            case .running:
                Text("Focusing")
                    .font(.system(size: 13, design: .serif))
                CountdownText(entry: entry)
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .monospacedDigit()
            case .paused:
                Text("Paused")
                    .font(.system(size: 13, design: .serif))
                CountdownText(entry: entry)
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .monospacedDigit()
            case .idle:
                Text("Start a tomato")
                    .font(.system(size: 15, weight: .semibold, design: .serif))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Widget

struct UntoFlowWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FlowEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            CircularView(entry: entry)
        case .accessoryRectangular:
            RectangularView(entry: entry)
        case .systemMedium:
            MediumView(entry: entry)
        default:
            SmallTimerView(entry: entry)
        }
    }
}

struct UntoFlowWidget: Widget {
    let kind = "UntoFlowWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FlowProvider()) { entry in
            UntoFlowWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    studioBackground
                }
                .widgetURL(openTimerURL)
        }
        .configurationDisplayName("UNTO / FLOW")
        .description("Set and start a tomato, and cross off today's tasks.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

@main
struct UntoFlowWidgetBundle: WidgetBundle {
    var body: some Widget {
        UntoFlowWidget()
    }
}
