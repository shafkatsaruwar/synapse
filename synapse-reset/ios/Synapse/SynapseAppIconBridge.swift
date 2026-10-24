import UIKit

@objc(SynapseAppIconBridge)
final class SynapseAppIconBridge: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  /// Resolves with the active alternate icon name, or null when the default icon is showing.
  @objc(getIconName:rejecter:)
  func getIconName(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(UIApplication.shared.alternateIconName)
    }
  }

  /// Pass null/empty to go back to the default icon.
  @objc(setIconName:resolver:rejecter:)
  func setIconName(
    _ name: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let app = UIApplication.shared
      guard app.supportsAlternateIcons else {
        reject("unsupported", "This device does not support alternate app icons.", nil)
        return
      }
      let target = (name?.isEmpty ?? true) ? nil : name
      if app.alternateIconName == target {
        resolve(target)
        return
      }
      app.setAlternateIconName(target) { error in
        if let error = error {
          reject("icon_change_failed", error.localizedDescription, error)
        } else {
          resolve(target)
        }
      }
    }
  }
}
