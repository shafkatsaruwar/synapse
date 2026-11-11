#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SynapseCloudKitBridge, NSObject)

RCT_EXTERN_METHOD(getStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchBackupMetadata:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(savePayload:(NSString *)payload
                  lastUpdatedISO:(NSString *)lastUpdatedISO
                  schemaVersion:(nonnull NSNumber *)schemaVersion
                  summaryJson:(NSString *)summaryJson
                  encrypted:(BOOL)encrypted
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(restorePayload:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(restorePayloadByRecordName:(NSString *)recordName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(listSnapshots:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
