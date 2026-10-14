import Foundation
import SwiftData
import Observation

/// Manages the 4 Heirloom Tomato timers (Quadrants 0...3) and enforces:
/// 1. Up to 4 timers can hold an assigned/paused state concurrently, but ONLY 1 timer can actively tick at a time.
/// 2. Starting any timer automatically pauses any other running timer.
/// 3. Ending (`■`) or reaching `00:00` resets that tomato's clock to `00:00` and NEVER crosses out the task on Today's Card.
/// 4. Clearing a tomato's title returns it immediately to its unassigned Matte Neutral Gray state.
@Observable
public final class TimerCoordinator {
    public private(set) var slots: [TomatoTimerSlot] = []
    public var selectedHeroQuadrantIndex: Int? = nil

    private let modelContext: ModelContext
    private let sensoryEngine: SensoryServiceProtocol
    private let notificationScheduler: TimerCompletionNotificationScheduling

    public init(
        modelContext: ModelContext,
        sensoryEngine: SensoryServiceProtocol,
        notificationScheduler: TimerCompletionNotificationScheduling
    ) {
        self.modelContext = modelContext
        self.sensoryEngine = sensoryEngine
        self.notificationScheduler = notificationScheduler
        loadOrCreateFourQuadrantSlots()
    }

    public func slot(forQuadrant quadrant: Int) -> TomatoTimerSlot {
        let clamped = min(max(quadrant, 0), 5)
        return slots[clamped]
    }

    public var activeRunningSlot: TomatoTimerSlot? {
        slots.first { $0.runState == .running }
    }

    /// Assigns a CardTask to a quadrant (turning the tomato into its quadrant's signature Heirloom Red shade).
    public func assignTask(_ task: CardTask, toQuadrant quadrant: Int, initialMinutes: Int = 45) {
        let targetSlot = slot(forQuadrant: quadrant)
        targetSlot.assignedTaskID = task.id
        targetSlot.assignedTaskNumber = task.slotIndex
        targetSlot.customTitle = task.title
        task.assignedQuadrantIndex = quadrant
        if targetSlot.configuredDurationSeconds == 0 && targetSlot.mode == .countdown {
            let seconds = min(max(initialMinutes, 0), 180) * 60
            targetSlot.configuredDurationSeconds = seconds
            targetSlot.pausedRemainingOrElapsedSeconds = Double(seconds)
        }
        try? modelContext.save()
    }

