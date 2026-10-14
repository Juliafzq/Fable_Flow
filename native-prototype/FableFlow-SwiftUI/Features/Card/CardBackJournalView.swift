import SwiftUI

/// Matte Black Back of Card — Evening Reflection Journal (Mockup `05-card-back.png`).
/// Features 100% user-authored text with dynamic typography scaling (`21pt -> 13pt` floor)
/// and 0 to 2 framed photo slots at the bottom compressed client-side to `<= 1600px`.
public struct CardBackJournalView: View {
    public let headerDateText: String
    @Binding public var reflectionText: String
    @Binding public var photoPayloads: [Data]
    public let onAttachPhotoRequested: () -> Void
    public let onRemovePhotoAtIndex: (Int) -> Void

    public init(
        headerDateText: String,
        reflectionText: Binding<String>,
        photoPayloads: Binding<[Data]>,
        onAttachPhotoRequested: @escaping () -> Void,
        onRemovePhotoAtIndex: @escaping (Int) -> Void
    ) {
        self.headerDateText = headerDateText
        self._reflectionText = reflectionText
        self._photoPayloads = photoPayloads
        self.onAttachPhotoRequested = onAttachPhotoRequested
        self.onRemovePhotoAtIndex = onRemovePhotoAtIndex
    }

    /// Computes dynamic font size between 21pt and a 13pt minimum floor.
    public static func dynamicFontSize(for characterCount: Int) -> CGFloat {
        if characterCount > 620 { return 13.0 }
        if characterCount > 480 { return 14.5 }
        if characterCount > 360 { return 16.5 }
        if characterCount > 275 { return 18.5 }
        return 21.0
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Top Date Header ('TUESDAY — OCT 06')
            Text(headerDateText)
                .font(.system(size: 25.5, weight: .heavy))
                .foregroundStyle(Color(white: 0.96))
                .padding(.horizontal, 26)
                .padding(.top, 26)
                .padding(.bottom, 18)

            Divider()
                .overlay(Color.white.opacity(0.18))

            VStack(alignment: .leading, spacing: 14) {
                let currentSize = Self.dynamicFontSize(for: reflectionText.count)

                TextEditor(text: $reflectionText)
                    .font(.system(size: currentSize, weight: .regular))
                    .foregroundStyle(Color(white: 0.96))
                    .scrollContentBackground(.hidden)
                    .background(Color.clear)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                // 0 to 2 Framed Photo Slots at Bottom
                HStack(spacing: 10) {
                    ForEach(Array(photoPayloads.prefix(2).enumerated()), id: \.offset) { idx, _ in
                        ZStack(alignment: .topTrailing) {
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(Color.white.opacity(0.08))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .strokeBorder(Color.white.opacity(0.16), lineWidth: 1)
                                )

                            Button(action: { onRemovePhotoAtIndex(idx) }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.white)
                                    .padding(6)
                            }
                        }
                        .frame(height: 196)
                    }

                    if photoPayloads.count < 2 {
                        Button(action: onAttachPhotoRequested) {
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .strokeBorder(Color.white.opacity(0.18), lineWidth: 1)
                                .background(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(Color.white.opacity(0.05))
                                )
                                .overlay(
                                    Text(photoPayloads.isEmpty ? "+ Attach Photo (up to 2)" : "+ Add 2nd Photo")
                                        .font(.system(size: 13.5, weight: .medium))
                                        .foregroundStyle(Color.white.opacity(0.65))
                                )
                        }
                        .frame(height: photoPayloads.isEmpty ? 54 : 196)
                    }
                }
            }
            .padding(22)
        }
        .background(Color(red: 0.027, green: 0.027, blue: 0.027))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
