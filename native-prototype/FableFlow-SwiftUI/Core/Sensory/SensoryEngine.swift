import Foundation
import CoreGraphics
import Observation

@Observable
public final class SensoryEngine: SensoryServiceProtocol {
    public var isEscapementTickAudioEnabled: Bool = true
    public private(set) var lastTriggeredCue: String = "none"

    private let hapticLibrary: HapticPatternLibrary
    private let audioManager: TactileAudioManager

    public init(
        hapticLibrary: HapticPatternLibrary = HapticPatternLibrary(),
        audioManager: TactileAudioManager = TactileAudioManager()
    ) {
        self.hapticLibrary = hapticLibrary
        self.audioManager = audioManager
    }

    public func prepareHardwareEngines() {
        hapticLibrary.prepareEngineIfNeeded()
        audioManager.configureAmbientMixSession()
    }

    /// Fires synchronized stepped mechanical click (30° / 5-min notch) and soft ratchet tick.
    public func playTomatoNotchClick(turnIndex: Int, isWindingUp: Bool) {
        lastTriggeredCue = "tomato_notch_turn_\(turnIndex)_\(isWindingUp ? "up" : "down")"
        hapticLibrary.playTomatoNotchTransient(turnIndex: turnIndex)
        audioManager.playOneShot(.ratchetNotch, pitchSemitones: Float(turnIndex) * 0.5)
    }

    /// Plays optional subtle mechanical escapement tick while countdown or stopwatch is actively running.
    public func playEscapementTickIfEnabled() {
        guard isEscapementTickAudioEnabled else { return }
        lastTriggeredCue = "escapement_tick"
        hapticLibrary.playSubtleEscapementTick()
        audioManager.playOneShot(.escapementTick, volume: 0.28)
    }

    /// Plays soft chime when countdown reaches 00:00.
    public func playTimerCompletionChime() {
        lastTriggeredCue = "completion_chime"
        hapticLibrary.playCompletionChimeResonance()
        audioManager.playOneShot(.softChime, volume: 0.85)
    }

    /// Fires sharp transient pencil contact impact when Left -> Right drag begins on a task row.
    public func beginPencilContact() {
        lastTriggeredCue = "pencil_contact_start"
        hapticLibrary.playPencilContactImpact()
        audioManager.startGraphiteLoop()
    }

    /// Modulates continuous graphite drag friction haptics and paper stroke audio by finger speed.
    public func updatePencilScratch(velocityPointsPerSecond: CGFloat, progress: CGFloat) {
        lastTriggeredCue = "pencil_scratch_active"
        let normalizedVelocity = Float(min(max(velocityPointsPerSecond / 950.0, 0.15), 1.0))
        hapticLibrary.updateContinuousPencilFriction(intensity: normalizedVelocity)
        audioManager.updateGraphiteLoop(normalizedSpeed: normalizedVelocity)
    }

    public func endPencilContact() {
        lastTriggeredCue = "pencil_contact_end"
        audioManager.stopGraphiteLoop()
    }

    /// Fires crisp mid-weight transient lift + soft landing thud and paper-whoosh audio for 180° card flip.
    public func playCardFlip() {
        lastTriggeredCue = "card_flip_180"
        hapticLibrary.playCardFlipPattern()
        audioManager.playOneShot(.cardFlipWhoosh, volume: 0.72)
    }

    /// Fires light crisp transient tick and cardstock sliding audio per card passed in Stack Viewer.
    public func playStackRiffleTick() {
        lastTriggeredCue = "stack_riffle_tick"
        hapticLibrary.playStackRiffleTransient()
        audioManager.playOneShot(.cardRiffleTick, volume: 0.55)
    }

    /// Fires permanent card deletion feedback when confirmed via Trash Can.
    public func playCardPermanentDelete() {
        lastTriggeredCue = "card_permanent_delete"
        hapticLibrary.playCardDeleteTransient()
        audioManager.playOneShot(.cardTrashDelete, volume: 0.65)
    }
}
