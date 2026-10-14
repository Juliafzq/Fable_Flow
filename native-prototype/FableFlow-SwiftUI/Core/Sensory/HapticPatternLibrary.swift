import Foundation
import CoreHaptics

public final class HapticPatternLibrary {
    private var engine: CHHapticEngine?
    private var supportsHaptics: Bool = false

    public init() {
        let capabilities = CHHapticEngine.capabilitiesForHardware()
        self.supportsHaptics = capabilities.supportsHaptics
        prepareEngineIfNeeded()
    }

    public func prepareEngineIfNeeded() {
        guard supportsHaptics else { return }
        if engine == nil {
            engine = try? CHHapticEngine()
            engine?.isAutoShutdownEnabled = true
            engine?.resetHandler = { [weak self] in
                try? self?.engine?.start()
            }
        }
        try? engine?.start()
    }

    /// Stepped mechanical click for each 30° / 5-minute notch on the 3-turn tomato dial.
    public func playTomatoNotchTransient(turnIndex: Int) {
        let sharpness = min(0.95, 0.75 + Float(turnIndex) * 0.08)
        playEvents([
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.80),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness)
                ],
                relativeTime: 0
            )
        ])
    }

    public func playSubtleEscapementTick() {
        playEvents([
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.25),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.90)
                ],
                relativeTime: 0
            )
        ])
    }

    public func playCompletionChimeResonance() {
        playEvents([
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.85),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.45)
                ],
                relativeTime: 0
            ),
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.45),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.20)
                ],
                relativeTime: 0.03,
                duration: 0.42
            )
        ])
    }

    /// Sharp transient pencil contact impact when starting a Left -> Right drag on a task row.
    public func playPencilContactImpact() {
        playEvents([
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.78),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.92)
                ],
                relativeTime: 0
            )
        ])
    }

    /// Continuous velocity-modulated drag friction simulating graphite on heavy cardstock.
    public func updateContinuousPencilFriction(intensity: Float) {
        let clamped = min(max(intensity, 0.20), 0.90)
        playEvents([
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: clamped * 0.55),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.82)
                ],
                relativeTime: 0,
                duration: 0.06
            )
        ])
    }

    /// Crisp mid-weight transient lift + soft landing thud for 3D 180° card flip.
    public func playCardFlipPattern() {
        playEvents([
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.65),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.72)
                ],
                relativeTime: 0
            ),
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.52),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.28)
                ],
                relativeTime: 0.22
            )
        ])
    }

    /// Light crisp transient tick per card passed when thumb-scrolling the Card Stack.
    public func playStackRiffleTransient() {
        playEvents([
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.48),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.88)
                ],
                relativeTime: 0
            )
        ])
    }

    public func playCardDeleteTransient() {
        playEvents([
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.75),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.60)
                ],
                relativeTime: 0
            )
        ])
    }

    private func playEvents(_ events: [CHHapticEvent]) {
        guard supportsHaptics, let engine else { return }
        guard let pattern = try? CHHapticPattern(events: events, parameters: []),
              let player = try? engine.makePlayer(with: pattern) else { return }
        try? player.start(atTime: CHHapticTimeImmediate)
    }
}
