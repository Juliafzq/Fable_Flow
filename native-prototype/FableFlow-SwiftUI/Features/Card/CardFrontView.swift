import SwiftUI

/// Renders the Front of Today's Card (Mockup p. 13 Top):
/// - Crisp white index card (`#FAF9F5`) with subtle dot-grid background below the `TUESDAY — OCT 06` header divider.
/// - Up to 6 flat main tasks (`01` through `06`) with zero subtasks and zero vertical scrolling.
/// - Muted gray `+ Add item` placeholder row when fewer than 6 tasks exist.
/// - 3-Icon Bottom Bar (`[Stack Icon]`, `[Flip Icon]`, `[+ Plus Icon]`).
public struct CardFrontView: View {
    public let card: DailyCard
    public let sensoryEngine: SensoryServiceProtocol
    public let onAddTask: () -> Void
    public let onUpdateTaskTitle: (CardTask, String) -> Void
    public let onToggleTaskStrikethrough: (CardTask, [CGPoint]) -> Void
    public let onTapTaskTomato: (CardTask) -> Void
    public let onTapStackIcon: () -> Void
    public let onFlipCard: () -> Void

    public init(
        card: DailyCard,
        sensoryEngine: SensoryServiceProtocol,
        onAddTask: @escaping () -> Void,
        onUpdateTaskTitle: @escaping (CardTask, String) -> Void,
        onToggleTaskStrikethrough: @escaping (CardTask, [CGPoint]) -> Void,
        onTapTaskTomato: @escaping (CardTask) -> Void,
        onTapStackIcon: @escaping () -> Void,
        onFlipCard: @escaping () -> Void
    ) {
        self.card = card
        self.sensoryEngine = sensoryEngine
        self.onAddTask = onAddTask
        self.onUpdateTaskTitle = onUpdateTaskTitle
        self.onToggleTaskStrikethrough = onToggleTaskStrikethrough
        self.onTapTaskTomato = onTapTaskTomato
        self.onTapStackIcon = onTapStackIcon
        self.onFlipCard = onFlipCard
    }

    public var body: some View {
        VStack(spacing: 26) {
            // Physical White Index Card Frame
            VStack(alignment: .leading, spacing: 0) {
                // Stamped Date Header: "TUESDAY — OCT 06" (Mockup p. 13 Top)
                Text(card.headerDisplayStamp)
                    .font(.system(size: 23, weight: .bold))
                    .tracking(0.3)
                    .foregroundStyle(ThemeTokens.inkPrimary)
                    .padding(.horizontal, 26)
                    .padding(.top, 24)
                    .padding(.bottom, 18)

                Divider()
                    .background(Color.black.opacity(0.12))

                // Clean White Card Body + Flat 6-Task List (No Vertical Scroll, No Dots)
                ZStack(alignment: .topLeading) {
                    VStack(alignment: .leading, spacing: 18) {
                        ForEach(card.sortedTasks, id: \.id) { task in
                            TaskRowView(
                                task: task,
                                sensoryEngine: sensoryEngine,
                                onUpdateTitle: { updated in
                                    onUpdateTaskTitle(task, updated)
                                },
                                onToggleStrikethrough: { points in
                                    onToggleTaskStrikethrough(task, points)
                                },
                                onTapTomatoTrigger: {
                                    onTapTaskTomato(task)
                                },
                                onSwipeRightToLeftFlip: onFlipCard
                            )
                        }

                        // "+ Add item" row when < 6 tasks exist (Mockup p. 13 Top)
                        if card.canAddTask {
                            Button(action: onAddTask) {
                                Text("+ Add item")
                                    .font(.system(size: 22, weight: .regular))
                                    .foregroundStyle(ThemeTokens.inkMutedGray)
                                    .padding(.top, 4)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Add task item")
                        }
                    }
                    .padding(.horizontal, 26)
                    .padding(.top, 24)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(ThemeTokens.cardFrontWhite)
                    .shadow(color: .black.opacity(0.10), radius: 18, y: 8)
            )
            .gesture(
                DragGesture(minimumDistance: 20)
                    .onEnded { value in
                        if CardGestureMath.isRightToLeftCardFlip(
                            startPoint: value.startLocation,
                            currentPoint: value.location
                        ) {
                            onFlipCard()
                        }
                    }
            )
            .padding(.horizontal, 28)

            // Today's Card Bottom Bar — 3 Icons (Mockup p. 13 Top: Stack, Flip, +)
            HStack {
                Button(action: onTapStackIcon) {
                    Image(systemName: "square.stack.3d.up")
                        .font(.system(size: 24, weight: .regular))
                        .foregroundStyle(ThemeTokens.inkPrimary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Open Card Stack Archive")

                Spacer()

                Button(action: onFlipCard) {
                    Image(systemName: "book.pages")
                        .font(.system(size: 24, weight: .regular))
                        .foregroundStyle(ThemeTokens.inkPrimary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Flip Card 180 degrees")

                Spacer()

                Button(action: onAddTask) {
                    Image(systemName: "plus")
                        .font(.system(size: 26, weight: .light))
                        .foregroundStyle(card.canAddTask ? ThemeTokens.inkPrimary : ThemeTokens.inkMutedGray)
                }
                .buttonStyle(.plain)
                .disabled(!card.canAddTask)
                .accessibilityLabel("Add task to Today's Card")
            }
            .padding(.horizontal, 64)
            .padding(.bottom, 16)
        }
    }

    private var dotGridBackground: some View {
        Canvas { context, size in
            let spacing: CGFloat = 22
            let dotSize: CGFloat = 2.0
            for x in stride(from: 24, to: size.width - 16, by: spacing) {
                for y in stride(from: 22, to: size.height - 16, by: spacing) {
                    let rect = CGRect(x: x, y: y, width: dotSize, height: dotSize)
                    context.fill(Path(ellipseIn: rect), with: .color(Color.black.opacity(0.12)))
                }
            }
        }
        .allowsHitTesting(false)
    }
}
