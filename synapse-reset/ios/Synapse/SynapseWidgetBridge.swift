import Foundation
import WidgetKit

@objc(SynapseWidgetBridge)
final class SynapseWidgetBridge: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(saveSnapshot:resolver:rejecter:)
  func saveSnapshot(
    _ payload: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let suiteName = "group.com.mohammedsaruwar.synapse"
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      reject("no_app_group", "Could not access shared widget storage.", nil)
      return
    }

    defaults.set(payload, forKey: "synapse_widget_snapshot")
    defaults.set(Date().timeIntervalSince1970, forKey: "synapse_widget_snapshot_updated_at")
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }
}
