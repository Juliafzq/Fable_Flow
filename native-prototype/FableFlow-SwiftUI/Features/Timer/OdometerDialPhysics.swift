import Foundation
import CoreGraphics

/// Pure math and physics engine for the Bidirectional 180-Minute "3-Turn Odometer" Dial (PRD §6.#2.B):
/// - 1 full 360° rotation = 60 minutes (12 clicks of 5 minutes, spaced 30° apart).
/// - Maximum 3 full turns = 1080° = 180 minutes (3 hours).
/// - Dragging Right -> Left (`deltaX < 0`) winds the countdown UP in 5-minute (30°) steps.
/// - Dragging Left -> Right (`deltaX > 0`) unwinds/decrements the countdown DOWN in 5-minute (30°) steps.
/// - In Count-Up Stopwatch Mode, advances angle forward by +6° (1 minute notch) per elapsed minute.
public enum OdometerDialPhysics {
    public static let degreesPerMinuteNotch: Double = 6.0
    public static let degreesPerFiveMinuteNotch: Double = 30.0
    public static let minutesPerNotch: Int = 1
    public static let secondsPerNotch: Int = 60
    public static let degreesPerFullTurn: Double = 360.0
    public static let minutesPerFullTurn: Int = 60
    public static let maxTurns: Int = 3
    public static let maxCumulativeAngleDegrees: Double = 1080.0
    public static let maxDurationMinutes: Int = 180
    public static let maxDurationSeconds: Int = 180 * 60
    public static let horizontalPointsPerNotch: CGFloat = 24.0

    public struct DialUpdateResult: Equatable, Sendable {
        public let snappedAngleDegrees: Double
        public let durationSeconds: Int
        public let durationMinutes: Int
        public let activeTurnIndex: Int // 0 (0-60m), 1 (65-120m), 2 (125-180m)
        public let notchesCrossed: Int
        public let isWindingUp: Bool
    }

    /// Converts a horizontal finger drag delta (`deltaX`: negative = Right-to-Left wind up, positive = Left-to-Right unwind)
    /// into a snapped 30° / 5-minute odometer state.
    public static func applyHorizontalDrag(
        initialAngleDegrees: Double,
        translationX: CGFloat
    ) -> DialUpdateResult {
        // Right -> Left (translationX < 0) increases angle; Left -> Right (translationX > 0) decreases angle.
        let deltaNotches = Double(-translationX / horizontalPointsPerNotch)
        let rawAngle = initialAngleDegrees + (deltaNotches * degreesPerFiveMinuteNotch)
        let clampedAngle = min(max(rawAngle, 0.0), maxCumulativeAngleDegrees)

        let previousNotchIndex = Int(round(min(max(initialAngleDegrees, 0.0), maxCumulativeAngleDegrees) / degreesPerFiveMinuteNotch))
        let newNotchIndex = Int(round(clampedAngle / degreesPerFiveMinuteNotch))
        let snappedAngle = Double(newNotchIndex) * degreesPerFiveMinuteNotch
        let minutes = newNotchIndex * minutesPerNotch
        let seconds = minutes * 60
        let turnIndex = turnIndex(forMinutes: minutes)

        return DialUpdateResult(
            snappedAngleDegrees: snappedAngle,
            durationSeconds: seconds,
            durationMinutes: minutes,
            activeTurnIndex: turnIndex,
            notchesCrossed: abs(newNotchIndex - previousNotchIndex),
            isWindingUp: newNotchIndex > previousNotchIndex
        )
    }

    public static func angleDegrees(forCountdownSeconds seconds: Double) -> Double {
        let clamped = min(max(seconds, 0.0), Double(maxDurationSeconds))
        return (clamped / Double(maxDurationSeconds)) * maxCumulativeAngleDegrees
    }

    /// In Count-Up Stopwatch Mode, advances forward ONLY on whole minutes (+6° per completed minute, not seconds).
    public static func forwardAngleDegrees(forStopwatchElapsedSeconds elapsedSeconds: Double) -> Double {
        let wholeMinutes = floor(max(0.0, elapsedSeconds) / 60.0)
        return (wholeMinutes * 6.0).truncatingRemainder(dividingBy: maxCumulativeAngleDegrees)
    }

    /// Truncates a task title to the first few words so text never overflows on a tomato body.
    public static func formatShortTomatoTitle(_ rawTitle: String, maxWords: Int = 2, maxChars: Int = 13) -> String {
        let words = rawTitle.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard !words.isEmpty else { return "" }
        var candidate = words.prefix(maxWords).joined(separator: " ")
        let hadMoreWords = words.count > maxWords
        if candidate.count > maxChars {
            candidate = String(candidate.prefix(maxChars - 1)).trimmingCharacters(in: .whitespaces) + "…"
        } else if hadMoreWords {
            candidate += "…"
        }
        return candidate.uppercased()
    }

    /// Returns 0 for Turn 1 (0–60 mins), 1 for Turn 2 (65–120 mins), 2 for Turn 3 (125–180 mins).
    public static func turnIndex(forMinutes minutes: Int) -> Int {
        if minutes <= 60 {
            return 0
        } else if minutes <= 120 {
            return 1
        } else {
            return 2
        }
    }

    /// Returns the 5 painted equatorial numbers visible across the front of the 3D tomato sphere
    /// around the center white pointer triangle (`▲`), matching Mockup p. 11 (`[130, 140, 150, 160, 170]` at 150 mins).
    public static func visibleEquatorialLabels(forCumulativeAngleDegrees angleDegrees: Double) -> [Int] {
        let clampedAngle = min(max(angleDegrees, 0.0), maxCumulativeAngleDegrees)
        let centerMinutes = Int(round((clampedAngle / degreesPerFiveMinuteNotch))) * minutesPerNotch
        let roundedTen = Int(round(Double(centerMinutes) / 10.0)) * 10
        let offsets = [-20, -10, 0, 10, 20]
        return offsets.map { offset in
            min(max(roundedTen + offset, 0), maxDurationMinutes)
        }
    }

    /// Parses a user-typed time string (when tapping on the digital readout) into minutes [0..180].
    /// Supports plain minutes ("25", "150") or colon-separated ("02:30" -> 150, "25:00" -> 25).
    public static func parseTypedTimeInput(_ rawInput: String) -> Int? {
        let cleaned = rawInput.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !cleaned.isEmpty else { return nil }

        if cleaned.contains(":") {
            let parts = cleaned.split(separator: ":", omittingEmptySubsequences: false).map {
                $0.trimmingCharacters(in: .whitespaces)
            }
            let nums = parts.compactMap { Double($0) }
            guard nums.count == parts.count else { return nil }
            if nums.count == 2 {
                let a = nums[0], b = nums[1]
                guard a >= 0, b >= 0 else { return nil }
                if a >= 4 && b == 0 {
                    return min(max(Int(round(a)), 0), maxDurationMinutes)
                }
                if a <= 3 && b < 60 {
                    return min(max(Int(round(a * 60.0 + b)), 0), maxDurationMinutes)
                }
                return min(max(Int(round(a + b / 60.0)), 0), maxDurationMinutes)
            } else if nums.count == 3 {
                let h = nums[0], m = nums[1], s = nums[2]
                guard h >= 0, m >= 0, s >= 0 else { return nil }
                return min(max(Int(round(h * 60.0 + m + s / 60.0)), 0), maxDurationMinutes)
            }
            return nil
        }

        guard let numeric = Double(cleaned), numeric >= 0 else { return nil }
        return min(max(Int(round(numeric)), 0), maxDurationMinutes)
    }
}
