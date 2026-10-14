import SwiftUI

/// Renders the Global Top Bar (Mockups p. 11–14):
/// - Centered `Card | Timer` segmented pill toggle (or `'FABLE / FLOW'` title when on Homepage).
/// - Top-Right `[Profile Icon]` button.
public struct GlobalTopBarView: View {
    public enum ActivePillarTab: String, CaseIterable {
        case card = "Card"
        case timer = "Timer"
    }

    public let isHomepage: Bool
    @Binding public var activeTab: ActivePillarTab
    public let onTapProfile: () -> Void

    public init(
        isHomepage: Bool = false,
        activeTab: Binding<ActivePillarTab>,
        onTapProfile: @escaping () -> Void
    ) {
        self.isHomepage = isHomepage
        self._activeTab = activeTab
        self.onTapProfile = onTapProfile
    }

    public var body: some View {
        ZStack {
            if isHomepage {
                Text("FABLE / FLOW")
                    .font(.system(size: 13, weight: .regular))
                    .tracking(2.2)
                    .foregroundStyle(ThemeTokens.inkPrimary.opacity(0.80))
            } else {
                // Centered Card | Timer Segmented Pill (Mockups p. 11–14)
                HStack(spacing: 0) {
                    ForEach(ActivePillarTab.allCases, id: \.self) { tab in
                        let isSelected = (activeTab == tab)
                        Button {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.84)) {
                                activeTab = tab
                            }
                        } label: {
                            Text(tab.rawValue)
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(isSelected ? .white : ThemeTokens.inkPrimary.opacity(0.75))
                                .frame(width: 96, height: 34)
                                .background(
                                    Capsule()
                                        .fill(isSelected ? ThemeTokens.inkPrimary : .clear)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(3)
                .background(
                    Capsule()
                        .stroke(ThemeTokens.crosshairDivider.opacity(0.85), lineWidth: 1)
                )
            }

            HStack {
                Spacer()
                Button(action: onTapProfile) {
                    Image(systemName: "person")
                        .font(.system(size: 20, weight: .light))
                        .foregroundStyle(ThemeTokens.inkPrimary.opacity(0.75))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Account and Settings")
            }
        }
        .padding(.horizontal, 26)
        .padding(.top, 10)
        .padding(.bottom, 8)
    }
}
