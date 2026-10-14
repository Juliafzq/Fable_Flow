import SwiftUI

/// Monthly Calendar Zoom-Out View (Mockup `07-calendar-view.png`).
/// Displays vertically stacked `SEPTEMBER 2026` and `OCTOBER 2026` monthly grids with
/// soft grey circles on dates that have an archived card and a solid black circle on the selected date.
public struct MonthlyCalendarZoomView: View {
    public let archivedDates: Set<String>
    @Binding public var selectedDateKey: String
    public let onReturnToToday: () -> Void
    public let onZoomInToStack: () -> Void

    public init(
        archivedDates: Set<String>,
        selectedDateKey: Binding<String>,
        onReturnToToday: @escaping () -> Void,
        onZoomInToStack: @escaping () -> Void
    ) {
        self.archivedDates = archivedDates
        self._selectedDateKey = selectedDateKey
        self.onReturnToToday = onReturnToToday
        self.onZoomInToStack = onZoomInToStack
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("SEPTEMBER 2026")
                .font(.system(size: 20.5, weight: .heavy))
                .foregroundStyle(Color.black)

            Text("OCTOBER 2026")
                .font(.system(size: 20.5, weight: .heavy))
                .foregroundStyle(Color.black)

            Spacer()

            // 2-Icon Calendar Bottom Bar: [Return ↩] [Zoom In 🔍+]
            HStack {
                Button(action: onReturnToToday) {
                    Image(systemName: "arrow.uturn.left")
                        .font(.system(size: 22, weight: .semibold))
                }
                Spacer()
                Button(action: onZoomInToStack) {
                    Image(systemName: "plus.magnifyingglass")
                        .font(.system(size: 22, weight: .semibold))
                }
            }
            .foregroundStyle(Color.black)
            .padding(.horizontal, 46)
            .frame(height: 76)
        }
        .padding(.horizontal, 34)
    }
}
