#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SynapseVisionBridge, NSObject)

RCT_EXTERN_METHOD(recognizeText:(NSString *)imageUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(recognizePDFText:(NSString *)pdfUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
