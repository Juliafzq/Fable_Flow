import Foundation
import Security

/// One task from the front of today's card, as shown in the medium widget.
struct WidgetCardTask: Codable, Hashable, Identifiable {
    var id: String
    var title: String
    var isCompleted: Bool
}

/// Today's card as seen by the widget.
/// `pendingEdits` holds cross-outs made in the widget that the app hasn't applied yet
/// (task id -> crossed out or not).
struct WidgetCardSnapshot: Codable, Equatable {
    var tasks: [WidgetCardTask] = []
    var pendingEdits: [String: Bool] = [:]
    var updatedAt: Date = Date()
}

/// Shares today's card between the app and the widget.
///
/// A free Apple ID ("Personal Team") can't sign App Groups, the usual way an app and its widget share
/// data, so this uses a shared Keychain item instead (both targets list the same
/// `keychain-access-groups` entry in their .entitlements files, so the item lands in that shared group).
/// If the Keychain isn't available, it falls back to this process's own storage: the widget timer
/// still works, but the to-do list won't update from the app.
enum WidgetSharedStore {
    /// Posted (system-wide, no data attached) when the widget crosses out a task,
    /// so an open app can apply it straight away.
    static let didEditNotification = "com.untoflow.widget.didEditCard"

    private static let service = "com.untoflow.shared"
    private static let account = "todays-card.v1"
    private static let fallbackKey = "untoflow.todaysCard.v1"

    // MARK: Reading & writing

    static func loadCard() -> WidgetCardSnapshot? {
        guard let data = readData() else { return nil }
        return try? JSONDecoder().decode(WidgetCardSnapshot.self, from: data)
    }

    static func saveCard(_ card: WidgetCardSnapshot) {
        guard let data = try? JSONEncoder().encode(card) else { return }
        writeData(data)
    }

    // MARK: App side

    /// The app sends today's tasks. Cross-outs made in the widget that the app hasn't applied yet win.
    static func updateFromApp(tasks: [WidgetCardTask]) {
        var card = loadCard() ?? WidgetCardSnapshot()
        let validIDs = Set(tasks.map { $0.id })
        card.pendingEdits = card.pendingEdits.filter { validIDs.contains($0.key) }
        card.tasks = tasks.map { task in
            var task = task
            if let pending = card.pendingEdits[task.id] {
                task.isCompleted = pending
            }
            return task
        }
        card.updatedAt = Date()
        saveCard(card)
    }

    static func pendingEdits() -> [String: Bool] {
        loadCard()?.pendingEdits ?? [:]
    }

    /// Forget widget edits the app has now applied (unless the widget changed them again meanwhile).
    static func clearPendingEdits(_ applied: [String: Bool]) {
        guard var card = loadCard() else { return }
        for (id, value) in applied where card.pendingEdits[id] == value {
            card.pendingEdits.removeValue(forKey: id)
        }
        saveCard(card)
    }

    // MARK: Widget side

    /// Crosses a task out (or back in) from the widget and lets the app know.
    static func toggleFromWidget(taskID: String) {
        guard var card = loadCard(),
              let index = card.tasks.firstIndex(where: { $0.id == taskID }) else { return }
        card.tasks[index].isCompleted.toggle()
        card.pendingEdits[taskID] = card.tasks[index].isCompleted
        card.updatedAt = Date()
        saveCard(card)
        postDidEdit()
    }

    static func postDidEdit() {
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(didEditNotification as CFString),
            nil,
            nil,
            true
        )
    }

    // MARK: Keychain storage

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecUseDataProtectionKeychain as String: true,
        ]
    }

    private static func readData() -> Data? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data {
            return data
        }
        return UserDefaults.standard.data(forKey: fallbackKey)
    }

    private static func writeData(_ data: Data) {
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        var status = SecItemUpdate(baseQuery() as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var addQuery = baseQuery()
            addQuery.merge(attributes) { _, new in new }
            status = SecItemAdd(addQuery as CFDictionary, nil)
        }
        if status != errSecSuccess {
            UserDefaults.standard.set(data, forKey: fallbackKey)
        }
    }
}
