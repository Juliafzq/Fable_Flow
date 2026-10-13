import Foundation
import UserNotifications

/// Schedules and cancels the local completion chime notification so the user hears the chime
/// at `00:00` even when the app is backgrounded or the iPhone is locked (PRD §6.#2.B).
/// Strictly sets `badge = nil` to obey the Zero-Guilt Architecture principle (no red overdue badges).
public final class TimerCompletionNotificationScheduler: TimerCompletionNotificationScheduling {
    public static let notificationIdentifierPrefix = "com.untoflow.timer.completion.quadrant."

    public init() {}

    public func requestPermissionIfNeeded() {
        if #available(iOS 15.0, *) {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .timeSensitive]) { _, _ in }
        } else {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        }
    }

    public func scheduleCompletionChime(forQuadrant quadrant: Int, taskTitle: String, at targetEndDate: Date) {
        let interval = targetEndDate.timeIntervalSinceNow
        guard interval > 0.5 else { return }

        requestPermissionIfNeeded()

        let content = UNMutableNotificationContent()
        content.title = "UNTO FLOW"
        content.body = "\(taskTitle) timer complete."
        content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: "bell_alarm.wav"))
        content.badge = nil
        if #available(iOS 15.0, *) {
            content.interruptionLevel = .timeSensitive
        }

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let identifier = "\(Self.notificationIdentifierPrefix)\(quadrant)"
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
        UNUserNotificationCenter.current().add(request)
    }

    public func cancelCompletionChime(forQuadrant quadrant: Int) {
        let identifier = "\(Self.notificationIdentifierPrefix)\(quadrant)"
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
    }

    public func cancelAllCompletionChimes() {
        let identifiers = (0..<4).map { "\(Self.notificationIdentifierPrefix)\($0)" }
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: identifiers)
    }
}
