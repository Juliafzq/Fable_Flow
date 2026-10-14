import XCTest
import CoreGraphics
@testable import FableFlow

final class CardGestureMathTests: XCTestCase {
    private let rowBounds = CGRect(x: 0, y: 0, width: 300, height: 48)

    func testLeftToRightDragInsideRowTriggersPencilStrokeOnly() {
        let start = CGPoint(x: 20, y: 24)
        let current = CGPoint(x: 65, y: 26) // Δx = +45 px, Δy = 2 px

        XCTAssertTrue(CardGestureMath.isLeftToRightPencilStroke(startPoint: start, currentPoint: current, inRowBounds: rowBounds))
        XCTAssertFalse(CardGestureMath.isRightToLeftCardFlip(startPoint: start, currentPoint: current))
        XCTAssertEqual(
            CardGestureMath.classifyGesture(startPoint: start, currentPoint: current, inRowBounds: rowBounds),
            .leftToRightPencilStroke
        )
    }

    func testRightToLeftDragTriggersCardFlipAndNeverPencilStroke() {
        let start = CGPoint(x: 220, y: 24)
        let current = CGPoint(x: 150, y: 28) // Δx = -70 px, Δy = 4 px

        XCTAssertFalse(CardGestureMath.isLeftToRightPencilStroke(startPoint: start, currentPoint: current, inRowBounds: rowBounds))
        XCTAssertTrue(CardGestureMath.isRightToLeftCardFlip(startPoint: start, currentPoint: current))
        XCTAssertEqual(
            CardGestureMath.classifyGesture(startPoint: start, currentPoint: current, inRowBounds: rowBounds),
            .rightToLeftCardFlip
        )
    }

    func testSteepVerticalDragIgnoresBothPencilAndFlip() {
        let start = CGPoint(x: 50, y: 10)
        let current = CGPoint(x: 70, y: 90) // Steep vertical motion

        XCTAssertFalse(CardGestureMath.isLeftToRightPencilStroke(startPoint: start, currentPoint: current, inRowBounds: rowBounds))
        XCTAssertFalse(CardGestureMath.isRightToLeftCardFlip(startPoint: start, currentPoint: current))
    }
}
