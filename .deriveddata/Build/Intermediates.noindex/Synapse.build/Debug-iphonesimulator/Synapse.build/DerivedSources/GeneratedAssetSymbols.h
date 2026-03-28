#import <Foundation/Foundation.h>

#if __has_attribute(swift_private)
#define AC_SWIFT_PRIVATE __attribute__((swift_private))
#else
#define AC_SWIFT_PRIVATE
#endif

/// The resource bundle ID.
static NSString * const ACBundleID AC_SWIFT_PRIVATE = @"com.mohammedsaruwar.synapse";

/// The "SplashScreenBackground" asset catalog color resource.
static NSString * const ACColorNameSplashScreenBackground AC_SWIFT_PRIVATE = @"SplashScreenBackground";

/// The "SplashScreenLegacy" asset catalog image resource.
static NSString * const ACImageNameSplashScreenLegacy AC_SWIFT_PRIVATE = @"SplashScreenLegacy";

/// The "SplashScreenLogo" asset catalog image resource.
static NSString * const ACImageNameSplashScreenLogo AC_SWIFT_PRIVATE = @"SplashScreenLogo";

#undef AC_SWIFT_PRIVATE
