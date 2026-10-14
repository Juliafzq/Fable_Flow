import XCTest
@testable import FableFlow

final class HEICImageCompressorTests: XCTestCase {
    func testMaxPixelDimensionConstantIsClampedAt1600() {
        XCTAssertEqual(HEICImageCompressor.maxPixelDimension, 1600)
        XCTAssertEqual(HEICImageCompressor.heicUTTypeIdentifier, "public.heic")
    }
}
