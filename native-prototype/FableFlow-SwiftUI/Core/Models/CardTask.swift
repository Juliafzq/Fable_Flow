import Foundation
import CoreGraphics
import SwiftData

@Model
public final class CardTask {
    public var id: UUID = UUID()
    public var slotIndex: Int = 1 // 1...6
    public var title: String = ""
    public var isCompleted: Bool = false
    public var strikethroughPointsData: Data? = nil
    public var assignedQuadrantIndex: Int? = nil
    public var createdAt: Date = Date.now

    public var card: DailyCard?

    public init(
        id: UUID = UUID(),
        slotIndex: Int,
        title: String,
        isCompleted: Bool = false,
        strikethroughPoints: [CGPoint] = [],
        assignedQuadrantIndex: Int? = nil
    ) {
        self.id = id
        self.slotIndex = min(max(slotIndex, 1), DailyCard.maxTasksPerCard)
        self.title = title
        self.isCompleted = isCompleted
        self.assignedQuadrantIndex = assignedQuadrantIndex
        self.createdAt = .now
        if !strikethroughPoints.isEmpty {
            self.strikethroughPointsData = Self.encodePoints(strikethroughPoints)
        }
    }

    public var formattedSlotNumber: String {
        String(format: "%02d", slotIndex)
    }

    public var strikethroughPoints: [CGPoint] {
        get {
            guard let data = strikethroughPointsData else { return [] }
            return Self.decodePoints(data)
        }
        set {
            strikethroughPointsData = newValue.isEmpty ? nil : Self.encodePoints(newValue)
        }
    }

    public static func encodePoints(_ points: [CGPoint]) -> Data? {
        let pairs = points.map { [Double($0.x), Double($0.y)] }
        return try? JSONEncoder().encode(pairs)
    }

    public static func decodePoints(_ data: Data) -> [CGPoint] {
        guard let pairs = try? JSONDecoder().decode([[Double]].self, from: data) else { return [] }
        return pairs.compactMap { pair in
            guard pair.count == 2 else { return nil }
            return CGPoint(x: pair[0], y: pair[1])
        }
    }
}
