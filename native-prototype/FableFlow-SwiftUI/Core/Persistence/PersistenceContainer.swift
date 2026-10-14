import Foundation
import SwiftData

/// Manages the encrypted on-device SwiftData database with `FileProtectionType.completeUntilFirstUserAuthentication`
/// (PRD §11) and supports toggling opt-in CloudKit Private Database sync without losing local data.
public final class PersistenceContainer {
    public static let shared = PersistenceContainer(inMemory: false)
    public static let appGroupIdentifier = "group.com.fableflow.shared"
    public static let cloudKitContainerIdentifier = "iCloud.com.fableflow.app"

    public private(set) var container: ModelContainer
    public private(set) var isCloudKitSyncEnabled: Bool

    public var mainContext: ModelContext {
        container.mainContext
    }

    public init(inMemory: Bool = false, enableCloudKitSync: Bool = false) {
        self.isCloudKitSyncEnabled = enableCloudKitSync
        let schema = Schema([
            DailyCard.self,
            CardTask.self,
            JournalPhoto.self,
            TomatoTimerSlot.self
        ])

        let storeURL = Self.resolveStoreURL(inMemory: inMemory)
        let configuration: ModelConfiguration
        if inMemory {
            configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        } else {
            configuration = ModelConfiguration(
                schema: schema,
                url: storeURL,
                cloudKitDatabase: enableCloudKitSync ? .private(Self.cloudKitContainerIdentifier) : .none
            )
            Self.applyCompleteUntilFirstUserAuthenticationProtection(at: storeURL.deletingLastPathComponent())
        }

        do {
            self.container = try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("Failed to initialize Fable / Flow SwiftData ModelContainer: \(error)")
        }
    }

    public static func resolveStoreURL(inMemory: Bool) -> URL {
        if inMemory {
            return URL(fileURLWithPath: "/dev/null")
        }
        let baseDirectory = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!

        let vaultDirectory = baseDirectory.appendingPathComponent("FableFlowVault", isDirectory: true)
        try? FileManager.default.createDirectory(at: vaultDirectory, withIntermediateDirectories: true)
        return vaultDirectory.appendingPathComponent("FableFlow.store")
    }

    public static func applyCompleteUntilFirstUserAuthenticationProtection(at directoryURL: URL) {
        try? FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: directoryURL.path
        )
    }
}
