import Foundation
import CoreGraphics
import SwiftData
import Observation

/// Manages CRUD operations for `DailyCard` and `CardTask` keyed by `LogicalDayService` (5:00 AM daily boundary).
/// Enforces:
/// 1. Strict 6-task maximum per card (`slotIndex: 1...6`), flat list only (zero subtasks).
/// 2. Zero automatic task rollover: when a new logical day begins at 5:00 AM, Today's Card starts fresh;
///    yesterday's uncrossed tasks remain untouched on yesterday's card in the Stack.
/// 3. Permanent Trash Can (`🗑`) deletion with confirmation and pop-up toast notification.
@Observable
public final class DailyCardRepository {
    public private(set) var todaysCard: DailyCard?
    public private(set) var archivedCards: [DailyCard] = []

    private let modelContext: ModelContext
    private let logicalDayService: LogicalDayServiceProtocol
    private let sensoryEngine: SensoryServiceProtocol
    private let toastCenter: ToastNotificationCenter

    public init(
        modelContext: ModelContext,
        logicalDayService: LogicalDayServiceProtocol,
        sensoryEngine: SensoryServiceProtocol,
        toastCenter: ToastNotificationCenter
    ) {
        self.modelContext = modelContext
        self.logicalDayService = logicalDayService
        self.sensoryEngine = sensoryEngine
        self.toastCenter = toastCenter
        loadOrCreateTodaysCard()
    }

    /// Loads or creates Today's Card for the current 5:00 AM Logical Day without copying unfinished tasks from yesterday.
    @discardableResult
    public func loadOrCreateTodaysCard(at referenceDate: Date = .now) -> DailyCard {
        logicalDayService.refreshLogicalDayIfNeeded(at: referenceDate)
        let currentKey = logicalDayService.currentLogicalDayKey

        let allDescriptor = FetchDescriptor<DailyCard>(
            sortBy: [SortDescriptor(\DailyCard.logicalDateString, order: .reverse)]
        )
        let allCards = (try? modelContext.fetch(allDescriptor)) ?? []

        if let existingToday = allCards.first(where: { $0.logicalDateString == currentKey }) {
            self.todaysCard = existingToday
            self.archivedCards = allCards.filter { $0.logicalDateString != currentKey }
            return existingToday
        }

        // Create a fresh white index card stamped with today's date (zero unfinished task rollover).
        let freshCard = DailyCard(
            logicalDateString: currentKey,
            headerDisplayStamp: logicalDayService.fullCardDateStamp(for: referenceDate),
            miniDisplayStamp: logicalDayService.miniCardDateStamp(for: referenceDate),
            createdAt: referenceDate
        )
        modelContext.insert(freshCard)
        if allCards.isEmpty {
            let exampleTask = CardTask(slotIndex: 1, title: "Example Task")
            exampleTask.card = freshCard
            freshCard.tasks = [exampleTask]
            modelContext.insert(exampleTask)
        }
        try? modelContext.save()

        self.todaysCard = freshCard
        self.archivedCards = allCards
        return freshCard
    }

    /// Adds a new task to the specified card up to the strict cap of 6 main tasks (`01` through `06`).
    @discardableResult
    public func addTask(title: String, to card: DailyCard) -> CardTask? {
        let currentTasks = card.sortedTasks
        guard currentTasks.count < DailyCard.maxTasksPerCard else { return nil }
        let nextSlotIndex = currentTasks.count + 1
        let task = CardTask(slotIndex: nextSlotIndex, title: title)
        task.card = card
        if card.tasks == nil {
            card.tasks = [task]
        } else {
            card.tasks?.append(task)
        }
        card.updatedAt = .now
        modelContext.insert(task)
        try? modelContext.save()
        return task
    }

    public func updateTaskTitle(_ title: String, for task: CardTask) {
        task.title = title
        task.card?.updatedAt = .now
        try? modelContext.save()
    }

    /// Toggles task strikethrough state when the user performs a valid Left -> Right (`Δx > +15 px`) pencil drag.
    public func applyLeftToRightPencilGesture(on task: CardTask, strokePoints: [CGPoint]) {
        if task.isCompleted {
            // Second Left -> Right drag erases the strikethrough cleanly.
            task.isCompleted = false
            task.strikethroughPoints = []
        } else {
            // First Left -> Right drag crosses out the task with textured graphite path.
            task.isCompleted = true
            task.strikethroughPoints = strokePoints
        }
        task.card?.updatedAt = .now
        try? modelContext.save()
    }

    /// Permanently deletes an archived card after user confirmation via the Trash Can (`🗑`) and pops up a notification banner.
    public func permanentlyDeleteCard(_ card: DailyCard) {
        let deletedStamp = card.headerDisplayStamp
        sensoryEngine.playCardPermanentDelete()
        modelContext.delete(card)
        try? modelContext.save()
        loadOrCreateTodaysCard()
        toastCenter.show("Card (\(deletedStamp)) permanently deleted")
    }
}
