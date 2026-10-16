import WidgetKit
import SwiftUI

/// Widgets for UNTO / FLOW.
///
/// - **Tomato** (small; plus Lock Screen sizes on iPhone): a big tomato with the time on it and
///   − / ▶❚❚ / + underneath. Tapping anywhere else opens the app's Timer page on a new hero tomato.
/// - **Today's Card** (wide): today's to-do list, unfinished tasks first, then finished ones in grey.
///   Tap a task to cross it out (the app picks the change up next time it's open). Tapping anywhere
///   else opens the app's Card page.
///
/// The timer runs inside the widget itself. Today's tasks come from the app through
/// `WidgetSharedStore` (a shared Keychain item, since a free Apple ID can't sign App Groups).

private let studioBackground = Color(red: 231.0 / 255.0, green: 232.0 / 255.0, blue: 226.0 / 255.0)
private let ink = Color(red: 15.0 / 255.0, green: 15.0 / 255.0, blue: 15.0 / 255.0)
private let openTimerURL = URL(string: "untoflow://timer")!
private let openCardURL = URL(string: "untoflow://card")!
/// Rows that fit in the wide widget (the last one becomes "+N more" when there are extra tasks).
private let maxCardRows = 5
/// Height ÷ width of the tomato picture (441 × 375, cropped tight with a transparent background).
private let tomatoAspect: CGFloat = 375.0 / 441.0

// MARK: - Timeline

struct FlowEntry: TimelineEntry {
    let date: Date
    let timer: WidgetTimerState
    let card: WidgetCardSnapshot
    /// False until the app has handed today's card to the widget at least once.
    let hasCard: Bool

    var phase: WidgetTimerState.Phase { timer.phase(at: date) }
}

struct FlowProvider: TimelineProvider {
    func placeholder(in context: Context) -> FlowEntry {
        FlowEntry(
            date: Date(),
            timer: WidgetTimerState(),
            card: WidgetCardSnapshot(tasks: [
                WidgetCardTask(id: "1", title: "Build deck", isCompleted: false),
                WidgetCardTask(id: "2", title: "Pick up package", isCompleted: false),
                WidgetCardTask(id: "3", title: "Math study", isCompleted: true),
            ]),
            hasCard: true
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
            entries.append(FlowEntry(date: endDate, timer: entry.timer, card: entry.card, hasCard: entry.hasCard))
        }
        // Refresh just after midnight so the date stays current.
        let calendar = Calendar.current
        let nextMidnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))
            ?? now.addingTimeInterval(24 * 60 * 60)
        completion(Timeline(entries: entries, policy: .after(nextMidnight)))
    }

    private func currentEntry(at date: Date) -> FlowEntry {
        let card = WidgetSharedStore.loadCard()
        return FlowEntry(
            date: date,
            timer: WidgetTimerStore.load(),
            card: card ?? WidgetCardSnapshot(),
            hasCard: card != nil
        )
    }
}

// MARK: - Timer pieces

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

private let buttonFace = Color(red: 246.0 / 255.0, green: 245.0 / 255.0, blue: 240.0 / 255.0)

/// Round button. Light buttons have a soft shadow so they read on top of the tomato.
private struct RoundControl: View {
    let symbol: String
    var size: CGFloat = 28
    var filled = false

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.42, weight: .bold))
            .foregroundStyle(filled ? Color.white : ink)
            .frame(width: size, height: size)
            .background(Circle().fill(filled ? ink : buttonFace))
            .shadow(color: .black.opacity(0.22), radius: 2, y: 1)
    }
}

// MARK: - Small: tomato timer

private struct TomatoTimerView: View {
    let entry: FlowEntry

    private var isRunning: Bool {
        if case .running = entry.phase { return true }
        return false
    }

    private var isPaused: Bool {
        if case .paused = entry.phase { return true }
        return false
    }

    var body: some View {
        GeometryReader { geo in
            // The tomato fills about 80% of the widget's height (and nearly its full width).
            let tomatoWidth = min(geo.size.width * 0.94, geo.size.height * 0.80 / tomatoAspect)
            let tomatoHeight = tomatoWidth * tomatoAspect
            let tomatoTop = max(4, (geo.size.height - tomatoHeight - 16) * 0.35)
            let centerX = geo.size.width / 2

            ZStack {
                Image("Tomato")
                    .resizable()
                    .scaledToFit()
                    .frame(width: tomatoWidth, height: tomatoHeight)
                    .position(x: centerX, y: tomatoTop + tomatoHeight / 2)

                // Time on the smooth upper body, between the stem and the dial ring.
                CountdownText(entry: entry)
                    .font(.system(size: tomatoWidth * 0.2, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.45), radius: 2, y: 1)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .frame(width: tomatoWidth * 0.72)
                    .position(x: centerX, y: tomatoTop + tomatoHeight * 0.38)

                // − / start-pause / +, half on the tomato's bottom edge.
                HStack(spacing: 16) {
                    Button(intent: AdjustTimerIntent(deltaMinutes: -WidgetTimerState.minuteStep)) {
                        RoundControl(symbol: "minus")
                    }
                    .buttonStyle(.plain)
                    Button(intent: StartPauseTimerIntent()) {
                        RoundControl(symbol: isRunning ? "pause.fill" : "play.fill", size: 32, filled: true)
                    }
                    .buttonStyle(.plain)
                    Button(intent: AdjustTimerIntent(deltaMinutes: WidgetTimerState.minuteStep)) {
                        RoundControl(symbol: "plus")
                    }
                    .buttonStyle(.plain)
                }
                .position(x: centerX, y: tomatoTop + tomatoHeight)
            }
            .overlay(alignment: .topTrailing) {
                // Reset only appears while paused.
                if isPaused {
                    Button(intent: StopTimerIntent()) {
                        RoundControl(symbol: "arrow.counterclockwise", size: 24)
                    }
                    .buttonStyle(.plain)
                    .padding(6)
                }
            }
        }
    }
}

