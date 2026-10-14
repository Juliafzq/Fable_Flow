import Foundation
import CoreGraphics

/// Enforces the mandatory Pixel-Direction Math Rules (PRD §6.#3.B & §6.#3.C):
/// 1. Left -> Right (`Δx > +15 px`, angle within `±25°`) starting inside a task row's bounds
///    is strictly a Graphite Pencil Strikethrough / Erase gesture.
/// 2. Right -> Left (`Δx < -40 px`, angle within `±35°`) on the card body
///    is strictly a 3D 180° Card Flip gesture.
public enum CardGestureMath {
    public static let minimumPencilStrokeDeltaXPixels: CGFloat = 15.0
    public static let maximumPencilVerticalConeDegrees: CGFloat = 25.0
    public static let minimumCardFlipDeltaXPixels: CGFloat = -40.0
    public static let minimumPositiveCardFlipDeltaXPixels: CGFloat = 40.0
    public static let maximumCardFlipVerticalConeDegrees: CGFloat = 35.0
    public static let minimumCompletionCoverageRatio: CGFloat = 0.45

    public enum ClassifiedCardGesture: Equatable, Sendable {
        case none
        case leftToRightPencilStroke
        case rightToLeftCardFlip
    }

    /// Returns `true` strictly when a drag starts inside `rowBounds` and moves Left -> Right (`Δx > +15 px`)
    /// within the `±25°` horizontal cone.
    public static func isLeftToRightPencilStroke(
        startPoint: CGPoint,
        currentPoint: CGPoint,
        inRowBounds rowBounds: CGRect
    ) -> Bool {
        guard rowBounds.contains(startPoint) else { return false }
        let deltaX = currentPoint.x - startPoint.x
        let deltaY = abs(currentPoint.y - startPoint.y)
        guard deltaX > minimumPencilStrokeDeltaXPixels else { return false }
        let maxAllowedDeltaY = deltaX * tan(maximumPencilVerticalConeDegrees * .pi / 180.0)
        return deltaY <= maxAllowedDeltaY
    }

    /// Returns `true` strictly when a drag moves Right -> Left (`Δx < -40 px`) within the `±35°` horizontal cone.
    public static func isRightToLeftCardFlip(
        startPoint: CGPoint,
        currentPoint: CGPoint
    ) -> Bool {
        let deltaX = currentPoint.x - startPoint.x
        let deltaY = abs(currentPoint.y - startPoint.y)
        guard deltaX < minimumCardFlipDeltaXPixels else { return false }
        let maxAllowedDeltaY = abs(deltaX) * tan(maximumCardFlipVerticalConeDegrees * .pi / 180.0)
        return deltaY <= maxAllowedDeltaY
    }

    /// Returns `true` when a drag moves either Right -> Left (`Δx < -40 px`) or Left -> Right (`Δx > +40 px`, when outside a task row)
    /// within the `±35°` horizontal cone, allowing two-way card flipping.
    public static func isBidirectionalCardFlip(
        startPoint: CGPoint,
        currentPoint: CGPoint,
        isOnTaskRow: Bool = false
    ) -> Bool {
        let deltaX = currentPoint.x - startPoint.x
        let deltaY = abs(currentPoint.y - startPoint.y)
        let matchesDirection = deltaX < minimumCardFlipDeltaXPixels || (!isOnTaskRow && deltaX > abs(minimumCardFlipDeltaXPixels))
        guard matchesDirection else { return false }
        let maxAllowedDeltaY = abs(deltaX) * tan(maximumCardFlipVerticalConeDegrees * .pi / 180.0)
        return deltaY <= maxAllowedDeltaY
    }

    /// Mutually exclusive classifier so Left -> Right Pencil Strikethrough and Card Flip never collide.
    public static func classifyGesture(
        startPoint: CGPoint,
        currentPoint: CGPoint,
        inRowBounds rowBounds: CGRect? = nil
    ) -> ClassifiedCardGesture {
        let onRow = rowBounds.map { $0.contains(startPoint) } ?? false
        if let rowBounds, isLeftToRightPencilStroke(startPoint: startPoint, currentPoint: currentPoint, inRowBounds: rowBounds) {
            return .leftToRightPencilStroke
        }
        if isBidirectionalCardFlip(startPoint: startPoint, currentPoint: currentPoint, isOnTaskRow: onRow) {
            return .rightToLeftCardFlip
        }
        return .none
    }
}
