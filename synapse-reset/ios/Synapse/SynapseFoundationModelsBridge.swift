import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

@objc(SynapseFoundationModelsBridge)
final class SynapseFoundationModelsBridge: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(isAvailable:rejecter:)
  func isAvailable(
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      switch SystemLanguageModel.default.availability {
      case .available:
        resolve(true)
      default:
        resolve(false)
      }
    } else {
      resolve(false)
    }
    #else
    resolve(false)
    #endif
  }

  @objc(generate:payloadJson:resolver:rejecter:)
  func generate(
    _ task: String,
    payloadJson: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      Task {
        do {
          let output = try await generateOnDevice(task: task, payloadJson: payloadJson)
          resolve(output)
        } catch {
          reject("foundation_models_failed", error.localizedDescription, error)
        }
      }
    } else {
      reject("foundation_models_unavailable", "Apple Foundation Models require iOS 26 or later with Apple Intelligence enabled.", nil)
    }
    #else
    reject("foundation_models_unavailable", "Apple Foundation Models are not available in this build.", nil)
    #endif
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private func generateOnDevice(task: String, payloadJson: String) async throws -> String {
    guard case .available = SystemLanguageModel.default.availability else {
      throw NSError(
        domain: "SynapseFoundationModels",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "On-device Apple Intelligence is not available on this device."]
      )
    }

    let session = LanguageModelSession(instructions: instructions(for: task))
    let response = try await session.respond(to: prompt(for: task, payloadJson: payloadJson))
    return String(describing: response.content)
  }
  #endif

  private func instructions(for task: String) -> String {
    switch task {
    case "appointment_explainer":
      return """
      You help explain health appointments in simple language.
      Return only valid JSON with keys: explanation, likelyPurpose, bringOrExpect.
      explanation must be 2 to 3 short sentences.
      likelyPurpose must avoid diagnosis and only use provided context.
      bringOrExpect must be an array of short practical items.
      Do not add medical advice, diagnosis, or unsupported speculation.
      """
    case "doctor_notes_summary":
      return """
      You summarize user-provided doctor notes.
      Return only valid JSON with keys: keyFindings, nextSteps, medicationsMentioned, followUps.
      Each value must be an array of short bullet strings.
      Do not diagnose. Do not invent details.
      """
    case "health_summary":
      return """
      You summarize structured health logs into a short trend summary.
      Return only valid JSON with keys: summary, trends, adherence, notablePatterns.
      summary and adherence must be short strings.
      trends and notablePatterns must be arrays of short strings.
      Do not diagnose. Do not invent details. Use only provided data.
      """
    default:
      return """
      Return only valid JSON. Use only the provided data. Do not diagnose or invent details.
      """
    }
  }

  private func prompt(for task: String, payloadJson: String) -> String {
    """
    Task: \(task)
    Data JSON:
    \(payloadJson)
    """
  }
}
