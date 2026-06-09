import Foundation
import WidgetKit

@objc(SynapseWidgetBridge)
final class SynapseWidgetBridge: NSObject {
  private let suiteName = "group.com.mohammedsaruwar.synapse"
  private let widgetSnapshotKey = "synapse_widget_snapshot"
  private let widgetSnapshotUpdatedAtKey = "synapse_widget_snapshot_updated_at"
  private let pendingIcsImportKey = "synapse_pending_ics_import"
  private let pendingAppIntentActionsKey = "synapse_pending_app_intent_actions"

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
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      reject("no_app_group", "Could not access shared widget storage.", nil)
      return
    }

    defaults.set(payload, forKey: widgetSnapshotKey)
    defaults.set(Date().timeIntervalSince1970, forKey: widgetSnapshotUpdatedAtKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }

  @objc(getPendingICSImport:rejecter:)
  func getPendingICSImport(
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      reject("no_app_group", "Could not access shared import storage.", nil)
      return
    }

    resolve(defaults.string(forKey: pendingIcsImportKey))
  }

  @objc(clearPendingICSImport:rejecter:)
  func clearPendingICSImport(
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      reject("no_app_group", "Could not access shared import storage.", nil)
      return
    }

    defaults.removeObject(forKey: pendingIcsImportKey)
    resolve(true)
  }

  @objc(getPendingAppIntentActions:rejecter:)
  func getPendingAppIntentActions(
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      reject("no_app_group", "Could not access shared App Intent storage.", nil)
      return
    }

    resolve(defaults.string(forKey: pendingAppIntentActionsKey) ?? "[]")
  }

  @objc(clearPendingAppIntentActions:rejecter:)
  func clearPendingAppIntentActions(
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      reject("no_app_group", "Could not access shared App Intent storage.", nil)
      return
    }

    defaults.removeObject(forKey: pendingAppIntentActionsKey)
    resolve(true)
  }
}
