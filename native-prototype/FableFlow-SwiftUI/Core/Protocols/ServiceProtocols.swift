import Foundation
import CoreGraphics

public protocol LogicalDayServiceProtocol: AnyObject {
    var currentLogicalDayKey: String { get }
    func miniCardDateStamp(for date: Date) -> String
    func fullCardDateStamp(for date: Date) -> String
    @discardableResult
    func refreshLogicalDayIfNeeded(at referenceDate: Date) -> Bool
}

public protocol SensoryServiceProtocol: AnyObject {
    var isEscapementTickAudioEnabled: Bool { get set }
    func prepareHardwareEngines()
    func playTomatoNotchClick(turnIndex: Int, isWindingUp: Bool)
    func playEscapementTickIfEnabled()
    func playTimerCompletionChime()
    func beginPencilContact()
    func updatePencilScratch(velocityPointsPerSecond: CGFloat, progress: CGFloat)
    func endPencilContact()
    func playCardFlip()
    func playStackRiffleTick()
    func playCardPermanentDelete()
}

public protocol TimerCompletionNotificationScheduling: AnyObject {
    func scheduleCompletionChime(forQuadrant quadrant: Int, taskTitle: String, at targetEndDate: Date)
    func cancelCompletionChime(forQuadrant quadrant: Int)
    func cancelAllCompletionChimes()
}
