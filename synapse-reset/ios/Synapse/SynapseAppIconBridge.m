#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SynapseAppIconBridge, NSObject)

RCT_EXTERN_METHOD(getIconName:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setIconName:(NSString *)name
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
