import XCTest
import SwiftData
@testable import FableFlow

final class TimerCoordinatorConcurrencyTests: XCTestCase {
    func testStartingSecondTimerAutomaticallyPausesFirstRunningTimer() {
        let persistence = PersistenceContainer(inMemory: true)
        let sensory = SensoryEngine()
        let scheduler = TimerCompletionNotificationScheduler()
        let coordinator = TimerCoordinator(
            modelContext: persistence.mainContext,
            sensoryEngine: sensory,
            notificationScheduler: scheduler
        )

        let task1 = CardTask(slotIndex: 1, title: "Math Study")
        let task2 = CardTask(slotIndex: 2, title: "Build Deck")

        coordinator.assignTask(task1, toQuadrant: 0, initialMinutes: 150)
        coordinator.assignTask(task2, toQuadrant: 1, initialMinutes: 45)

        let start = Date.now
        coordinator.play(quadrant: 0, at: start)
        XCTAssertEqual(coordinator.slot(forQuadrant: 0).runState, .running)

        // 15 minutes later, start Tomato #2 -> Tomato #1 must auto-pause with 135 minutes left
        let fifteenMinsLater = start.addingTimeInterval(15 * 60)
        coordinator.play(quadrant: 1, at: fifteenMinsLater)

        XCTAssertEqual(coordinator.slot(forQuadrant: 0).runState, .paused)
        XCTAssertEqual(coordinator.slot(forQuadrant: 0).currentSeconds(at: fifteenMinsLater), 135 * 60, accuracy: 1.0)
        XCTAssertEqual(coordinator.slot(forQuadrant: 1).runState, .running)
    }

    func testEndingTimerResetsClockWithoutCrossingOutCardTask() {
        let persistence = PersistenceContainer(inMemory: true)
        let coordinator = TimerCoordinator(
            modelContext: persistence.mainContext,
            sensoryEngine: SensoryEngine(),
            notificationScheduler: TimerCompletionNotificationScheduler()
        )

        let task = CardTask(slotIndex: 2, title: "Build Deck", isCompleted: false)
        coordinator.assignTask(task, toQuadrant: 1, initialMinutes: 45)
        coordinator.play(quadrant: 1)
        coordinator.endAndReset(quadrant: 1)

        XCTAssertEqual(coordinator.slot(forQuadrant: 1).currentSeconds(), 0)
        XCTAssertEqual(coordinator.slot(forQuadrant: 1).runState, .idle)
        // Decoupled Task Strikethrough: task must remain uncrossed
        XCTAssertFalse(task.isCompleted)
    }

    func testClearingTitleReturnsTomatoToUnassignedGrayState() {
        let persistence = PersistenceContainer(inMemory: true)
        let coordinator = TimerCoordinator(
            modelContext: persistence.mainContext,
            sensoryEngine: SensoryEngine(),
            notificationScheduler: TimerCompletionNotificationScheduler()
        )

        coordinator.assignCustomTitle("Deep Reading", toQuadrant: 2)
        XCTAssertTrue(coordinator.slot(forQuadrant: 2).isAssigned)

        coordinator.assignCustomTitle("   ", toQuadrant: 2)
        XCTAssertFalse(coordinator.slot(forQuadrant: 2).isAssigned)
        XCTAssertEqual(coordinator.slot(forQuadrant: 2).displayTitleUppercase, "TAP TO ASSIGN")
    }
}
