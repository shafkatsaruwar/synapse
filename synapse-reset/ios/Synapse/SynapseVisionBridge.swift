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

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.minimumTextHeight = 0.01

        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        try handler.perform([request])

        let lines = (request.results ?? [])
          .compactMap { $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines) }
          .filter { !$0.isEmpty }

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

    return (request.results ?? [])
      .compactMap { $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }
}
