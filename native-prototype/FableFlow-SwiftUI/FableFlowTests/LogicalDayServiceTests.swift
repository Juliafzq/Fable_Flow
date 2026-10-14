import XCTest
@testable import FableFlow

final class LogicalDayServiceTests: XCTestCase {
    private var calendar: Calendar!

    override func setUp() {
        super.setUp()
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/New_York")!
        self.calendar = cal
    }

    func testFourFiftyNineAMRemainsOnPreviousLogicalDay() {
        // Tuesday Oct 6, 2026 at 04:59:59 AM belongs to Monday Oct 5 ("2026-10-05")
        let comps = DateComponents(year: 2026, month: 10, day: 6, hour: 4, minute: 59, second: 59)
        let date = calendar.date(from: comps)!
        let key = LogicalDayService.computeLogicalDayKey(for: date, calendar: calendar)
        XCTAssertEqual(key, "2026-10-05")
    }

    func testFiveAMTransitionsToNewLogicalDay() {
        // Tuesday Oct 6, 2026 at 05:00:00 AM transitions to Tuesday Oct 6 ("2026-10-06")
        let comps = DateComponents(year: 2026, month: 10, day: 6, hour: 5, minute: 0, second: 0)
        let date = calendar.date(from: comps)!
        let key = LogicalDayService.computeLogicalDayKey(for: date, calendar: calendar)
        XCTAssertEqual(key, "2026-10-06")
    }

    func testDateStampFormatsMatchMockups() {
        let comps = DateComponents(year: 2026, month: 10, day: 6, hour: 9, minute: 30, second: 0)
        let date = calendar.date(from: comps)!
        let service = LogicalDayService(calendar: calendar, referenceDate: date)

        XCTAssertEqual(service.miniCardDateStamp(for: date), "06 OCT")
        XCTAssertEqual(service.fullCardDateStamp(for: date), "TUESDAY — OCT 06")
    }
}
