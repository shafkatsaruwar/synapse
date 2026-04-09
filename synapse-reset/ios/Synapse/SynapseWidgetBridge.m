#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SynapseWidgetBridge, NSObject)

RCT_EXTERN_METHOD(saveSnapshot:(NSString *)payload
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
