import SwiftUI

/// Renders the dark floating dropdown menu directly over a tomato in the 2x2 Grid View (Mockup p. 12 Bottom-Left):
/// - Top row: Dark black header `+ Custom Title... ⌄`
/// - Bottom rows: White list of Today's Card tasks (`Pick Up Package`, etc.) + `Clear Assignment` if already assigned.
public struct TaskAssignmentMenuView: View {
    public let quadrantIndex: Int
    public let availableTasks: [CardTask]
    public let isCurrentlyAssigned: Bool
    public let onSelectTask: (CardTask) -> Void
    public let onSelectCustomTitle: (String) -> Void
    public let onClearAssignment: () -> Void

    @State private var isEnteringCustomTitle: Bool = false
    @State private var customTitleInput: String = ""

    public init(
        quadrantIndex: Int,
        availableTasks: [CardTask],
        isCurrentlyAssigned: Bool,
        onSelectTask: @escaping (CardTask) -> Void,
        onSelectCustomTitle: @escaping (String) -> Void,
        onClearAssignment: @escaping () -> Void
    ) {
        self.quadrantIndex = quadrantIndex
        self.availableTasks = availableTasks
        self.isCurrentlyAssigned = isCurrentlyAssigned
        self.onSelectTask = onSelectTask
        self.onSelectCustomTitle = onSelectCustomTitle
        self.onClearAssignment = onClearAssignment
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Top Dark Row: "+ Custom Title... ⌄" (Mockup p. 12 Bottom-Left)
            Button {
                isEnteringCustomTitle.toggle()
            } label: {
                HStack {
                    Text("+ Custom Title...")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.85))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(ThemeTokens.cardBackMatteBlack)
            }
            .buttonStyle(.plain)

            if isEnteringCustomTitle {
                HStack(spacing: 6) {
                    TextField("Enter title...", text: $customTitleInput)
                        .font(.system(size: 13))
                        .textFieldStyle(.plain)
                        .onSubmit {
                            onSelectCustomTitle(customTitleInput)
                        }
                    Button("Set") {
                        onSelectCustomTitle(customTitleInput)
                    }
                    .font(.system(size: 12, weight: .semibold))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(ThemeTokens.cardFrontWhite)
            }

            // Today's Card Tasks List (Mockup p. 12 Bottom-Left: "Pick Up Package")
            ForEach(availableTasks, id: \.id) { task in
                Button {
                    onSelectTask(task)
                } label: {
                    HStack {
                        Text(task.title)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(ThemeTokens.inkPrimary)
                            .lineLimit(1)
                        Spacer()
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(ThemeTokens.cardFrontWhite)
                }
                .buttonStyle(.plain)
            }

            if isCurrentlyAssigned {
                Divider()
                Button(role: .destructive) {
                    onClearAssignment()
                } label: {
                    HStack {
                        Text("Clear / Unassign")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(ThemeTokens.cardFrontWhite)
                }
                .buttonStyle(.plain)
            }
        }
        .frame(width: 158)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(ThemeTokens.cardBackMatteBlack, lineWidth: 1.2)
        )
        .shadow(color: .black.opacity(0.22), radius: 12, y: 6)
    }
}
