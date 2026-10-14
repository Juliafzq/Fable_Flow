import SwiftUI

/// Minimalist 2-Object Homepage (Mockup `01-home-page.png`).
/// Displays the centered `'FABLE / FLOW'` header, the Daily Mini-Card stamped `'06 OCT'`,
/// and the studio-lit 3D Heirloom Tomato Pomodoro Timer.
public struct MinimalistHomepageView: View {
    public let shortDateText: String
    public let onOpenTodayCard: () -> Void
    public let onOpenTimer: () -> Void

    public init(
        shortDateText: String = "06 OCT",
        onOpenTodayCard: @escaping () -> Void,
        onOpenTimer: @escaping () -> Void
    ) {
        self.shortDateText = shortDateText
        self.onOpenTodayCard = onOpenTodayCard
        self.onOpenTimer = onOpenTimer
    }

    public var body: some View {
        VStack(spacing: 54) {
            // Object 1: The Daily Mini-Card
            Button(action: onOpenTodayCard) {
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .fill(Color(red: 0.98, green: 0.976, blue: 0.965))
                        .shadow(color: Color.black.opacity(0.14), radius: 22, x: 0, y: 12)

                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Color(red: 0.14, green: 0.13, blue: 0.12), lineWidth: 1.5)
                        .padding(6)

                    Text(shortDateText)
                        .font(.system(size: 24, weight: .heavy, design: .default))
                        .tracking(-0.5)
                        .foregroundStyle(Color(red: 0.05, green: 0.05, blue: 0.05))
                        .padding(.top, 21)
                        .padding(.leading, 24)
                }
                .frame(width: 256, height: 162)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open Today's Index Card (\(shortDateText))")

            // Object 2: Studio-Lit 3D Heirloom Tomato
            Button(action: onOpenTimer) {
                Tomato3DSceneView(
                    angleDegrees: 150.0,
                    quadrantIndex: 0,
                    isAssigned: true,
                    isCompleted: false
                )
                .frame(width: 320, height: 280)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open Pomodoro Timer")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ThemeTokens.warmPaperCanvas)
    }
}
