import Expo
import ObjectiveC
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  private var storedLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?
  private var didStartReactNative = false
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

    // The dev client looks for this window inside super.application, before
    // the scene connects. With no window it raises EXC_BREAKPOINT and iOS
    // never leaves the leaf launch storyboard. The scene delegate attaches
    // this same window to the scene so iOS 27 will display it.
#if os(iOS) || os(tvOS)
    if window == nil {
      window = UIWindow(frame: UIScreen.main.bounds)
    }
    if let window {
      startReactNative(in: window, launchOptions: launchOptions)
    }
#if !DEBUG
    keepReleaseDevLauncherFromCrashing()
#endif
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /// Release builds never prepare the dev launcher, so its launch subscriber
  /// throws and the process dies on the storyboard. A launch URL makes that
  /// subscriber return without replacing the React root.
  private func keepReleaseDevLauncherFromCrashing() {
    guard let controllerClass = NSClassFromString("EXDevLauncherController") else { return }
    let sharedSelector = NSSelectorFromString("sharedInstance")
    guard let sharedMethod = class_getClassMethod(controllerClass, sharedSelector) else { return }
    typealias SharedMethod = @convention(c) (AnyClass, Selector) -> AnyObject?
    let shared = unsafeBitCast(method_getImplementation(sharedMethod), to: SharedMethod.self)(
      controllerClass,
      sharedSelector
    )
    guard let shared else { return }

    let prepareSelector = NSSelectorFromString("autoSetupPrepare:launchOptions:")
    guard let prepareMethod = class_getInstanceMethod(object_getClass(shared), prepareSelector),
          let openURL = URL(string: "synapse://open") else {
      return
    }
    typealias PrepareMethod = @convention(c) (AnyObject, Selector, AnyObject, NSDictionary) -> Void
    let options = [UIApplication.LaunchOptionsKey.url.rawValue: openURL] as NSDictionary
    unsafeBitCast(method_getImplementation(prepareMethod), to: PrepareMethod.self)(
      shared,
      prepareSelector,
      self,
      options
    )
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
    window.makeKeyAndVisible()
    guard !didStartReactNative, let factory = reactNativeFactory else { return }
    didStartReactNative = true
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions ?? storedLaunchOptions
    )
    scheduleEmbeddedBundleFallback()
  }

#if os(iOS) || os(tvOS)
  /// How long to keep the leaf launch screen before loading the embedded bundle.
  private static let splashRecoveryDelay: TimeInterval = 2

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
