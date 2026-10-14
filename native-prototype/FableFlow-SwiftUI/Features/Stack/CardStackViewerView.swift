import SwiftUI

/// Chronological Card Stack Viewer (Mockup `06-stack-detail.png`).
/// Features the horizontal date strip (`OCT 01 02 03 04 (05) 06`), center peeking card carousel,
/// full retroactive editing of Front & Back faces, and the 4-icon bottom action bar
/// (`[Return ↩]`, `[Zoom Out 🔍-]`, `[Flip]`, `[Trash 🗑]`).
public struct CardStackViewerView: View {
    public let dateStripDays: [Int]
    @Binding public var selectedDay: Int
    @Binding public var isFlipped: Bool
    public let onReturnToToday: () -> Void
    public let onZoomOutToCalendar: () -> Void
    public let onDeleteSelectedCard: () -> Void

    public init(
        dateStripDays: [Int] = [1, 2, 3, 4, 5, 6],
        selectedDay: Binding<Int>,
        isFlipped: Binding<Bool>,
        onReturnToToday: @escaping () -> Void,
        onZoomOutToCalendar: @escaping () -> Void,
        onDeleteSelectedCard: @escaping () -> Void
    ) {
        self.dateStripDays = dateStripDays
        self._selectedDay = selectedDay
        self._isFlipped = isFlipped
        self.onReturnToToday = onReturnToToday
        self.onZoomOutToCalendar = onZoomOutToCalendar
        self.onDeleteSelectedCard = onDeleteSelectedCard
    }

    public var body: some View {
        VStack(spacing: 12) {
            // Top Horizontal Date Strip ('OCT 01 02 03 04 (05) 06')
            HStack(spacing: 8) {
                Text("OCT")
                    .font(.system(size: 16.5, weight: .heavy))
                    .foregroundStyle(Color.black)

                ForEach(dateStripDays, id: \.self) { day in
                    Button(action: { selectedDay = day }) {
                        Text(String(format: "%02d", day))
                            .font(.system(size: 16, weight: selectedDay == day ? .bold : .medium))
                            .foregroundStyle(selectedDay == day ? Color.white : Color.black.opacity(0.65))
                            .frame(width: 36, height: 36)
                            .background(
                                Circle()
                                    .fill(selectedDay == day ? Color.black : Color.clear)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 24)

            Spacer()

            // 4-Icon Stack Bottom Bar: [Return ↩] [Zoom Out 🔍-] [Flip] [Trash 🗑]
            HStack {
                Button(action: onReturnToToday) {
                    Image(systemName: "arrow.uturn.left")
                        .font(.system(size: 22, weight: .semibold))
                }
                Spacer()
                Button(action: onZoomOutToCalendar) {
                    Image(systemName: "minus.magnifyingglass")
                        .font(.system(size: 22, weight: .semibold))
                }
                Spacer()
                Button(action: { isFlipped.toggle() }) {
                    Image(systemName: "book.pages")
                        .font(.system(size: 22, weight: .semibold))
                }
                Spacer()
                Button(action: onDeleteSelectedCard) {
                    Image(systemName: "trash")
                        .font(.system(size: 22, weight: .semibold))
                }
            }
            .foregroundStyle(Color.black)
            .padding(.horizontal, 38)
            .frame(height: 76)
        }
    }
}
