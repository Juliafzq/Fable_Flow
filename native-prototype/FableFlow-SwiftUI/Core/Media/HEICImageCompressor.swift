import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Enforces strict client-side image compression (`HEIC` format, max `1600px` dimension, max 2 images per card)
/// before persisting to SwiftData/CloudKit (PRD §11).
public enum HEICImageCompressor {
    public static let maxPixelDimension: Int = 1600
    public static let compressionQuality: Double = 0.78
    public static let heicUTTypeIdentifier: String = "public.heic"

    public struct CompressedPhotoResult: Sendable {
        public let heicData: Data
        public let pixelWidth: Int
        public let pixelHeight: Int
    }

    public static func compressToHEIC(
        sourceImageData: Data,
        maxDimension: Int = maxPixelDimension,
        quality: Double = compressionQuality
    ) -> CompressedPhotoResult? {
        let clampedMaxDimension = min(max(maxDimension, 100), 1600)
        let sourceOptions: [CFString: Any] = [kCGImageSourceShouldCache: false]
        guard let imageSource = CGImageSourceCreateWithData(sourceImageData as CFData, sourceOptions as CFDictionary) else {
            return nil
        }

        let thumbnailOptions: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: clampedMaxDimension
        ]

        guard let downsampledCGImage = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, thumbnailOptions as CFDictionary) else {
            return nil
        }

        let mutableData = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            mutableData,
            heicUTTypeIdentifier as CFString,
            1,
            nil
        ) else {
            return nil
        }

        let destinationProperties: [CFString: Any] = [
            kCGImageDestinationLossyCompressionQuality: quality
        ]
        CGImageDestinationAddImage(destination, downsampledCGImage, destinationProperties as CFDictionary)
        guard CGImageDestinationFinalize(destination) else {
            return nil
        }

        return CompressedPhotoResult(
            heicData: mutableData as Data,
            pixelWidth: downsampledCGImage.width,
            pixelHeight: downsampledCGImage.height
        )
    }
}
