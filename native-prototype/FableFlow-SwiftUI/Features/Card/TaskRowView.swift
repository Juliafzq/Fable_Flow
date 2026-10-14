import SwiftUI

/// Renders an individual numbered task slot (`01` through `06`) on Today's White Index Card (Mockup p. 13 Top):
/// - Left: Two-digit slot number (`01`, `02`, `03`) + inline editable task title.
/// - Overlay: `PencilStrikethroughCanvas` for Left -> Right graphite cross-out & erase.
/// - Right: Small 3D heirloom tomato icon (colored in its quadrant's heirloom red when assigned, or matte gray when unassigned);
///   tapping it opens `SingleHeroTomatoView` synced to this task.
public struct TaskRowView: View {
    @Bindable public var task: CardTask
    public let sensoryEngine: SensoryServiceProtocol
    public let onUpdateTitle: (String) -> Void
    public let onToggleStrikethrough: ([CGPoint]) -> Void
    public let onTapTomatoTrigger: () -> Void
    public let onSwipeRightToLeftFlip: () -> Void

    @FocusState private var isEditingText: Bool

    public init(
        task: CardTask,
        sensoryEngine: SensoryServiceProtocol,
        onUpdateTitle: @escaping (String) -> Void,
        onToggleStrikethrough: @escaping ([CGPoint]) -> Void,
        onTapTomatoTrigger: @escaping () -> Void,
        onSwipeRightToLeftFlip: @escaping () -> Void = {}
    ) {
        self.task = task
        self.sensoryEngine = sensoryEngine
        self.onUpdateTitle = onUpdateTitle
        self.onToggleStrikethrough = onToggleStrikethrough
        self.onTapTomatoTrigger = onTapTomatoTrigger
        self.onSwipeRightToLeftFlip = onSwipeRightToLeftFlip
    }

    public var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // Numbered Task Text + Graphite Pencil Strikethrough Overlay
            ZStack(alignment: .leading) {
                HStack(alignment: .top, spacing: 12) {
                    Text(task.formattedSlotNumber)
                        .font(.system(size: 22, weight: .regular))
                        .monospacedDigit()
                        .foregroundStyle(ThemeTokens.inkPrimary)

                    TextField("Task title", text: $task.title, axis: .vertical)
                        .font(.system(size: 22, weight: .regular))
                        .foregroundStyle(ThemeTokens.inkPrimary)
                        .lineLimit(1...2)
                        .focused($isEditingText)
                        .onChange(of: task.title) { _, newValue in
                            onUpdateTitle(newValue)
                        }
                }
                .padding(.vertical, 4)

                PencilStrikethroughCanvas(
                    isCompleted: task.isCompleted,
                    savedPoints: task.strikethroughPoints,
                    sensoryEngine: sensoryEngine,
                    onCommitLeftToRightStroke: { points in
                        onToggleStrikethrough(points)
                    },
                    onDetectRightToLeftCardFlip: onSwipeRightToLeftFlip
                )
            }
            .onTapGesture {
                isEditingText = true
            }

            Spacer(minLength: 8)

            // Right-Side Small Heirloom Tomato Icon (Mockup p. 13 Top)
            Button(action: onTapTomatoTrigger) {
                smallHeirloomTomatoBadge
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
            .accessibilityLabel("Open Pomodoro timer for \(task.title)")
        }
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: Text(task.isCompleted ? "Erase strikethrough" : "Cross out task")) {
            onToggleStrikethrough([])
        }
        .accessibilityAction(named: Text("Start Pomodoro timer")) {
            onTapTomatoTrigger()
        }
    }

    private var smallHeirloomTomatoBadge: some View {
        let assignedQuad = task.assignedQuadrantIndex
        let fillColor = ThemeTokens.heirloomColor(
            forQuadrant: assignedQuad ?? 0,
            isAssigned: assignedQuad != nil
        )
        return ZStack(alignment: .top) {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [fillColor.opacity(0.9), fillColor, .black.opacity(0.35)],
                        center: UnitPoint(x: 0.35, y: 0.30),
                        startRadius: 2,
                        endRadius: 16
                    )
                )
                .frame(width: 28, height: 25)

            // White Calyx Star Crown (matching Mockup p. 13 small tomato icons)
            Image(systemName: "sparkle")
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(.white.opacity(0.9))
                .offset(y: 2)
        }
    }
}
