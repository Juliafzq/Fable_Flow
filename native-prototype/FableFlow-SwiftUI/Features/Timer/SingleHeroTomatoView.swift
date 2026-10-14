import SwiftUI

/// Renders the zoomed-in Single Big Hero Tomato View & Bidirectional 3-Turn Odometer Dial (Mockup p. 11 Bottom):
/// - Huge bold left-aligned digital readout (`02:30`) + uppercase subtitle (`01 / MATH STUDY`).
/// - Large 3D Heirloom Tomato with horizontal Right -> Left wind and Left -> Right unwind gesture.
/// - 4-Icon Bottom Control Bar: `[2x2 Grid Icon]`, `[Play / Pause]`, `[End / Reset]`, `[Stopwatch Toggle]`.
public struct SingleHeroTomatoView: View {
    public let quadrantIndex: Int
    public let timerCoordinator: TimerCoordinator
    public let sensoryEngine: SensoryServiceProtocol
    public let onReturnToGrid: () -> Void

    @State private var dragStartAngleDegrees: Double? = nil
    @State private var liveDragAngleDegrees: Double? = nil
    @State private var lastNotchCountTriggered: Int = 0
    @State private var isShowingTimeInputAlert: Bool = false
    @State private var typedTimeString: String = ""

    public init(
        quadrantIndex: Int,
        timerCoordinator: TimerCoordinator,
        sensoryEngine: SensoryServiceProtocol,
        onReturnToGrid: @escaping () -> Void
    ) {
        self.quadrantIndex = quadrantIndex
        self.timerCoordinator = timerCoordinator
        self.sensoryEngine = sensoryEngine
        self.onReturnToGrid = onReturnToGrid
    }

    private var slot: TomatoTimerSlot {
        timerCoordinator.slot(forQuadrant: quadrantIndex)
    }

