import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { exportAllData, importAllData, type ExportPayload } from "@/lib/storage";

const SYNC_PORT = 9666;
const SCHEME = "synapse";

let serverInstance: { stop: () => void } | null = null;

/** Generate a 32-char alphanumeric pairing token. */
export function generatePairingToken(): string {
  const bytes = Crypto.getRandomBytes(16);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex;
}

/** Strip imageUri from documents (file:// paths won't work on another device). */
function preparePayloadForTransfer(payload: ExportPayload): ExportPayload {
  return {
    ...payload,
    documents: (payload.documents ?? []).map(({ imageUri: _, ...rest }) => rest),
  };
}

/** Build pairing URL for QR code: synapse://pair?token=X&host=Y&port=Z */
export function buildPairingUrl(token: string, host: string, port: number): string {
  const params = new URLSearchParams({ token, host: String(host), port: String(port) });
  return `${SCHEME}://pair?${params.toString()}`;
}

/** Parse pairing URL and return { token, host, port }. */
export function parsePairingUrl(url: string): { token: string; host: string; port: number } | null {
  try {
    if (!url.startsWith(SCHEME + "://pair")) return null;
    const q = url.indexOf("?");
    if (q === -1) return null;
    const params = new URLSearchParams(url.slice(q));
    const token = params.get("token");
    const host = params.get("host");
    const port = params.get("port");
    if (!token || !host || !port) return null;
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum <= 0) return null;
    return { token, host, port: portNum };
  } catch {
    return null;
  }
}

/** Check if HTTP server is supported (iOS/Android only). */
export function isTransferServerSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export interface TransferServerReady {
  host: string;
  port: number;
  pairingUrl: string;
}

/**
 * Start local HTTP server for transfer. Only works on iOS/Android.
 * Single-use: after one successful GET /backup, the handler will not serve again.
 */
export async function startTransferServer(
  token: string,
  onReady: (info: TransferServerReady) => void
): Promise<{ error: Error | null }> {
  if (!isTransferServerSupported()) {
    return { error: new Error("Transfer server is only supported on iOS and Android") };
  }

  const ip = await Network.getIpAddressAsync();
  const host = ip && ip !== "0.0.0.0" ? ip : "localhost";

  const pairingUrl = buildPairingUrl(token, host, SYNC_PORT);

  try {
    const server = await import("expo-http-server");
    let servedOnce = false;

    server.setup(SYNC_PORT, (event: { status: string; message?: string }) => {
      if (event.status === "ERROR") {
        console.warn("[qr-sync] Server error:", event.message);
      }
    });

    server.route("/backup", "GET", async (request: { paramsJson?: string }) => {
      if (servedOnce) {
        return {
          statusCode: 410,
          contentType: "application/json",
          body: JSON.stringify({ error: "Already transferred" }),
        };
      }
      let params: Record<string, string> = {};
      try {
        params = JSON.parse(request.paramsJson ?? "{}");
      } catch {
        params = {};
      }
      const reqToken = params.token;
      if (reqToken !== token) {
        return {
          statusCode: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "Invalid token" }),
        };
      }
      servedOnce = true;
      const payload = await exportAllData();
      const prepared = preparePayloadForTransfer(payload);
      return {
        statusCode: 200,
        contentType: "application/json",
        body: JSON.stringify(prepared),
      };
    });

    server.start();

    serverInstance = {
      stop: () => {
        server.stop();
        serverInstance = null;
      },
    };

    onReady({ host, port: SYNC_PORT, pairingUrl });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export function stopTransferServer(): void {
  if (serverInstance) {
    serverInstance.stop();
    serverInstance = null;
  }
}

/**
 * Fetch backup from pairing URL and return ExportPayload.
 * Validates basic structure before returning.
 */
export async function fetchFromPairingUrl(url: string): Promise<ExportPayload> {
  const parsed = parsePairingUrl(url);
  if (!parsed) throw new Error("Invalid pairing URL");

  const { token, host, port } = parsed;
  const fetchUrl = `http://${host}:${port}/backup?token=${encodeURIComponent(token)}`;

  const res = await fetch(fetchUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `Request failed: ${res.status}`;
    try {
      const json = JSON.parse(text);
      if (json.error) errMsg = json.error;
    } catch {
      if (text) errMsg = text;
    }
    throw new Error(errMsg);
  }

  const raw = await res.json();

  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid backup data");
  }
  if (!raw.profile || !Array.isArray(raw.medications)) {
    throw new Error("Invalid backup format");
  }

  return raw as ExportPayload;
}

/**
 * Fetch backup from pairing URL and import into local storage.
 * Ensures onboardingCompleted is true so the user doesn't see onboarding again.
 */
export async function restoreFromPairingUrl(url: string): Promise<{ error: Error | null }> {
  try {
    const payload = await fetchFromPairingUrl(url);
    payload.profile = { ...payload.profile, onboardingCompleted: true };
    await importAllData(payload);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
