#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SynapseCalendarBridge, NSObject)

RCT_EXTERN_METHOD(requestAccess:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getEvents:(NSString *)startISO
                  endISO:(NSString *)endISO
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getTravelEstimate:(NSString *)destination
                  allowPermissionPrompt:(nonnull NSNumber *)allowPermissionPrompt
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
