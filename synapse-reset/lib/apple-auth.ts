/**
 * Native Sign in with Apple → Supabase session helpers.
 * iOS only. Requires Apple provider enabled in Supabase + App ID capability.
 */
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { getSupabase } from "@/lib/supabase";

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function randomNonce(length = 32): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";
  const bytes = Crypto.getRandomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export type AppleSignInResult = {
  error: Error | null;
  canceled?: boolean;
};

/**
 * Present the system Apple sheet and exchange the identity token with Supabase.
 */
export async function signInWithAppleNative(): Promise<AppleSignInResult> {
  if (Platform.OS !== "ios") {
    return { error: new Error("Sign in with Apple is available on iPhone and iPad.") };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { error: new Error("Cloud sign-in isn’t configured in this build.") };
  }

  const available = await isAppleAuthAvailable();
  if (!available) {
    return { error: new Error("Sign in with Apple isn’t available on this device.") };
  }

  const rawNonce = randomNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { error: new Error("Apple did not return an identity token.") };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      return { error: new Error(error.message || "Apple sign-in failed.") };
    }

    // Apple only returns the name on the first authorization.
    if (credential.fullName) {
      const parts = [
        credential.fullName.givenName,
        credential.fullName.middleName,
        credential.fullName.familyName,
      ].filter(Boolean) as string[];
      if (parts.length > 0) {
        await supabase.auth
          .updateUser({
            data: {
              full_name: parts.join(" "),
              given_name: credential.fullName.givenName,
              family_name: credential.fullName.familyName,
            },
          })
          .catch(() => {});
      }
    }

    return { error: null };
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") {
      return { error: null, canceled: true };
    }
    return {
      error: e instanceof Error ? e : new Error("Apple sign-in failed."),
    };
  }
}
