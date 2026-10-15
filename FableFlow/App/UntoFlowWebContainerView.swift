import SwiftUI
import WebKit
import UserNotifications
import UIKit
import WidgetKit

/// Full-screen native iOS wrapper for UNTO / FLOW.
/// Bridges the web app's tomato timers directly to iOS `UNUserNotificationCenter`
/// so timer completion chimes ring reliably on the Lock Screen and in the background
/// with zero background battery drain and zero interference with Apple Music / Spotify.
struct UntoFlowWebContainerView: UIViewRepresentable {
    /// Live GitHub Pages URL so UI updates ship automatically without re-building in Xcode.
    static let liveAppURL = URL(string: "https://juliafzq.github.io/UNTO_FLOW/?native_ios=1")!
    static let appHost = "juliafzq.github.io"

    /// The single live coordinator (one window), used to forward widget deep links into the page.
    private static weak var activeCoordinator: Coordinator?

    func makeCoordinator() -> Coordinator {
        let coordinator = Coordinator()
        Self.activeCoordinator = coordinator
        return coordinator
    }

    /// `untoflow://timer` (from the widget) opens the hero tomato page on a free tomato.
    static func handleDeepLink(_ url: URL) {
        guard url.scheme == "untoflow" else { return }
        if url.host == "timer" {
            activeCoordinator?.runWhenLoaded(Coordinator.openTimerJS)
        }
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
        contentController.addUserScript(WKUserScript(
            source: Coordinator.widgetSyncHookJS,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))
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
        private var pageLoaded = false
        private var pendingScripts: [String] = []
        private var askedForNotifications = false

        /// Same as tapping the tomato on the app's home page (skipped during the first-time tour).
        static let openTimerJS = """
        (function () {
          var a = window.fableFlowApp;
          if (!a || !a.state.hasCompletedOnboarding) return false;
          var free = a.state.timers.find(function (t) { return !t.assignedTaskId && !t.customTitle && t.runState === 'idle' && t.remainingSeconds === 0; })
            || a.state.timers.find(function (t) { return !t.assignedTaskId && !t.customTitle; });
          if (free) a.state.selectedQuadrant = free.quadrant;
          a.state.activePillar = 'timer';
          a.state.timerSubMode = 'hero';
          a.saveState();
          a.renderAll();
          return true;
        })();
        """

        // MARK: Widget sync (today's tasks <-> medium widget)

        /// Sends today's tasks to the widget whenever the web app saves, without changing the web code:
        /// it wraps `fableFlowApp.saveState` once the app object exists.
        static let widgetSyncHookJS = """
        (function () {
          function send() {
            var a = window.fableFlowApp;
            if (!a || !a.state || !Array.isArray(a.state.tasks)) return;
            try {
              var tasks = a.state.tasks.slice()
                .sort(function (x, y) { return (x.orderIndex || 0) - (y.orderIndex || 0); })
                .map(function (t) {
                  var title = String(t.title || '');
                  if (typeof a.displayTaskTitle === 'function') title = String(a.displayTaskTitle(title));
                  return { id: String(t.id), title: title, isCompleted: !!t.isCompleted };
                })
                .filter(function (t) { return t.title.trim().length > 0; });
              window.webkit.messageHandlers.untoNative.postMessage({ action: 'widgetSync', tasks: tasks });
            } catch (e) {}
          }
          var timer = null;
          function sendSoon() {
            clearTimeout(timer);
            timer = setTimeout(send, 400);
          }
          function hook() {
            var a = window.fableFlowApp;
            if (!a || !a.state || typeof a.saveState !== 'function') { setTimeout(hook, 300); return; }
            if (a.__untoWidgetHooked) return;
            a.__untoWidgetHooked = true;
            var original = a.saveState;
            a.saveState = function () {
              var result = original.apply(this, arguments);
              sendSoon();
              return result;
            };
            document.addEventListener('visibilitychange', send);
            send();
          }
          hook();
        })();
        """

        private var lastSyncedTasks: [WidgetCardTask]?
        private var isObservingWidgetEdits = false

        /// Listens for cross-outs made in the widget (and for the app coming back to the front).
        func startObservingWidgetEdits() {
            guard !isObservingWidgetEdits else { return }
            isObservingWidgetEdits = true
            CFNotificationCenterAddObserver(
                CFNotificationCenterGetDarwinNotifyCenter(),
                Unmanaged.passUnretained(self).toOpaque(),
                { _, observer, _, _, _ in
                    guard let observer = observer else { return }
                    let coordinator = Unmanaged<Coordinator>.fromOpaque(observer).takeUnretainedValue()
                    DispatchQueue.main.async { coordinator.applyWidgetEdits() }
                },
                WidgetSharedStore.didEditNotification as CFString,
                nil,
                .deliverImmediately
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(appDidBecomeActive),
                name: UIApplication.didBecomeActiveNotification,
                object: nil
            )
        }

        deinit {
            CFNotificationCenterRemoveEveryObserver(
                CFNotificationCenterGetDarwinNotifyCenter(),
                Unmanaged.passUnretained(self).toOpaque()
            )
            NotificationCenter.default.removeObserver(self)
        }

        @objc private func appDidBecomeActive() {
            applyWidgetEdits()
        }

        /// Copies cross-outs made in the widget onto today's card in the web app.
        func applyWidgetEdits() {
            guard pageLoaded, let webView = webView else { return }
            let edits = WidgetSharedStore.pendingEdits()
            guard !edits.isEmpty,
                  let data = try? JSONSerialization.data(withJSONObject: edits),
                  let json = String(data: data, encoding: .utf8) else { return }
            let script = """
            (function (edits) {
              var a = window.fableFlowApp;
              if (!a || !a.state || !Array.isArray(a.state.tasks)) return false;
              var changed = false;
              a.state.tasks.forEach(function (t) {
                var key = String(t.id);
                if (Object.prototype.hasOwnProperty.call(edits, key) && !!t.isCompleted !== edits[key]) {
                  t.isCompleted = edits[key];
                  changed = true;
                }
              });
              if (changed) { a.saveState(); a.renderAll(); }
              return true;
            })(\(json));
            """
            webView.evaluateJavaScript(script) { result, _ in
                if (result as? Bool) == true {
                    WidgetSharedStore.clearPendingEdits(edits)
                }
            }
        }

        private func handleWidgetSync(_ body: [String: Any]) {
            guard let rawTasks = body["tasks"] as? [[String: Any]] else { return }
            let tasks = rawTasks.compactMap { raw -> WidgetCardTask? in
                guard let id = raw["id"] as? String, let title = raw["title"] as? String else { return nil }
                return WidgetCardTask(id: id, title: title, isCompleted: (raw["isCompleted"] as? Bool) ?? false)
            }
            guard tasks != lastSyncedTasks else { return }
            lastSyncedTasks = tasks
            WidgetSharedStore.updateFromApp(tasks: tasks)
            WidgetCenter.shared.reloadAllTimelines()
        }

        func runWhenLoaded(_ script: String) {
            if pageLoaded, let webView = webView {
                webView.evaluateJavaScript(script, completionHandler: nil)
            } else {
                pendingScripts.append(script)
            }
        }

        // MARK: WKNavigationDelegate

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            pageLoaded = true
            let scripts = pendingScripts
            pendingScripts.removeAll()
            for script in scripts {
                webView.evaluateJavaScript(script, completionHandler: nil)
            }
            // Ask for notification permission once, up front, so the 00:00 alert can ring when the app is closed
            if !askedForNotifications {
                askedForNotifications = true
                requestNotificationPermission()
            }
            startObservingWidgetEdits()
            applyWidgetEdits()
        }

        /// Links to other websites (and target=_blank links) open in Safari instead of inside the app.
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            let isWeb = url.scheme == "http" || url.scheme == "https"
            let isOwnSite = url.host == UntoFlowWebContainerView.appHost
            let opensNewWindow = navigationAction.targetFrame == nil
            if isWeb && (!isOwnSite || opensNewWindow) && navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
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
            // Time-sensitive delivery comes from each alert's `interruptionLevel`; the old
            // `.timeSensitive` permission option is deprecated (and flagged on Mac Catalyst).
            center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
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

            case "widgetSync":
                handleWidgetSync(body)

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
