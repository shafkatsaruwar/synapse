/**
 * App Store Server Notifications V2 verification via Apple's supported library.
 * https://github.com/apple/app-store-server-library-node
 */
import { Buffer } from "node:buffer";
import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "npm:@apple/app-store-server-library@1.6.0";

/** Apple Root CA - G3 (DER, base64). Source: https://www.apple.com/certificateauthority/ */
const APPLE_ROOT_CA_G3_DER_B64 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function appleRootCAs(): Buffer[] {
  // Node Buffer polyfill is available in Supabase Edge (Deno) for this npm package.
  const der = decodeBase64(APPLE_ROOT_CA_G3_DER_B64);
  return [Buffer.from(der)];
}

export type VerifiedAssnNotification = {
  environment: "Production" | "Sandbox";
  notification: ResponseBodyV2DecodedPayload;
  transaction: JWSTransactionDecodedPayload | null;
};

function makeVerifier(environment: Environment, bundleId: string, appAppleId: number) {
  return new SignedDataVerifier(
    appleRootCAs(),
    true,
    environment,
    bundleId,
    environment === Environment.PRODUCTION ? appAppleId : undefined,
  );
}

/**
 * Verify signedPayload against Production, then Sandbox.
 * Throws if neither environment accepts the signature/claims.
 */
export async function verifyAssnSignedPayload(input: {
  signedPayload: string;
  bundleId: string;
  appAppleId: number;
}): Promise<VerifiedAssnNotification> {
  const attempts: Array<{ environment: "Production" | "Sandbox"; envEnum: Environment }> = [
    { environment: "Production", envEnum: Environment.PRODUCTION },
    { environment: "Sandbox", envEnum: Environment.SANDBOX },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const verifier = makeVerifier(attempt.envEnum, input.bundleId, input.appAppleId);
      const notification = await verifier.verifyAndDecodeNotification(input.signedPayload);
      let transaction: JWSTransactionDecodedPayload | null = null;
      const signedTransactionInfo = notification.data?.signedTransactionInfo;
      if (typeof signedTransactionInfo === "string" && signedTransactionInfo.length > 0) {
        transaction = await verifier.verifyAndDecodeTransaction(signedTransactionInfo);
      }
      return {
        environment: attempt.environment,
        notification,
        transaction,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not verify App Store Server Notification signature");
}
