import Foundation
import Observation

/// Enforces the 5:00 AM Local Time Daily Boundary (PRD §4.1 & §6.#3.A).
/// Never uses `Calendar.isDateInToday`; instead shifts wall-clock time back by 5 hours
/// so night-owl sessions up to 04:59:59 AM remain on the active card, and at 05:00:00 AM
/// the workspace transitions cleanly to a fresh card with zero unfinished task rollover.
@Observable
public final class LogicalDayService: LogicalDayServiceProtocol {
    public static let rolloverHour: Int = 5

    public private(set) var currentLogicalDayKey: String
    private let calendar: Calendar
    private var rolloverTimer: Timer?

    public init(calendar: Calendar = .autoupdatingCurrent, referenceDate: Date = .now) {
        self.calendar = calendar
        self.currentLogicalDayKey = Self.computeLogicalDayKey(for: referenceDate, calendar: calendar)
        scheduleNextFiveAMRolloverTimer(from: referenceDate)
    }

    deinit {
        rolloverTimer?.invalidate()
    }

    public static func computeLogicalDate(for date: Date, calendar: Calendar = .autoupdatingCurrent) -> Date {
        let shifted = calendar.date(byAdding: .hour, value: -rolloverHour, to: date) ?? date
        return calendar.startOfDay(for: shifted)
    }

    public static func computeLogicalDayKey(for date: Date, calendar: Calendar = .autoupdatingCurrent) -> String {
        let logicalDate = computeLogicalDate(for: date, calendar: calendar)
        let components = calendar.dateComponents([.year, .month, .day], from: logicalDate)
        let year = components.year ?? 2026
        let month = components.month ?? 10
        let day = components.day ?? 6
        return String(format: "%04d-%02d-%02d", year, month, day)
    }

    /// Formats the compact Homepage mini-card stamp (e.g. `"06 OCT"`, Mockup p. 11 Top).
    public func miniCardDateStamp(for date: Date = .now) -> String {
        let logicalDate = Self.computeLogicalDate(for: date, calendar: calendar)
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "dd MMM"
        return formatter.string(from: logicalDate).uppercased()
    }

    /// Formats the full Card header stamp (e.g. `"TUESDAY — OCT 06"`, Mockup p. 13 & p. 14).
    public func fullCardDateStamp(for date: Date = .now) -> String {
        let logicalDate = Self.computeLogicalDate(for: date, calendar: calendar)
        let weekdayFormatter = DateFormatter()
        weekdayFormatter.calendar = calendar
        weekdayFormatter.locale = Locale(identifier: "en_US_POSIX")
        weekdayFormatter.dateFormat = "EEEE"

        let monthDayFormatter = DateFormatter()
        monthDayFormatter.calendar = calendar
        monthDayFormatter.locale = Locale(identifier: "en_US_POSIX")
        monthDayFormatter.dateFormat = "MMM dd"

        let weekday = weekdayFormatter.string(from: logicalDate).uppercased()
        let monthDay = monthDayFormatter.string(from: logicalDate).uppercased()
        return "\(weekday) — \(monthDay)"
    }

    @discardableResult
    public func refreshLogicalDayIfNeeded(at referenceDate: Date = .now) -> Bool {
        let updatedKey = Self.computeLogicalDayKey(for: referenceDate, calendar: calendar)
        guard updatedKey != currentLogicalDayKey else { return false }
        currentLogicalDayKey = updatedKey
        scheduleNextFiveAMRolloverTimer(from: referenceDate)
        return true
    }

    private func scheduleNextFiveAMRolloverTimer(from date: Date) {
        rolloverTimer?.invalidate()
        var nextComponents = calendar.dateComponents([.year, .month, .day], from: date)
        nextComponents.hour = Self.rolloverHour
        nextComponents.minute = 0
        nextComponents.second = 0

        guard var candidate = calendar.date(from: nextComponents) else { return }
        if candidate <= date {
            candidate = calendar.date(byAdding: .day, value: 1, to: candidate) ?? candidate
        }
        let interval = max(1.0, candidate.timeIntervalSince(date))
        rolloverTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
            self?.refreshLogicalDayIfNeeded(at: .now)
        }
    }
}
