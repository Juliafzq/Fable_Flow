import XCTest

final class DailyRitualEndToEndUITests: XCTestCase {
    func testPhaseOneCoreTactileLoopJourney() {
        let app = XCUIApplication()
        app.launch()

        // 1. Verify Global Top Bar pill ("Card" | "Timer") & Profile button
        XCTAssertTrue(app.buttons["Card"].exists)
        XCTAssertTrue(app.buttons["Timer"].exists)
        XCTAssertTrue(app.buttons["Account and Settings"].exists)

        // 2. Verify Today's Card 3-Icon Bottom Bar (Stack, Flip, Add)
        XCTAssertTrue(app.buttons["Open Card Stack Archive"].exists)
        XCTAssertTrue(app.buttons["Flip Card 180 degrees"].exists)
        XCTAssertTrue(app.buttons["Add task to Today's Card"].exists)
    }
}
