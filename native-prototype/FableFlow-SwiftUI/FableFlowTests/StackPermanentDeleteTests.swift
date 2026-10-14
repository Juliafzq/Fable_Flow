import XCTest
import SwiftData
@testable import FableFlow

final class StackPermanentDeleteTests: XCTestCase {
    func testPermanentDeleteRemovesCardAndDisplaysConfirmationToast() {
        let persistence = PersistenceContainer(inMemory: true)
        let dayService = LogicalDayService()
        let sensory = SensoryEngine()
        let toastCenter = ToastNotificationCenter()
        let repository = DailyCardRepository(
            modelContext: persistence.mainContext,
            logicalDayService: dayService,
            sensoryEngine: sensory,
            toastCenter: toastCenter
        )

        let card = repository.loadOrCreateTodaysCard()
        _ = repository.addTask(title: "Finalize Project Proposal", to: card)

        repository.permanentlyDeleteCard(card)

        XCTAssertEqual(sensory.lastTriggeredCue, "card_permanent_delete")
        XCTAssertNotNil(toastCenter.activeToast)
        XCTAssertTrue(toastCenter.activeToast?.message.contains("permanently deleted") == true)
    }
}
