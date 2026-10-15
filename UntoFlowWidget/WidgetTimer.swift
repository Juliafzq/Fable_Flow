import Foundation
import UserNotifications

/// The widget's own tomato timer. It lives entirely inside the widget, so it works on a free Apple ID.
struct WidgetTimerState: Codable, Equatable {
    static let minuteStep = 5
    static let minMinutes = 5
    static let maxMinutes = 180
    static let defaultMinutes = 25

    /// The length the user dialled in with − / +.
    var minutes: Int = WidgetTimerState.defaultMinutes
    /// Set while the countdown is running.
    var endDate: Date?
    /// Set while the countdown is paused.
    var pausedRemaining: TimeInterval?

    enum Phase: Equatable {
        case idle
        case running(endDate: Date)
        case paused(remaining: TimeInterval)
    }

    func phase(at now: Date = Date()) -> Phase {
        if let endDate = endDate, endDate > now {
            return .running(endDate: endDate)
        }
        if let remaining = pausedRemaining, remaining > 0 {
            return .paused(remaining: remaining)
        }
        return .idle
    }
}

enum WidgetTimerStore {
    private static let key = "untoflow.widgetTimer.v1"
    private static let notificationID = "com.untoflow.widget.timer"

    static func load() -> WidgetTimerState {
        guard let data = UserDefaults.standard.data(forKey: key),
              var state = try? JSONDecoder().decode(WidgetTimerState.self, from: data) else {
            return WidgetTimerState()
        }
        // A countdown that already reached 00:00 goes back to the dialled-in length.
        if let endDate = state.endDate, endDate <= Date() {
            state.endDate = nil
        }
        return state
    }

    private static func save(_ state: WidgetTimerState) {
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    /// − / + buttons. Only changes the length while the timer isn't running or paused.
    static func adjust(byMinutes delta: Int) {
        var state = load()
        guard state.phase() == .idle else { return }
        state.minutes = min(
            WidgetTimerState.maxMinutes,
            max(WidgetTimerState.minMinutes, state.minutes + delta)
        )
        save(state)
    }

    /// Tomato button: start, pause, or resume.
    static func startOrPause() {
        var state = load()
        let now = Date()
        switch state.phase(at: now) {
        case .idle:
            let end = now.addingTimeInterval(TimeInterval(state.minutes * 60))
            state.endDate = end
            state.pausedRemaining = nil
            scheduleBell(at: end)
        case .running(let endDate):
            state.pausedRemaining = endDate.timeIntervalSince(now)
            state.endDate = nil
            cancelBell()
        case .paused(let remaining):
            let end = now.addingTimeInterval(remaining)
            state.endDate = end
            state.pausedRemaining = nil
            scheduleBell(at: end)
        }
        save(state)
    }

    /// Stop button: back to the dialled-in length.
    static func stop() {
        var state = load()
        state.endDate = nil
        state.pausedRemaining = nil
        save(state)
        cancelBell()
    }

    // MARK: 00:00 bell (uses the app's notification permission)

    private static func scheduleBell(at date: Date) {
        let content = UNMutableNotificationContent()
        content.title = "Tomato complete"
        content.body = "Your focus session is done."
        content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: "bell_alarm.wav"))
        content.interruptionLevel = .timeSensitive
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(1, date.timeIntervalSinceNow),
            repeats: false
        )
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [notificationID])
        center.add(UNNotificationRequest(identifier: notificationID, content: content, trigger: trigger))
    }

    private static func cancelBell() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [notificationID])
        center.removeDeliveredNotifications(withIdentifiers: [notificationID])
    }
}
