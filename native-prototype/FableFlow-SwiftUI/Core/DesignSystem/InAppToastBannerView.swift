import SwiftUI
import Observation

@Observable
public final class ToastNotificationCenter {
    public struct ToastItem: Identifiable, Equatable {
        public let id = UUID()
        public let message: String
        public let timestamp: Date
    }

    public private(set) var activeToast: ToastItem?

    public init() {}

    public func show(_ message: String, autoDismissAfter seconds: TimeInterval = 3.0) {
        let item = ToastItem(message: message, timestamp: .now)
        activeToast = item
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(seconds))
            if self.activeToast?.id == item.id {
                self.activeToast = nil
            }
        }
    }

    public func dismiss() {
        activeToast = nil
    }
}

public struct InAppToastBannerView: View {
    let toastCenter: ToastNotificationCenter

    public init(toastCenter: ToastNotificationCenter) {
        self.toastCenter = toastCenter
    }

    public var body: some View {
        if let toast = toastCenter.activeToast {
            Text(toast.message)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(ThemeTokens.cardFrontWhite)
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(
                    Capsule()
                        .fill(ThemeTokens.cardBackMatteBlack.opacity(0.94))
                        .shadow(color: .black.opacity(0.15), radius: 10, y: 4)
                )
                .transition(.move(edge: .top).combined(with: .opacity))
                .accessibilityLabel(toast.message)
        }
    }
}
