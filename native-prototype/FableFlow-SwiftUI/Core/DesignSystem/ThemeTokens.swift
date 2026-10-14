import SwiftUI

public enum ThemeTokens {
    // MARK: - Surface & Card Palette (Matched to Mockups p. 11–14)
    public static let deskCanvasHex = "#EAE8E1"
    public static let cardFrontWhiteHex = "#FAF9F5"
    public static let cardBackMatteBlackHex = "#141413"
    public static let inkPrimaryHex = "#111110"
    public static let inkMutedGrayHex = "#AEACA6"
    public static let crosshairDividerHex = "#A8A6A0"
    public static let dotGridHex = "#D6D4CC"

    // MARK: - Unassigned vs. 4 Distinct Heirloom Red Shades (Mockup p. 12)
    public static let unassignedTomatoGrayHex = "#8E8D8A"
    public static let quadrant1DeepCrimsonHex = "#8B1E24"
    public static let quadrant2WarmTerracottaHex = "#C84B31"
    public static let quadrant3RichBurgundyHex = "#5E192A"
    public static let quadrant4SunRipenedCoralHex = "#D96B52"

    public static let deskCanvas = Color(red: 0.918, green: 0.910, blue: 0.882)
    public static let cardFrontWhite = Color(red: 0.980, green: 0.976, blue: 0.961)
    public static let cardBackMatteBlack = Color(red: 0.078, green: 0.078, blue: 0.075)
    public static let inkPrimary = Color(red: 0.067, green: 0.067, blue: 0.063)
    public static let inkMutedGray = Color(red: 0.682, green: 0.675, blue: 0.651)
    public static let crosshairDivider = Color(red: 0.659, green: 0.651, blue: 0.627)
    public static let unassignedTomatoGray = Color(red: 0.557, green: 0.553, blue: 0.541)

    public static func heirloomColor(forQuadrant quadrant: Int, isAssigned: Bool) -> Color {
        guard isAssigned else { return unassignedTomatoGray }
        switch quadrant {
        case 0: return Color(red: 0.545, green: 0.118, blue: 0.141) // Deep Crimson Red
        case 1: return Color(red: 0.784, green: 0.294, blue: 0.192) // Warm Terracotta / Vermilion Red
        case 2: return Color(red: 0.369, green: 0.098, blue: 0.165) // Rich Dark Burgundy / Wine Red
        default: return Color(red: 0.851, green: 0.420, blue: 0.322) // Sun-Ripened Coral / Dusty Rose Red
        }
    }

    public static func heirloomRGB(forQuadrant quadrant: Int, isAssigned: Bool) -> SIMD3<Float> {
        guard isAssigned else { return SIMD3<Float>(0.557, 0.553, 0.541) }
        switch quadrant {
        case 0: return SIMD3<Float>(0.545, 0.118, 0.141)
        case 1: return SIMD3<Float>(0.784, 0.294, 0.192)
        case 2: return SIMD3<Float>(0.369, 0.098, 0.165)
        default: return SIMD3<Float>(0.851, 0.420, 0.322)
        }
    }
}
