import Foundation
import AVFoundation

/// Configures `AVAudioSession` with `.ambient` category and `AVAudioSession.CategoryOptions.mixWithOthers` (PRD §11).
/// This guarantees:
/// 1. Hardware Silent Mode switch automatically silences sound effects while preserving CoreHaptics feedback.
/// 2. Tactile sound effects never pause, duck, or interrupt the user's background music or podcasts.
public final class TactileAudioManager {
    public enum SoundCue: String, CaseIterable {
        case ratchetNotch = "ratchet_notch"
        case escapementTick = "escapement_tick"
        case softChime = "soft_chime"
        case graphiteLoop = "graphite_loop"
        case cardFlipWhoosh = "card_flip_whoosh"
        case cardRiffleTick = "card_riffle_tick"
        case cardTrashDelete = "card_trash_delete"
    }

    private var players: [SoundCue: AVAudioPlayer] = [:]
    private(set) var isSessionConfigured: Bool = false

    public init() {
        configureAmbientMixSession()
        preloadAudioSamples()
    }

    public func configureAmbientMixSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .ambient,
                mode: .default,
                options: [.mixWithOthers]
            )
            try session.setActive(true)
            isSessionConfigured = true
        } catch {
            isSessionConfigured = false
        }
    }

    public func playOneShot(_ cue: SoundCue, volume: Float = 0.70, pitchSemitones: Float = 0) {
        guard let player = players[cue] else { return }
        player.volume = min(max(volume, 0.0), 1.0)
        player.currentTime = 0
        player.play()
    }

    public func startGraphiteLoop() {
        guard let player = players[.graphiteLoop] else { return }
        player.numberOfLoops = -1
        player.volume = 0.35
        player.play()
    }

    public func updateGraphiteLoop(normalizedSpeed: Float) {
        guard let player = players[.graphiteLoop] else { return }
        player.volume = min(max(normalizedSpeed * 0.65, 0.15), 0.75)
    }

    public func stopGraphiteLoop() {
        players[.graphiteLoop]?.stop()
    }

    private func preloadAudioSamples() {
        for cue in SoundCue.allCases {
            if let url = Bundle.main.url(forResource: cue.rawValue, withExtension: "caf"),
               let player = try? AVAudioPlayer(contentsOf: url) {
                player.prepareToPlay()
                players[cue] = player
            }
        }
    }
}
