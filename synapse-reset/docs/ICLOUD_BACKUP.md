# Automatic iCloud (CloudKit) Backup

Encrypted private-CloudKit backups for Synapse Health Companion. Independent of Sign in with Apple. Manual JSON export/restore and Synapse Cloud (`user_backups`) remain fully supported.

## Status in this build

`featureFlags.cloudKitBackupEnabled` is **`false`**.

Do **not** flip it on until both are true:

1. CloudKit **Production** schema for container `iCloud.com.mohammedsaruwar.synapse` includes the `UserData` record type (and optional fields below).
2. You have verified passphrase-wrapped DEK recovery on a second device / reinstall.

Without (1), saves fail with `CKErrorDomain` / code **12** (missing Production schema). Without (2), encrypted cross-device restore is unsafe to offer.

## What ships in code

| Piece | Location |
| --- | --- |
| AES-256-GCM + scrypt wrap | `lib/cloudkit-crypto.ts` |
| Keychain DEK + local wrap metadata | `lib/cloudkit-keys.ts` |
| Debounced auto backup, manual save/restore, snapshots API | `lib/cloudkit-backup.ts` |
| Native CloudKit private DB bridge | `ios/Synapse/SynapseCloudKitBridge.swift` |
| Backup & Restore UI section | `screens/BackupRestoreScreen.tsx` |
| Entitlements | `app.config.js` → `iCloud.com.mohammedsaruwar.synapse` |

### Security model

- Random 256-bit **DEK** encrypts each backup (AES-256-GCM + AAD).
- User **recovery passphrase** (min 12 chars) derives a KEK via **scrypt** and wraps the DEK.
- Raw DEK is stored only in the device Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`).
- Wrapped DEK is embedded in every CloudKit envelope (never the raw DEK).
- Snapshot index keeps non-PHI counts only (med / appointment / log counts).
- Automatic restore on iCloud availability is **disabled** — restore is always explicit.
- Failed uploads retry with backoff; success is reported only after CloudKit save resolves.
- Retention: latest record + up to **10** snapshot records; pruning deletes only listed extras (never a full wipe of history from a corrupt index).

## Apple Developer / CloudKit Dashboard (required)

These steps are **manual**. Agents must not change Apple Developer settings silently.

1. Open [CloudKit Dashboard](https://icloud.developer.apple.com/) → container **`iCloud.com.mohammedsaruwar.synapse`**.
2. In **Development**, ensure record type **`UserData`** exists with fields:
   - `userId` — String
   - `lastUpdated` — Date/Time
   - `payload` — String (encrypted envelope JSON when small enough)
   - `payloadAsset` — Asset (preferred for larger envelopes)
   - `schemaVersion` — Int(64) *(optional but recommended)*
   - `summaryJson` — String *(optional; non-PHI counts)*
   - `encrypted` — Int(64) *(optional; 0/1)*
   - `kind` — String *(optional; `latest` / `snapshot` / `index`)*
3. **Deploy Schema to Production**. Development-only schema is what caused CKError 12.
4. Confirm the App ID `com.mohammedsaruwar.synapse` has iCloud + CloudKit capability and the container is attached.
5. Ship a **new native iOS build** (dev client / TestFlight) that includes `SynapseCloudKitBridge` — Expo Go cannot load this module.
6. Only then set `cloudKitBackupEnabled: true` in `constants/feature-flags.ts` and release (or OTA if native bridge already present).

Record names used by the bridge:

- `current-user-data` — latest backup (upserted; no query index required)
- `backup-<timestamp>-<uuid>` — recoverable snapshots
- `synapse-backup-index` — JSON list of snapshot metadata (avoids relying on Production query indexes)

## Device test plan (real iPhone)

1. **Fresh install** — set recovery passphrase → enable Automatic Backup → Back Up Now → confirm last successful time updates only after success.
2. **Existing data** — change a medication → wait for debounce / background → verify new snapshot appears.
3. **iCloud unavailable** — sign out of iCloud in Settings → toggle/status copy explains the block; local app still works.
4. **Storage full** — expect friendly “iCloud storage looks full” copy (no crash).
5. **Network interrupt** — toggle airplane mode mid-upload → error stored; retry after reconnect.
6. **Reinstall same device** — without passphrase unlock, restore prompts for passphrase; with passphrase, restore previews counts then requires confirmation; transactional rollback on failure.
7. **Replacement iPhone** — same iCloud account + passphrase unlocks DEK from envelope.
8. **Different iCloud account** — no Synapse snapshots (or empty); never auto-imports.
9. **Corrupted / wrong passphrase** — restore fails closed; local data untouched.
10. **Manual JSON + Synapse Cloud** — Save My Backup / Restore My Data and SIWA cloud paths still work unchanged.

## Limitations

- Feature flag remains off until Production schema deploy.
- Legacy plaintext CloudKit payloads (if any from earlier experiments) are **not** auto-imported under the encrypted path.
- Keychain DEK does not sync via iCloud Keychain; cross-device recovery **requires** the user passphrase.
- Losing the passphrase means encrypted CloudKit backups cannot be decrypted (manual JSON / Synapse Cloud may still help if the user kept those).
- Full `BGProcessingTask` scheduling is not required; Synapse flushes on AppState background when iOS keeps the process alive.
