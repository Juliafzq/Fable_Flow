import Foundation
import SwiftData

@Model
public final class DailyCard {
    public static let maxTasksPerCard: Int = 6
    public static let maxPhotosPerCard: Int = 2

    public var id: UUID = UUID()
    public var logicalDateString: String = ""
    public var headerDisplayStamp: String = ""
    public var miniDisplayStamp: String = ""
    public var createdAt: Date = Date.now
    public var updatedAt: Date = Date.now
    public var reflectionText: String = ""

    @Relationship(deleteRule: .cascade, inverse: \CardTask.card)
    public var tasks: [CardTask]? = []

    @Relationship(deleteRule: .cascade, inverse: \JournalPhoto.card)
    public var photos: [JournalPhoto]? = []

    public init(
        id: UUID = UUID(),
        logicalDateString: String,
        headerDisplayStamp: String,
        miniDisplayStamp: String,
        createdAt: Date = .now,
        reflectionText: String = ""
    ) {
        self.id = id
        self.logicalDateString = logicalDateString
        self.headerDisplayStamp = headerDisplayStamp
        self.miniDisplayStamp = miniDisplayStamp
        self.createdAt = createdAt
        self.updatedAt = createdAt
        self.reflectionText = reflectionText
    }

    public var sortedTasks: [CardTask] {
        (tasks ?? []).sorted { $0.slotIndex < $1.slotIndex }
    }

    public var sortedPhotos: [JournalPhoto] {
        (photos ?? []).sorted { $0.slotIndex < $1.slotIndex }
    }

    public var canAddTask: Bool {
        (tasks ?? []).count < Self.maxTasksPerCard
    }
}
