import SwiftUI

/// Renders the 4-Tomato 2x2 Grid View with subtle crosshair lines, unassigned matte gray vs. 4 distinct heirloom red shades,
/// inline Play/Pause & End controls below assigned tomatoes, and the floating task assignment dropdown (Mockup p. 12).
public struct FourTomatoGridView: View {
    public let timerCoordinator: TimerCoordinator
    public let availableTasks: [CardTask]
    public let onOpenHeroTomato: (Int) -> Void

    @State private var activeDropdownQuadrant: Int? = nil

    public init(
        timerCoordinator: TimerCoordinator,
        availableTasks: [CardTask],
        onOpenHeroTomato: @escaping (Int) -> Void
    ) {
        self.timerCoordinator = timerCoordinator
        self.availableTasks = availableTasks
        self.onOpenHeroTomato = onOpenHeroTomato
    }

    public var body: some View {
        GeometryReader { proxy in
            ZStack {
                // Subtle 2x2 Crosshair Divider Lines (Mockup p. 12)
                Path { path in
                    let midX = proxy.size.width / 2
                    let midY = proxy.size.height / 2
                    path.move(to: CGPoint(x: midX, y: 12))
                    path.addLine(to: CGPoint(x: midX, y: proxy.size.height - 24))
                    path.move(to: CGPoint(x: 20, y: midY))
                    path.addLine(to: CGPoint(x: proxy.size.width - 20, y: midY))
                }
                .stroke(ThemeTokens.crosshairDivider.opacity(0.65), lineWidth: 1)

                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        quadrantCell(for: 0)
                        quadrantCell(for: 1)
                    }
                    HStack(spacing: 0) {
                        quadrantCell(for: 2)
                        quadrantCell(for: 3)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func quadrantCell(for quadrant: Int) -> some View {
        let slot = timerCoordinator.slot(forQuadrant: quadrant)
        ZStack {
            VStack(spacing: 18) {
                Tomato3DSceneView(
                    quadrantIndex: quadrant,
                    isAssigned: slot.isAssigned,
                    cumulativeAngleDegrees: OdometerDialPhysics.angleDegrees(forCountdownSeconds: slot.currentSeconds()),
                    isActivelyDragging: false,
                    isTicking: slot.runState == .running,
                    showEquatorialOdometerNumbers: false,
                    overlayTitle: slot.isAssigned ? slot.displayTitleUppercase : "Tap to assign",
                    overlayReadout: slot.isAssigned ? slot.formattedReadout() : nil
                )
                .frame(width: 146, height: 132)
                .onTapGesture {
                    if slot.isAssigned {
                        onOpenHeroTomato(quadrant)
                    } else {
                        activeDropdownQuadrant = (activeDropdownQuadrant == quadrant) ? nil : quadrant
                    }
                }
                .onLongPressGesture {
                    activeDropdownQuadrant = quadrant
                }

                // Inline Play/Pause and End buttons directly below assigned tomatoes (Mockup p. 12)
                if slot.isAssigned {
                    HStack(spacing: 42) {
                        Button {
                            if slot.runState == .running {
                                timerCoordinator.pause(quadrant: quadrant)
                            } else {
                                timerCoordinator.play(quadrant: quadrant)
                            }
                        } label: {
                            Image(systemName: slot.runState == .running ? "pause.fill" : "play.fill")
                                .font(.system(size: 22, weight: .bold))
                                .foregroundStyle(ThemeTokens.inkPrimary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(slot.runState == .running ? "Pause timer" : "Start timer")

                        Button {
                            timerCoordinator.endAndReset(quadrant: quadrant)
                        } label: {
                            RoundedRectangle(cornerRadius: 3, style: .continuous)
                                .fill(ThemeTokens.inkPrimary)
                                .frame(width: 20, height: 20)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("End and reset timer")
                    }
                } else {
                    Spacer().frame(height: 24)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if activeDropdownQuadrant == quadrant {
                TaskAssignmentMenuView(
                    quadrantIndex: quadrant,
                    availableTasks: availableTasks,
                    isCurrentlyAssigned: slot.isAssigned,
                    onSelectTask: { task in
                        timerCoordinator.assignTask(task, toQuadrant: quadrant)
                        activeDropdownQuadrant = nil
                    },
                    onSelectCustomTitle: { custom in
                        timerCoordinator.assignCustomTitle(custom, toQuadrant: quadrant, tasksOnCard: availableTasks)
                        activeDropdownQuadrant = nil
                    },
                    onClearAssignment: {
                        timerCoordinator.clearAssignment(forQuadrant: quadrant, tasksOnCard: availableTasks)
                        activeDropdownQuadrant = nil
                    }
                )
                .offset(y: 18)
            }
        }
    }
}
