import XCTest
import CoreGraphics
@testable import FableFlow

final class OdometerDialPhysicsTests: XCTestCase {
    func testRightToLeftDragWindsUpInFiveMinuteNotchesUpTo180Minutes() {
        // 1 notch = -24pt horizontal drag -> +30° -> 5 minutes
        let oneNotch = OdometerDialPhysics.applyHorizontalDrag(initialAngleDegrees: 0, translationX: -24)
        XCTAssertEqual(oneNotch.snappedAngleDegrees, 30.0)
        XCTAssertEqual(oneNotch.durationMinutes, 5)
        XCTAssertEqual(oneNotch.activeTurnIndex, 0)
        XCTAssertTrue(oneNotch.isWindingUp)

        // 1 full turn (12 notches = -288pt) -> 360° -> 60 minutes
        let oneFullTurn = OdometerDialPhysics.applyHorizontalDrag(initialAngleDegrees: 0, translationX: -288)
        XCTAssertEqual(oneFullTurn.snappedAngleDegrees, 360.0)
        XCTAssertEqual(oneFullTurn.durationMinutes, 60)

        // 3 full turns (36 notches) -> clamped at 1080° / 180 minutes even if dragged further
        let overDrag = OdometerDialPhysics.applyHorizontalDrag(initialAngleDegrees: 720.0, translationX: -500)
        XCTAssertEqual(overDrag.snappedAngleDegrees, 1080.0)
        XCTAssertEqual(overDrag.durationMinutes, 180)
        XCTAssertEqual(overDrag.activeTurnIndex, 2)
    }

    func testLeftToRightDragUnwindsCountdownInFiveMinuteNotches() {
        // Start at 150 minutes (900° on Turn 3), drag Left -> Right by 2 notches (+48pt) -> 140 minutes (840°)
        let unwound = OdometerDialPhysics.applyHorizontalDrag(initialAngleDegrees: 900.0, translationX: 48)
        XCTAssertEqual(unwound.snappedAngleDegrees, 840.0)
        XCTAssertEqual(unwound.durationMinutes, 140)
        XCTAssertFalse(unwound.isWindingUp)
        XCTAssertEqual(unwound.notchesCrossed, 2)
    }

    func testTurnThreeEquatorialLabelsMatchHeroMockup() {
        // At 150 minutes (900°), visible labels must be [130, 140, 150, 160, 170] matching Mockup p. 11
        let labels = OdometerDialPhysics.visibleEquatorialLabels(forCumulativeAngleDegrees: 900.0)
        XCTAssertEqual(labels, [130, 140, 150, 160, 170])
    }

    func testStopwatchRotatesForwardOneMinuteNotchPerMinute() {
        // 10 minutes elapsed = +60° forward rotation
        let angle = OdometerDialPhysics.forwardAngleDegrees(forStopwatchElapsedSeconds: 600)
        XCTAssertEqual(angle, 60.0)
    }
}
