import Foundation
import SwiftData

@Model
public final class JournalPhoto {
    public var id: UUID = UUID()
    public var slotIndex: Int = 0 // 0 or 1 (max 2 photos per card)
    @Attribute(.externalStorage) public var heicData: Data? = nil
    public var pixelWidth: Int = 0
    public var pixelHeight: Int = 0
    public var createdAt: Date = Date.now

    public var card: DailyCard?

    public init(
        id: UUID = UUID(),
        slotIndex: Int,
        heicData: Data,
        pixelWidth: Int,
        pixelHeight: Int,
        createdAt: Date = .now
    ) {
        self.id = id
        self.slotIndex = min(max(slotIndex, 0), 1)
        self.heicData = heicData
        self.pixelWidth = pixelWidth
        self.pixelHeight = pixelHeight
        self.createdAt = createdAt
    }
}
