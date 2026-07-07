#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SynapseCloudKitBridge, NSObject)

RCT_EXTERN_METHOD(getStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchBackupMetadata:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(savePayload:(NSString *)payload
                  lastUpdatedISO:(NSString *)lastUpdatedISO
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(restorePayload:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
