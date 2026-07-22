import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import React
import SwiftUI
import UIKit

private final class ScreenTimeFocusState {
  static let shared = ScreenTimeFocusState()

  let authorizationCenter = AuthorizationCenter.shared
  let activityCenter = DeviceActivityCenter()
  let settingsStore = ManagedSettingsStore()
  var selection = FamilyActivitySelection()

  private init() {}
}

private final class PickerSelectionModel: ObservableObject {
  @Published var selection: FamilyActivitySelection

  init(selection: FamilyActivitySelection) {
    self.selection = selection
  }
}

private struct ScreenTimePickerView: View {
  @ObservedObject var model: PickerSelectionModel
  let onCancel: () -> Void
  let onDone: () -> Void

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $model.selection)
        .navigationBarTitle("Choose Apps", displayMode: .inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel", action: onCancel)
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Done", action: onDone)
          }
        }
    }
    .navigationViewStyle(.stack)
  }
}

@objc(ScreenTimeFocusModule)
final class ScreenTimeFocusModule: NSObject {
  private let state = ScreenTimeFocusState.shared
  private var pickerController: UIViewController?
  private var pickerModel: PickerSelectionModel?
  private var pendingPickerResolve: RCTPromiseResolveBlock?
  private var pendingPickerReject: RCTPromiseRejectBlock?

  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc(requestAuthorization:rejecter:)
  func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      do {
        try await state.authorizationCenter.requestAuthorization(for: .individual)
        resolve(nil)
      } catch {
        reject("screen_time_authorization_failed", error.localizedDescription, error)
      }
    }
  }

  @objc(pickApps:rejecter:)
  func pickApps(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      guard pendingPickerResolve == nil else {
        reject("screen_time_picker_busy", "The app picker is already open.", nil)
        return
      }

      guard let presenter = topViewController() else {
        reject("screen_time_picker_unavailable", "Could not find a screen to present the app picker.", nil)
        return
      }

      let model = PickerSelectionModel(selection: state.selection)
      let controller = UIHostingController(
        rootView: ScreenTimePickerView(
          model: model,
          onCancel: { [weak self] in
            self?.finishPicker(withSelection: nil, cancelled: true)
          },
          onDone: { [weak self] in
            self?.finishPicker(withSelection: model.selection, cancelled: false)
          }
        )
      )

      controller.modalPresentationStyle = .formSheet
      controller.isModalInPresentation = true

      pickerController = controller
      pickerModel = model
      pendingPickerResolve = resolve
      pendingPickerReject = reject

      presenter.present(controller, animated: true)
    }
  }

  @objc(startFocus:rejecter:)
  func startFocus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      let selection = state.selection
      let hasSelection = !selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty || !selection.webDomainTokens.isEmpty

      guard hasSelection else {
        reject("screen_time_no_selection", "Pick at least one app or category before starting focus.", nil)
        return
      }

      state.settingsStore.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
      state.settingsStore.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
      state.settingsStore.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
      resolve(nil)
    }
  }

  @objc(stopFocus:rejecter:)
  func stopFocus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      state.settingsStore.clearAllSettings()
      resolve(nil)
    }
  }

  @MainActor
  private func finishPicker(withSelection selection: FamilyActivitySelection?, cancelled: Bool) {
    let controller = pickerController
    let resolve = pendingPickerResolve
    let reject = pendingPickerReject

    pickerController = nil
    pickerModel = nil
    pendingPickerResolve = nil
    pendingPickerReject = nil

    if let selection {
      state.selection = selection
    }

    controller?.dismiss(animated: true) {
      if cancelled {
        reject?("screen_time_picker_cancelled", "App selection was cancelled.", nil)
      } else {
        resolve?(nil)
      }
    }
  }

  @MainActor
  private func topViewController() -> UIViewController? {
    let rootController = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)?
      .rootViewController

    return topViewController(from: rootController)
  }

  @MainActor
  private func topViewController(from controller: UIViewController?) -> UIViewController? {
    if let navigationController = controller as? UINavigationController {
      return topViewController(from: navigationController.visibleViewController)
    }
    if let tabBarController = controller as? UITabBarController {
      return topViewController(from: tabBarController.selectedViewController)
    }
    if let presentedController = controller?.presentedViewController {
      return topViewController(from: presentedController)
    }
    return controller
  }
}
