import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  private var storedLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?
  private var didRecoverFromStuckSplash = false

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)
    storedLaunchOptions = launchOptions

    // The window is created in SceneDelegate. Creating it here is the old
    // app-delegate lifecycle, which the current iOS SDK rejects at launch
    // (EXC_BREAKPOINT, and the leaf splash never leaves).
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /// Point the scene at our delegate in code. A mismatched plist class name
  /// leaves UIKit showing the launch storyboard and never calls `willConnect`.
  @objc public func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }

  func startReactNative(
    in window: UIWindow,
    launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) {
    self.window = window
    guard let factory = reactNativeFactory as? ExpoReactNativeFactory else { return }
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions ?? storedLaunchOptions
    )
    scheduleEmbeddedBundleFallback()
  }

#if os(iOS) || os(tvOS)
  /// How long to keep the leaf launch screen before loading the embedded bundle.
  private static let splashRecoveryDelay: TimeInterval = 6

  private func scheduleEmbeddedBundleFallback() {
#if DEBUG
    return
#else
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.splashRecoveryDelay) { [weak self] in
      self?.launchEmbeddedBundleIfSplashIsStuck()
    }
#endif
  }

  private func launchEmbeddedBundleIfSplashIsStuck() {
    guard !didRecoverFromStuckSplash,
          let window,
          let rootView = window.rootViewController?.view,
          !Self.reactContentIsVisible(in: rootView),
          let bundleURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle"),
          let expoFactory = reactNativeFactory as? ExpoReactNativeFactory else {
      return
    }

    didRecoverFromStuckSplash = true
    NSLog("Synapse: launch screen still up after %.0fs; opening the embedded bundle.", Self.splashRecoveryDelay)

    let rootViewReplacement = expoFactory.recreateRootView(
      withBundleURL: bundleURL,
      moduleName: "main",
      initialProps: nil,
      launchOptions: storedLaunchOptions.map { options in
        Dictionary(uniqueKeysWithValues: options.map { ($0.key as AnyHashable, $0.value) })
      }
    )
    let controller = UIViewController()
    controller.view = rootViewReplacement
    window.rootViewController = controller
    window.makeKeyAndVisible()
  }

  /// The updates launcher inserts EXDeferredRCTRootView and leaves the storyboard on it
  /// until JavaScript starts. A real React surface means startup already moved on.
  private static func reactContentIsVisible(in view: UIView) -> Bool {
    let className = NSStringFromClass(type(of: view))
    if className.contains("EXDeferredRCTRootView") {
      return view.subviews.contains { reactContentIsVisible(in: $0) }
    }
    if className.contains("RCTSurface") || className.contains("RCTRootView") || className.contains("RCTFabric") {
      return true
    }
    return view.subviews.contains { reactContentIsVisible(in: $0) }
  }
#endif

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
