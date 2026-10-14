import SwiftUI
import SceneKit

/// Unified 3D Heirloom Tomato renderer with adaptive frame-rate throttling (PRD §11):
/// - `0 fps` (static snapshot) when paused or idle
/// - `15 fps` during slow real-time countdown/stopwatch rotation
/// - `60–120 fps` (ProMotion) during active horizontal finger twisting
public struct Tomato3DSceneView: View {
    public let quadrantIndex: Int
    public let isAssigned: Bool
    public let cumulativeAngleDegrees: Double
    public let isActivelyDragging: Bool
    public let isTicking: Bool
    public let showEquatorialOdometerNumbers: Bool
    public let overlayTitle: String?
    public let overlayReadout: String?

    public init(
        quadrantIndex: Int,
        isAssigned: Bool,
        cumulativeAngleDegrees: Double,
        isActivelyDragging: Bool = false,
        isTicking: Bool = false,
        showEquatorialOdometerNumbers: Bool = true,
        overlayTitle: String? = nil,
        overlayReadout: String? = nil
    ) {
        self.quadrantIndex = quadrantIndex
        self.isAssigned = isAssigned
        self.cumulativeAngleDegrees = cumulativeAngleDegrees
        self.isActivelyDragging = isActivelyDragging
        self.isTicking = isTicking
        self.showEquatorialOdometerNumbers = showEquatorialOdometerNumbers
        self.overlayTitle = overlayTitle
        self.overlayReadout = overlayReadout
    }

    /// Adaptive frame rate per PRD §11 battery optimization.
    public var preferredFramesPerSecond: Int {
        if isActivelyDragging {
            return 120
        } else if isTicking {
            return 15
        } else {
            return 0
        }
    }

    /// Visible odometer numbers rolling into view around the center pointer (e.g. `[130, 140, 150, 160, 170]` on Turn 3).
    public var visibleEquatorialNumbers: [Int] {
        OdometerDialPhysics.visibleEquatorialLabels(forCumulativeAngleDegrees: cumulativeAngleDegrees)
    }

    public var body: some View {
        ZStack {
            // Soft directional contact shadow on the #EAE8E1 desk surface (Mockups p. 11 & p. 12)
            Ellipse()
                .fill(
                    RadialGradient(
                        colors: [.black.opacity(0.26), .black.opacity(0.08), .clear],
                        center: .center,
                        startRadius: 10,
                        endRadius: 120
                    )
                )
                .frame(width: 210, height: 74)
                .offset(x: 18, y: 86)

            // 3D Sculpted Heirloom Tomato Sphere + Equatorial Seam & Calyx
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                ThemeTokens.heirloomColor(forQuadrant: quadrantIndex, isAssigned: isAssigned).opacity(0.92),
                                ThemeTokens.heirloomColor(forQuadrant: quadrantIndex, isAssigned: isAssigned),
                                .black.opacity(0.42)
                            ],
                            center: UnitPoint(x: 0.35, y: 0.28),
                            startRadius: 8,
                            endRadius: 150
                        )
                    )
                    .scaleEffect(x: 1.08, y: 0.92)

                if showEquatorialOdometerNumbers {
                    equatorialOdometerBand
                }

                if let overlayTitle {
                    VStack(spacing: 4) {
                        Text(overlayTitle)
                            .font(.system(size: isAssigned ? 13 : 16, weight: .semibold))
                            .tracking(isAssigned ? 0.6 : 0.1)
                            .foregroundStyle(.white.opacity(isAssigned ? 0.92 : 0.78))
                        if let overlayReadout, isAssigned {
                            Text(overlayReadout)
                                .font(.system(size: 26, weight: .medium))
                                .monospacedDigit()
                                .foregroundStyle(.white)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(isAssigned ? "Heirloom Tomato Timer \(quadrantIndex + 1)" : "Unassigned Tomato Timer \(quadrantIndex + 1)")
    }

    private var equatorialOdometerBand: some View {
        let labels = visibleEquatorialNumbers
        return VStack(spacing: 4) {
            HStack(spacing: 22) {
                ForEach(labels, id: \.self) { minuteValue in
                    VStack(spacing: 3) {
                        Text("\(minuteValue)")
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.84))
                        Rectangle()
                            .fill(.white.opacity(0.82))
                            .frame(width: 1.5, height: 10)
                    }
                }
            }
            Rectangle()
                .fill(.black.opacity(0.45))
                .frame(height: 2)
            Image(systemName: "triangle.fill")
                .font(.system(size: 9))
                .foregroundStyle(.white.opacity(0.88))
                .padding(.top, 2)
        }
        .offset(y: 12)
    }
}
