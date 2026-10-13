import SwiftUI
import WebKit
import UserNotifications
import UIKit

/// Full-screen native iOS wrapper for UNTO / FLOW.
/// Bridges the web app's tomato timers directly to iOS `UNUserNotificationCenter`
/// so timer completion chimes ring reliably on the Lock Screen and in the background
/// with zero background battery drain and zero interference with Apple Music / Spotify.
struct UntoFlowWebContainerView: UIViewRepresentable {
    /// Live GitHub Pages URL so UI updates ship automatically without re-building in Xcode.
    static let liveAppURL = URL(string: "https://juliafzq.github.io/UNTO_FLOW/?native_ios=1")!

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.javaScriptCanOpenWindowsAutomatically = true

        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "untoNative")

        // Expose a flag at document start so js/app.js knows native iOS notifications & haptics are active.
        let bootstrapJS = """
        window.__UNTO_NATIVE_IOS__ = true;
        """
        let script = WKUserScript(
            source: bootstrapJS,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        contentController.addUserScript(script)
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        let studioBg = UIColor(red: 231.0 / 255.0, green: 232.0 / 255.0, blue: 226.0 / 255.0, alpha: 1.0)
        webView.isOpaque = false
        webView.backgroundColor = studioBg
        webView.scrollView.backgroundColor = studioBg
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator

        context.coordinator.webView = webView
        context.coordinator.configureNotifications()

        let request = URLRequest(
            url: Self.liveAppURL,
            cachePolicy: .reloadRevalidatingCacheData,
            timeoutInterval: 20
        )
        webView.load(request)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, UNUserNotificationCenterDelegate {
        weak var webView: WKWebView?
        private static let idPrefix = "com.untoflow.timer.slot."
        private let selectionHaptic = UISelectionFeedbackGenerator()
        private let lightHaptic = UIImpactFeedbackGenerator(style: .light)
        private let mediumHaptic = UIImpactFeedbackGenerator(style: .medium)
        private let noticeHaptic = UINotificationFeedbackGenerator()

        func configureNotifications() {
            let center = UNUserNotificationCenter.current()
            center.delegate = self
            selectionHaptic.prepare()
            lightHaptic.prepare()
            mediumHaptic.prepare()
            noticeHaptic.prepare()
        }

        func requestNotificationPermission() {
            let center = UNUserNotificationCenter.current()
            if #available(iOS 15.0, *) {
                center.requestAuthorization(options: [.alert, .sound, .timeSensitive]) { _, _ in }
            } else {
                center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "untoNative",
                  let body = message.body as? [String: Any],
                  let action = body["action"] as? String else {
                return
            }

            switch action {
            case "requestPermission":
                requestNotificationPermission()

            case "scheduleTimer":
                let slotIndex = (body["slotIndex"] as? Int) ?? 0
                let title = (body["title"] as? String) ?? "UNTO / FLOW"
                let messageText = (body["body"] as? String) ?? "Focus session complete."
                let delaySec: TimeInterval
                if let endsAtMs = body["endsAtMs"] as? Double {
                    let nowMs = Date().timeIntervalSince1970 * 1000.0
                    delaySec = max(1.0, (endsAtMs - nowMs) / 1000.0)
                } else if let sec = body["seconds"] as? Double {
                    delaySec = max(1.0, sec)
                } else {
                    return
                }
                scheduleLocalTimerNotification(
                    slotIndex: slotIndex,
                    title: title,
                    body: messageText,
                    delaySeconds: delaySec
                )

            case "cancelTimer":
                let slotIndex = (body["slotIndex"] as? Int) ?? 0
                cancelLocalTimerNotification(slotIndex: slotIndex)

            case "cancelAllTimers":
                cancelAllLocalTimerNotifications()

            case "haptic":
                let style = (body["style"] as? String) ?? "tick"
                triggerHaptic(style: style)

            default:
                break
            }
        }

        private func scheduleLocalTimerNotification(
            slotIndex: Int,
            title: String,
            body: String,
            delaySeconds: TimeInterval
        ) {
            requestNotificationPermission()

            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: "bell_alarm.wav"))
            content.badge = nil
            if #available(iOS 15.0, *) {
                content.interruptionLevel = .timeSensitive
            }

            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1.0, delaySeconds), repeats: false)
            let identifier = "\(Self.idPrefix)\(slotIndex)"
            let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

            let center = UNUserNotificationCenter.current()
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
            center.add(request, withCompletionHandler: nil)
        }

        private func cancelLocalTimerNotification(slotIndex: Int) {
            let identifier = "\(Self.idPrefix)\(slotIndex)"
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [identifier])
        }

        private func cancelAllLocalTimerNotifications() {
            let ids = (0..<8).map { "\(Self.idPrefix)\($0)" }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ids)
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ids)
        }

        private func triggerHaptic(style: String) {
            switch style {
            case "tick":
                selectionHaptic.selectionChanged()
                selectionHaptic.prepare()
            case "notch":
                lightHaptic.impactOccurred()
                lightHaptic.prepare()
            case "heavy":
                mediumHaptic.impactOccurred()
                mediumHaptic.prepare()
            case "complete":
                noticeHaptic.notificationOccurred(.success)
                noticeHaptic.prepare()
            default:
                selectionHaptic.selectionChanged()
            }
        }

        // When the app is already open in the foreground, WebAudio plays the chime directly,
        // so we show the banner without double-playing the notification audio file.
        func userNotificationCenter(
            _ center: UNUserNotificationCenter,
            willPresent notification: UNNotification,
            withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
        ) {
            if UIApplication.shared.applicationState == .active {
                completionHandler([.banner, .list])
            } else {
                completionHandler([.banner, .list, .sound])
            }
        }
    }
}