    /// Assigns a freeform custom title to a quadrant, or clears it back to unassigned Matte Gray if empty.
    public func assignCustomTitle(_ title: String, toQuadrant quadrant: Int, tasksOnCard: [CardTask] = []) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            clearAssignment(forQuadrant: quadrant, tasksOnCard: tasksOnCard)
            return
        }
        let targetSlot = slot(forQuadrant: quadrant)
        targetSlot.assignedTaskID = nil
        targetSlot.assignedTaskNumber = nil
        targetSlot.customTitle = trimmed
        if targetSlot.configuredDurationSeconds == 0 && targetSlot.mode == .countdown {
            targetSlot.configuredDurationSeconds = 45 * 60
            targetSlot.pausedRemainingOrElapsedSeconds = 45 * 60
        }
        try? modelContext.save()
    }

    /// Clears a tomato's title and returns it to its unassigned Matte Neutral Gray state (`Tap to assign`).
    public func clearAssignment(forQuadrant quadrant: Int, tasksOnCard: [CardTask] = []) {
        let targetSlot = slot(forQuadrant: quadrant)
        pause(quadrant: quadrant)
        for task in tasksOnCard where task.assignedQuadrantIndex == quadrant {
            task.assignedQuadrantIndex = nil
        }
        targetSlot.assignedTaskID = nil
        targetSlot.assignedTaskNumber = nil
        targetSlot.customTitle = nil
        targetSlot.mode = .countdown
        targetSlot.runState = .idle
        targetSlot.configuredDurationSeconds = 0
        targetSlot.pausedRemainingOrElapsedSeconds = 0
        targetSlot.targetEndDate = nil
        targetSlot.anchorStartDate = nil
        try? modelContext.save()
    }

    /// Winds or unwinds the countdown duration in 5-minute (30°) steps up to 180 minutes.
    public func setCountdownDuration(seconds: Int, forQuadrant quadrant: Int, at now: Date = .now) {
        let targetSlot = slot(forQuadrant: quadrant)
        let clampedSeconds = min(max(seconds, 0), TomatoTimerSlot.maxCountdownSeconds)
        targetSlot.mode = .countdown
        targetSlot.configuredDurationSeconds = clampedSeconds
        targetSlot.pausedRemainingOrElapsedSeconds = Double(clampedSeconds)
        if targetSlot.runState == .running {
            targetSlot.targetEndDate = now.addingTimeInterval(Double(clampedSeconds))
            notificationScheduler.scheduleCompletionChime(
                forQuadrant: quadrant,
                taskTitle: targetSlot.displayTitleUppercase,
                at: targetSlot.targetEndDate!
            )
        }
        try? modelContext.save()
    }

    /// Starts (`Play ▶`) the specified quadrant and automatically pauses any other running timer.
    public func play(quadrant: Int, at now: Date = .now) {
        let clamped = min(max(quadrant, 0), 5)
        // Enforce 1-active-timer rule: pause all other running timers first.
        for otherIndex in 0..<slots.count where otherIndex != clamped {
            if slots[otherIndex].runState == .running {
                pause(quadrant: otherIndex, at: now)
            }
        }

        let targetSlot = slots[clamped]
        switch targetSlot.mode {
        case .countdown:
            if targetSlot.pausedRemainingOrElapsedSeconds <= 0 {
                let fallback = targetSlot.configuredDurationSeconds > 0 ? Double(targetSlot.configuredDurationSeconds) : Double(25 * 60)
                targetSlot.configuredDurationSeconds = Int(fallback)
                targetSlot.pausedRemainingOrElapsedSeconds = fallback
            }
            let endDate = now.addingTimeInterval(targetSlot.pausedRemainingOrElapsedSeconds)
            targetSlot.targetEndDate = endDate
            targetSlot.runState = .running
            notificationScheduler.scheduleCompletionChime(
                forQuadrant: clamped,
                taskTitle: targetSlot.displayTitleUppercase,
                at: endDate
            )
        case .stopwatch:
            targetSlot.anchorStartDate = now.addingTimeInterval(-targetSlot.pausedRemainingOrElapsedSeconds)
            targetSlot.runState = .running
            notificationScheduler.cancelCompletionChime(forQuadrant: clamped)
        }
        try? modelContext.save()
    }

    /// Freezes (`Pause ||`) the timer at its current countdown or stopwatch value.
    public func pause(quadrant: Int, at now: Date = .now) {
        let targetSlot = slot(forQuadrant: quadrant)
        guard targetSlot.runState == .running else { return }
        targetSlot.pausedRemainingOrElapsedSeconds = targetSlot.currentSeconds(at: now)
        targetSlot.targetEndDate = nil
        targetSlot.anchorStartDate = nil
        targetSlot.runState = .paused
        notificationScheduler.cancelCompletionChime(forQuadrant: quadrant)
        try? modelContext.save()
    }

    /// Handles the two-step End (`■`) -> Silver Metallic (`.completed`) -> Reset (`↺`) lifecycle:
    /// - When not `.completed`: transitions the tomato into Satin Silver Metallic (`.completed`) without clearing its time.
    /// - When already `.completed`: resets the timer to `00:00` and returns the tomato to its heirloom color (`.idle`).
    public func endAndReset(quadrant: Int, at now: Date = .now) {
        let targetSlot = slot(forQuadrant: quadrant)
        notificationScheduler.cancelCompletionChime(forQuadrant: quadrant)
        if targetSlot.runState == .completed {
            resetCompletedTimer(quadrant: quadrant)
        } else {
            if targetSlot.runState == .running {
                targetSlot.pausedRemainingOrElapsedSeconds = targetSlot.currentSeconds(at: now)
            }
            targetSlot.targetEndDate = nil
            targetSlot.anchorStartDate = nil
            targetSlot.runState = .completed
            sensoryEngine.playTimerCompletionChime()
            try? modelContext.save()
        }
    }

    public func resetCompletedTimer(quadrant: Int) {
        let targetSlot = slot(forQuadrant: quadrant)
        notificationScheduler.cancelCompletionChime(forQuadrant: quadrant)
        targetSlot.runState = .idle
        targetSlot.configuredDurationSeconds = 0
        targetSlot.pausedRemainingOrElapsedSeconds = 0
        targetSlot.targetEndDate = nil
        targetSlot.anchorStartDate = nil
        try? modelContext.save()
    }

    /// Switches (`Stopwatch Toggle ⏱`) between Countdown Mode and Count-Up Stopwatch Mode (`00:00`).
    public func toggleStopwatchMode(forQuadrant quadrant: Int) {
        let targetSlot = slot(forQuadrant: quadrant)
        pause(quadrant: quadrant)
        if targetSlot.mode == .countdown {
            targetSlot.mode = .stopwatch
            targetSlot.configuredDurationSeconds = 0
            targetSlot.pausedRemainingOrElapsedSeconds = 0
        } else {
            targetSlot.mode = .countdown
            targetSlot.configuredDurationSeconds = 45 * 60
            targetSlot.pausedRemainingOrElapsedSeconds = 45 * 60
        }
        targetSlot.runState = .idle
        try? modelContext.save()
    }

    /// Reconciles active timers against hardware wall-clock time (`Date.now`) and fires completion chime if a countdown reached `00:00`.
    public func reconcileWallClockTimestamps(at now: Date = .now) {
        for index in 0..<slots.count {
            let item = slots[index]
            if item.mode == .countdown && item.runState == .running {
                if item.currentSeconds(at: now) <= 0 {
                    item.runState = .completed
                    item.pausedRemainingOrElapsedSeconds = 0
                    item.targetEndDate = nil
                    notificationScheduler.cancelCompletionChime(forQuadrant: index)
                    sensoryEngine.playTimerCompletionChime()
                    try? modelContext.save()
                }
            }
        }
    }

    private func loadOrCreateFourQuadrantSlots() {
        let descriptor = FetchDescriptor<TomatoTimerSlot>(
            sortBy: [SortDescriptor(\TomatoTimerSlot.quadrantIndex, order: .forward)]
        )
        let existing = (try? modelContext.fetch(descriptor)) ?? []
        if existing.count == 6 {
            self.slots = existing
            return
        }
        var created: [TomatoTimerSlot] = []
        for idx in 0..<6 {
            let slot = TomatoTimerSlot(quadrantIndex: idx)
            modelContext.insert(slot)
            created.append(slot)
        }
        try? modelContext.save()
        self.slots = created
    }
}
