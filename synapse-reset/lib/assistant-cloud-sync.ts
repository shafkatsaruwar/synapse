import { AppState } from "react-native";
import { backupNow } from "@/lib/backup";
import { subscribeToCloudKitBackupDirty } from "@/lib/cloudkit-backup-scheduler";
import { getSupabase } from "@/lib/supabase";

const DEBOUNCE_MS = 90_000;

let installedForUser: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

async function syncIfSignedIn(userId: string): Promise<void> {
  if (!getSupabase() || inFlight) return;
  inFlight = true;
  try {
    const { error } = await backupNow(userId);
    if (error) {
      // Best-effort only. Do not log payload or user identifiers.
      console.warn("Assistant cloud sync skipped");
    }
  } finally {
    inFlight = false;
  }
}

function scheduleSync(userId: string): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncIfSignedIn(userId);
  }, DEBOUNCE_MS);
}

/**
 * When the owner is signed in, keep the Supabase user_backups row in sync so
 * the MCP assistant can read the same snapshot (RLS: this user only).
 */
export function installAssistantCloudSync(userId: string): () => void {
  if (!userId) return () => {};
  if (installedForUser === userId) return () => {};
  installedForUser = userId;

  void syncIfSignedIn(userId);

  const unsubscribeDirty = subscribeToCloudKitBackupDirty(() => {
    scheduleSync(userId);
  });

  const appStateSub = AppState.addEventListener("change", (state) => {
    if (state === "background" || state === "inactive") {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      void syncIfSignedIn(userId);
    }
  });

  return () => {
    unsubscribeDirty();
    appStateSub.remove();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (installedForUser === userId) installedForUser = null;
  };
}
