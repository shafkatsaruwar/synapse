import Foundation
import ImageIO
import PDFKit
import UIKit
import Vision

@objc(SynapseVisionBridge)
final class SynapseVisionBridge: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(recognizeText:resolver:rejecter:)
  func recognizeText(
    _ imageUri: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let path = imageUri.replacingOccurrences(of: "file://", with: "")
        let url = URL(fileURLWithPath: path)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
        else {
          reject("vision_image_unreadable", "Could not read this image.", nil)
          return
        }

        let lines = try Self.recognizeLines(in: image)
        resolve(lines.joined(separator: "\n"))
      } catch {
        reject("vision_text_failed", error.localizedDescription, error)
      }
    }
  }

  @objc(recognizePDFText:resolver:rejecter:)
  func recognizePDFText(
    _ pdfUri: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let path = pdfUri.replacingOccurrences(of: "file://", with: "")
        let url = URL(fileURLWithPath: path)
        guard let document = PDFDocument(url: url), document.pageCount > 0 else {
          reject("vision_pdf_unreadable", "Could not read this PDF.", nil)
          return
        }

        var allLines: [String] = []
        let pageLimit = min(document.pageCount, 12)
        for pageIndex in 0..<pageLimit {
          guard let page = document.page(at: pageIndex) else { continue }

          // Prefer embedded text when the page already has a usable text layer.
          // Fall back to Vision OCR for scanned / image-only pages.
          let embedded = (page.string ?? "")
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

          let embeddedCharCount = embedded.joined(separator: " ").count
          if embeddedCharCount >= 40 {
            allLines.append(contentsOf: embedded)
            continue
          }

          let bounds = page.bounds(for: .mediaBox)
          let scale: CGFloat = 2.0
          let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)

          let renderer = UIGraphicsImageRenderer(size: size)
          let image = renderer.image { context in
            UIColor.white.set()
            context.fill(CGRect(origin: .zero, size: size))
            context.cgContext.saveGState()
            context.cgContext.translateBy(x: 0, y: size.height)
            context.cgContext.scaleBy(x: scale, y: -scale)
            page.draw(with: .mediaBox, to: context.cgContext)
            context.cgContext.restoreGState()
          }

          guard let cgImage = image.cgImage else { continue }
          allLines.append(contentsOf: try Self.recognizeLines(in: cgImage))
        }

        if allLines.isEmpty {
          reject("vision_pdf_empty", "No readable text was found in this PDF.", nil)
          return
        }

        resolve(allLines.joined(separator: "\n"))
      } catch {
        reject("vision_pdf_text_failed", error.localizedDescription, error)
      }
    }
  }

  private static func recognizeLines(in image: CGImage) throws -> [String] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.minimumTextHeight = 0.01

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    // Sort top→bottom, then left→right so multi-column OCR is more stable.
    let observations = (request.results ?? []).sorted { lhs, rhs in
      let ly = lhs.boundingBox.origin.y
      let ry = rhs.boundingBox.origin.y
      if abs(ly - ry) > 0.02 {
        return ly > ry
      }
      return lhs.boundingBox.origin.x < rhs.boundingBox.origin.x
    }

    return observations
      .compactMap { $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }
}
