import SwiftUI

/// High-precision Canvas overlay on each task row that tracks the user's finger from Left to Right (`Δx > +15 px`)
/// to draw a dynamic, textured graphite pencil line—or erase an existing strikethrough cleanly on a second Left -> Right drag.
public struct PencilStrikethroughCanvas: View {
    public let isCompleted: Bool
    public let savedPoints: [CGPoint]
    public let sensoryEngine: SensoryServiceProtocol
    public let onCommitLeftToRightStroke: ([CGPoint]) -> Void
    public let onDetectRightToLeftCardFlip: () -> Void

    @State private var activeTracePoints: [CGPoint] = []
    @State private var isTracingLeftToRight: Bool = false
    @State private var lastDragTimestamp: Date = .now

    public init(
        isCompleted: Bool,
        savedPoints: [CGPoint],
        sensoryEngine: SensoryServiceProtocol,
        onCommitLeftToRightStroke: @escaping ([CGPoint]) -> Void,
        onDetectRightToLeftCardFlip: @escaping () -> Void = {}
    ) {
        self.isCompleted = isCompleted
        self.savedPoints = savedPoints
        self.sensoryEngine = sensoryEngine
        self.onCommitLeftToRightStroke = onCommitLeftToRightStroke
        self.onDetectRightToLeftCardFlip = onDetectRightToLeftCardFlip
    }

    public var body: some View {
        GeometryReader { proxy in
            let rowBounds = CGRect(origin: .zero, size: proxy.size)
            Canvas { context, size in
                let pointsToDraw: [CGPoint]
                if isTracingLeftToRight && !isCompleted {
                    pointsToDraw = activeTracePoints
                } else if isCompleted {
                    if isTracingLeftToRight {
                        // Erase preview: clip out the portion the user has wiped Left -> Right
                        let eraseX = activeTracePoints.last?.x ?? 0
                        pointsToDraw = resolvedSavedPoints(in: size).filter { $0.x > eraseX }
                    } else {
                        pointsToDraw = resolvedSavedPoints(in: size)
                    }
                } else {
                    pointsToDraw = []
                }

                guard pointsToDraw.count >= 2 else { return }

                // Multi-fiber textured graphite pencil stroke (Mockup p. 13 Top: "02 Build Deck")
                var mainPath = Path()
                mainPath.move(to: pointsToDraw[0])
                for pt in pointsToDraw.dropFirst() {
                    mainPath.addLine(to: pt)
                }

                context.stroke(
                    mainPath,
                    with: .color(Color(red: 0.16, green: 0.16, blue: 0.15).opacity(0.84)),
                    style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round)
                )

                var grainPath = Path()
                grainPath.move(to: CGPoint(x: pointsToDraw[0].x, y: pointsToDraw[0].y + 0.8))
                for pt in pointsToDraw.dropFirst() {
                    grainPath.addLine(to: CGPoint(x: pt.x, y: pt.y - 0.6))
                }
                context.stroke(
                    grainPath,
                    with: .color(Color(red: 0.28, green: 0.28, blue: 0.26).opacity(0.42)),
                    style: StrokeStyle(lineWidth: 1.1, lineCap: .round, dash: [4, 1.5])
                )
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 8)
                    .onChanged { value in
                        let classification = CardGestureMath.classifyGesture(
                            startPoint: value.startLocation,
                            currentPoint: value.location,
                            inRowBounds: rowBounds
                        )
                        if classification == .leftToRightPencilStroke || isTracingLeftToRight {
                            if !isTracingLeftToRight {
                                isTracingLeftToRight = true
                                activeTracePoints = [value.startLocation]
                                lastDragTimestamp = .now
                                sensoryEngine.beginPencilContact()
                            }
                            if let lastPoint = activeTracePoints.last, value.location.x >= lastPoint.x {
                                activeTracePoints.append(value.location)
                            }
                            let now = Date.now
                            let dt = max(0.008, now.timeIntervalSince(lastDragTimestamp))
                            let velocity = abs(value.translation.width) / CGFloat(dt)
                            let progress = min(max(value.location.x / max(proxy.size.width, 1), 0), 1)
                            lastDragTimestamp = now
                            sensoryEngine.updatePencilScratch(
                                velocityPointsPerSecond: velocity,
                                progress: progress
                            )
                        }
                    }
                    .onEnded { value in
                        if isTracingLeftToRight {
                            sensoryEngine.endPencilContact()
                            let distanceX = value.location.x - value.startLocation.x
                            if distanceX >= max(CardGestureMath.minimumPencilStrokeDeltaXPixels, proxy.size.width * 0.25) {
                                onCommitLeftToRightStroke(activeTracePoints)
                            }
                            isTracingLeftToRight = false
                            activeTracePoints = []
                        } else if CardGestureMath.isRightToLeftCardFlip(
                            startPoint: value.startLocation,
                            currentPoint: value.location
                        ) {
                            onDetectRightToLeftCardFlip()
                        }
                    }
            )
        }
    }

    private func resolvedSavedPoints(in size: CGSize) -> [CGPoint] {
        if savedPoints.count >= 2 {
            return savedPoints
        }
        let midY = size.height * 0.52
        return [
            CGPoint(x: 0, y: midY + 1.0),
            CGPoint(x: size.width * 0.45, y: midY - 0.5),
            CGPoint(x: size.width * 0.88, y: midY + 0.5)
        ]
    }
}