// MARK: - Wide: today's card

private enum CardRow: Identifiable {
    case task(WidgetCardTask)
    case message(String)
    case more(Int)

    var id: String {
        switch self {
        case .task(let task): return "task-" + task.id
        case .message(let text): return "message-" + text
        case .more(let count): return "more-\(count)"
        }
    }
}

private struct CardListView: View {
    let entry: FlowEntry

    private var dateText: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE · MMM d"
        return formatter.string(from: entry.date).uppercased()
    }

    /// Unfinished first, then finished; "No uncompleted tasks" when everything is done.
    private var rows: [CardRow] {
        guard entry.hasCard else { return [.message("Open the app to load today's card.")] }
        let tasks = entry.card.tasks
        guard !tasks.isEmpty else { return [.message("No tasks on today's card.")] }
        let open = tasks.filter { !$0.isCompleted }
        let done = tasks.filter { $0.isCompleted }
        var all: [CardRow] = open.isEmpty ? [.message("No uncompleted tasks")] : []
        all += open.map { CardRow.task($0) }
        all += done.map { CardRow.task($0) }
        if all.count > maxCardRows {
            let shown = Array(all.prefix(maxCardRows - 1))
            return shown + [.more(all.count - shown.count)]
        }
        return all
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(dateText)
                .font(.system(size: 11, weight: .semibold, design: .serif))
                .tracking(0.8)
                .foregroundStyle(ink.opacity(0.55))
            Rectangle()
                .fill(ink.opacity(0.15))
                .frame(height: 1)
                .padding(.top, 5)
                .padding(.bottom, 6)
            VStack(alignment: .leading, spacing: 4) {
                ForEach(rows) { row in
                    rowView(row)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private func rowView(_ row: CardRow) -> some View {
        switch row {
        case .task(let task):
            Button(intent: ToggleCardTaskIntent(taskID: task.id)) {
                Text(task.title)
                    .font(.system(size: 14, design: .serif))
                    .strikethrough(task.isCompleted, color: ink.opacity(0.55))
                    .foregroundStyle(task.isCompleted ? ink.opacity(0.38) : ink)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        case .message(let text):
            Text(text)
                .font(.system(size: 14, design: .serif))
                .italic()
                .foregroundStyle(ink.opacity(0.55))
                .lineLimit(1)
        case .more(let count):
            Text("+\(count) more")
                .font(.system(size: 12, design: .serif))
                .foregroundStyle(ink.opacity(0.45))
        }
    }
}

// MARK: - Lock Screen (iPhone only; Macs don't have Lock Screen widgets)

#if !targetEnvironment(macCatalyst) && !os(macOS)
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
#endif

// MARK: - Widgets

struct UntoFlowTimerWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FlowEntry

    var body: some View {
        switch family {
        #if !targetEnvironment(macCatalyst) && !os(macOS)
        case .accessoryCircular:
            CircularView(entry: entry)
        case .accessoryRectangular:
            RectangularView(entry: entry)
        #endif
        default:
            TomatoTimerView(entry: entry)
        }
    }
}

/// Small tomato timer (plus Lock Screen sizes on iPhone).
struct UntoFlowTimerWidget: Widget {
    // Same kind as the original widget, so tomatoes already on a Home Screen keep working.
    let kind = "UntoFlowWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FlowProvider()) { entry in
            UntoFlowTimerWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    studioBackground
                }
                .widgetURL(openTimerURL)
        }
        .configurationDisplayName("Tomato")
        .description("Set and start a focus tomato.")
        .supportedFamilies(Self.families)
        .contentMarginsDisabled()
    }

    private static var families: [WidgetFamily] {
        #if targetEnvironment(macCatalyst) || os(macOS)
        return [.systemSmall]
        #else
        return [.systemSmall, .accessoryCircular, .accessoryRectangular]
        #endif
    }
}

/// Wide to-do list from the front of today's card.
struct UntoFlowCardWidget: Widget {
    let kind = "UntoFlowCardWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FlowProvider()) { entry in
            CardListView(entry: entry)
                .containerBackground(for: .widget) {
                    studioBackground
                }
                .widgetURL(openCardURL)
        }
        .configurationDisplayName("Today's Card")
        .description("Today's to-do list. Tap a task to cross it out.")
        .supportedFamilies([.systemMedium])
    }
}

@main
struct UntoFlowWidgetBundle: WidgetBundle {
    var body: some Widget {
        UntoFlowTimerWidget()
        UntoFlowCardWidget()
    }
}