    private var currentAngleDegrees: Double {
        if let liveDragAngleDegrees {
            return liveDragAngleDegrees
        }
        switch slot.mode {
        case .countdown:
            return OdometerDialPhysics.angleDegrees(forCountdownSeconds: slot.currentSeconds())
        case .stopwatch:
            return OdometerDialPhysics.forwardAngleDegrees(forStopwatchElapsedSeconds: slot.currentSeconds())
        }
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Top-Left Digital Readout & Task Label (Tap digits to type duration directly)
            VStack(alignment: .leading, spacing: 2) {
                Button {
                    let currentMins = Int(round(slot.currentSeconds() / 60.0))
                    typedTimeString = "\(currentMins)"
                    isShowingTimeInputAlert = true
                } label: {
                    Text(slot.formattedReadout())
                        .font(.system(size: 92, weight: .bold))
                        .tracking(-2.5)
                        .monospacedDigit()
                        .foregroundStyle(ThemeTokens.inkPrimary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Timer duration \(slot.formattedReadout()). Tap to type time in minutes.")
                .alert("Set Timer Duration", isPresented: $isShowingTimeInputAlert) {
                    TextField("Minutes (0–180) or HH:MM", text: $typedTimeString)
                    Button("Cancel", role: .cancel) {}
                    Button("Set") {
                        if let mins = OdometerDialPhysics.parseTypedTimeInput(typedTimeString) {
                            let turnIdx = OdometerDialPhysics.turnIndex(forMinutes: mins)
                            sensoryEngine.playTomatoNotchClick(turnIndex: turnIdx, isWindingUp: true)
                            timerCoordinator.setCountdownDuration(seconds: mins * 60, forQuadrant: quadrantIndex)
                        }
                    }
                } message: {
                    Text("Enter minutes (0–180) or HH:MM (e.g. 02:30).")
                }

                Text(slot.heroSubtitleLabel)
                    .font(.system(size: 22, weight: .semibold))
                    .tracking(0.4)
                    .foregroundStyle(ThemeTokens.inkPrimary)
            }
            .padding(.horizontal, 26)
            .padding(.top, 12)

            Spacer()

            // Center 3D Heirloom Tomato with Bidirectional 3-Turn Odometer Drag Gesture
            HStack {
                Spacer()
                Tomato3DSceneView(
                    quadrantIndex: quadrantIndex,
                    isAssigned: slot.isAssigned,
                    cumulativeAngleDegrees: currentAngleDegrees,
                    isActivelyDragging: liveDragAngleDegrees != nil,
                    isTicking: slot.runState == .running,
                    showEquatorialOdometerNumbers: true
                )
                .frame(width: 268, height: 242)
                .gesture(
                    DragGesture(minimumDistance: 2)
                        .onChanged { value in
                            guard slot.mode == .countdown else { return }
                            let baseAngle = dragStartAngleDegrees ?? OdometerDialPhysics.angleDegrees(forCountdownSeconds: slot.currentSeconds())
                            if dragStartAngleDegrees == nil {
                                dragStartAngleDegrees = baseAngle
                                lastNotchCountTriggered = 0
                            }
                            let result = OdometerDialPhysics.applyHorizontalDrag(
                                initialAngleDegrees: baseAngle,
                                translationX: value.translation.width
                            )
                            liveDragAngleDegrees = result.snappedAngleDegrees
                            if result.notchesCrossed != lastNotchCountTriggered {
                                lastNotchCountTriggered = result.notchesCrossed
                                sensoryEngine.playTomatoNotchClick(
                                    turnIndex: result.activeTurnIndex,
                                    isWindingUp: result.isWindingUp
                                )
                                timerCoordinator.setCountdownDuration(
                                    seconds: result.durationSeconds,
                                    forQuadrant: quadrantIndex
                                )
                            }
                        }
                        .onEnded { _ in
                            dragStartAngleDegrees = nil
                            liveDragAngleDegrees = nil
                            lastNotchCountTriggered = 0
                        }
                )
                .accessibilityAdjustableAction { direction in
                    let currentMins = Int(round(slot.currentSeconds() / 60.0))
                    switch direction {
                    case .increment:
                        let nextSeconds = min(180, currentMins + 5) * 60
                        timerCoordinator.setCountdownDuration(seconds: nextSeconds, forQuadrant: quadrantIndex)
                    case .decrement:
                        let prevSeconds = max(0, currentMins - 5) * 60
                        timerCoordinator.setCountdownDuration(seconds: prevSeconds, forQuadrant: quadrantIndex)
                    @unknown default:
                        break
                    }
                }
                Spacer()
            }

            Spacer()

            // Bottom Control Bar — 4 Icons (Mockup p. 11 Bottom)
            HStack {
                // 1. Bottom-Left [2x2 Grid Icon]
                Button(action: onReturnToGrid) {
                    Image(systemName: "square.grid.2x2")
                        .font(.system(size: 28, weight: .medium))
                        .foregroundStyle(ThemeTokens.inkPrimary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Return to 4-Tomato Grid View")

                Spacer()

                // 2. Center-Left [Play ▶ / Pause ||]
                Button {
                    if slot.runState == .running {
                        timerCoordinator.pause(quadrant: quadrantIndex)
                    } else {
                        timerCoordinator.play(quadrant: quadrantIndex)
                    }
                } label: {
                    Image(systemName: slot.runState == .running ? "pause.fill" : "play.fill")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(ThemeTokens.inkPrimary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(slot.runState == .running ? "Pause timer" : "Start timer")

                Spacer()

                // 3. Center-Right [End ■ -> Silver Metallic -> Reset ↺]
                Button {
                    timerCoordinator.endAndReset(quadrant: quadrantIndex)
                } label: {
                    if slot.runState == .completed {
                        Image(systemName: "arrow.counterclockwise")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(ThemeTokens.inkPrimary)
                    } else {
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .fill(ThemeTokens.inkPrimary)
                            .frame(width: 28, height: 28)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(slot.runState == .completed ? "Reset timer to 00:00" : "End timer and turn tomato silver metallic")

                Spacer()

                // 4. Bottom-Right [Stopwatch Toggle ⏱]
                Button {
                    timerCoordinator.toggleStopwatchMode(forQuadrant: quadrantIndex)
                } label: {
                    Image(systemName: slot.mode == .stopwatch ? "stopwatch.fill" : "stopwatch")
                        .font(.system(size: 30, weight: .medium))
                        .foregroundStyle(ThemeTokens.inkPrimary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Toggle Count-Up Stopwatch Mode")
            }
            .padding(.horizontal, 42)
            .padding(.bottom, 28)
        }
    }
}
