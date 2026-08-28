/** Map RN/iOS transport failures to something a human can act on. Never include tokens. */
export function mapAuthNetworkError(error: unknown, host?: string | null): Error {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  const hostname = (host ?? "").trim();
  if (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("aborted") ||
    lower.includes("network error")
  ) {
    return new Error(
      hostname
        ? `Could not reach ${hostname}. Check connection, then try again. If this build is old, install a new TestFlight build.`
        : "Could not reach the sign-in server. Check connection, then try again."
    );
  }
  return error instanceof Error ? error : new Error(raw || "Sign-in failed");
}
