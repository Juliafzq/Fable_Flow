import SwiftUI

/// Root workspace container for Phase 1 Beta (`v0.2.0-beta`), uniting:
/// - Front of Today's Card (`CardFrontView`)
/// - 4-Pomodoro 2x2 Grid View (`FourTomatoGridView`) & Single Big Hero Tomato View (`SingleHeroTomatoView`)
/// - Global `Card | Timer` Pill & Top-Right Profile icon (`GlobalTopBarView`)
/// - In-App Notification Toast Banner (`InAppToastBannerView`)
public struct PhaseOneWorkspaceView: View {
    public let cardRepository: DailyCardRepository
    public let timerCoordinator: TimerCoordinator
    public let logicalDayService: LogicalDayService
    public let sensoryEngine: SensoryEngine
    public let toastCenter: ToastNotificationCenter

    @State private var activeTab: GlobalTopBarView.ActivePillarTab = .card
    @State private var isShowingSettingsModal: Bool = false

    public init(
        cardRepository: DailyCardRepository,
        timerCoordinator: TimerCoordinator,
        logicalDayService: LogicalDayService,
        sensoryEngine: SensoryEngine,
        toastCenter: ToastNotificationCenter
    ) {
        self.cardRepository = cardRepository
        self.timerCoordinator = timerCoordinator
        self.logicalDayService = logicalDayService
        self.sensoryEngine = sensoryEngine
        self.toastCenter = toastCenter
    }

    public var body: some View {
        ZStack(alignment: .top) {
            ThemeTokens.deskCanvas
                .ignoresSafeArea()

            VStack(spacing: 8) {
                GlobalTopBarView(
                    isHomepage: false,
                    activeTab: $activeTab,
                    onTapProfile: {
                        isShowingSettingsModal = true
                    }
                )

                switch activeTab {
                case .card:
                    if let card = cardRepository.todaysCard {
                        CardFrontView(
                            card: card,
                            sensoryEngine: sensoryEngine,
                            onAddTask: {
                                _ = cardRepository.addTask(title: "", to: card)
                            },
                            onUpdateTaskTitle: { task, newTitle in
                                cardRepository.updateTaskTitle(newTitle, for: task)
                            },
                            onToggleTaskStrikethrough: { task, points in
                                cardRepository.applyLeftToRightPencilGesture(on: task, strokePoints: points)
                            },
                            onTapTaskTomato: { task in
                                if let assignedQuadrant = task.assignedQuadrantIndex {
                                    timerCoordinator.clearQuadrant(assignedQuadrant)
                                } else {
                                    let targetQuadrant = nextAvailableQuadrant()
                                    timerCoordinator.assignTask(task, toQuadrant: targetQuadrant)
                                    timerCoordinator.selectedHeroQuadrantIndex = targetQuadrant
                                    withAnimation(.spring(response: 0.34, dampingFraction: 0.84)) {
                                        activeTab = .timer
                                    }
                                }
                            },
                            onTapStackIcon: {
                                toastCenter.show("Card Stack Viewer unlocks in Phase 2 MVP")
                            },
                            onFlipCard: {
                                sensoryEngine.playCardFlip()
                                toastCenter.show("Back-of-Card Journal flips in Phase 2 MVP")
                            }
                        )
                    }
                case .timer:
                    if let heroQuadrant = timerCoordinator.selectedHeroQuadrantIndex {
                        SingleHeroTomatoView(
                            quadrantIndex: heroQuadrant,
                            timerCoordinator: timerCoordinator,
                            sensoryEngine: sensoryEngine,
                            onReturnToGrid: {
                                withAnimation(.spring(response: 0.32, dampingFraction: 0.85)) {
                                    timerCoordinator.selectedHeroQuadrantIndex = nil
                                }
                            }
                        )
                    } else {
                        FourTomatoGridView(
                            timerCoordinator: timerCoordinator,
                            availableTasks: (cardRepository.todaysCard?.sortedTasks ?? []).filter { $0.assignedQuadrantIndex == nil },
                            onOpenHeroTomato: { quadrant in
                                withAnimation(.spring(response: 0.32, dampingFraction: 0.85)) {
                                    timerCoordinator.selectedHeroQuadrantIndex = quadrant
                                }
                            }
                        )
                    }
                }
            }

            InAppToastBannerView(toastCenter: toastCenter)
                .padding(.top, 58)
        }
    }

    private func nextAvailableQuadrant() -> Int {
        for idx in 0..<4 {
            if !timerCoordinator.slot(forQuadrant: idx).isAssigned {
                return idx
            }
        }
        return 0
    }
}
