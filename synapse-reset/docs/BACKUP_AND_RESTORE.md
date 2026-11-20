# Backup & Restore

Where it lives: **You & Settings → Backup & Restore**.

Your health information is stored on this device. Save a backup file so you can restore it if you lose, reset, or replace your phone.

## Backup status

The status card shows one of these:

**Not yet confirmed**

Save a backup so you can restore your information if you lose or replace this phone.

Your health information is important. Consider saving a backup so you can restore it if you change phones.

**Backup exported** (date and time, when known)

Synapse prepared a backup file, but can’t confirm you saved it outside the app. Tap Save My Backup again if you’re unsure.

**Last saved** (date and time, when known)

You confirmed this backup was saved somewhere safe.

If that confirmation is more than 30 days old, the card instead says: It’s been more than 30 days since your last confirmed backup. Consider saving a new one. The reminder about changing phones appears again.

## Save Your Information

### Create a Backup

Save a copy of your medications, appointments, health records, and other Synapse information. Keep the file somewhere safe, such as iCloud Drive.

Backup files are unencrypted JSON. Anyone who obtains the file may be able to read your health information. Prefer a private folder you control.

**Save My Backup**

What happens:

1. Synapse writes `synapse-backup-<timestamp>.json` on this device.
2. The share sheet opens with the title “Save Synapse backup”.
3. After the sheet closes, Synapse asks **Did you save your backup?**
   - Body: Synapse can’t tell whether the file was saved to Files or iCloud Drive. Only confirm if you finished saving it somewhere safe.
   - **Not yet** leaves the status as exported, not confirmed.
   - **Yes, I saved it** confirms the backup and shows: Your backup has been saved. Keep this file somewhere safe — you’ll need it if you ever restore your information.

If sharing is unavailable, the alert is **Backup exported**: a file was prepared on this device, and Synapse can’t confirm you saved it elsewhere.

If the device can’t create a file, the alert is **Backup unavailable**: This device can’t create a backup file right now.

## Restore Your Information

### Restore From a Backup

Have a backup file from an earlier installation of Synapse? Select it to bring your saved information back.

**Restore My Data**

1. Pick a JSON or text file.
2. Synapse checks that it is a Synapse backup. If it isn’t, the alert is **Couldn’t restore**, with the reason.
3. Confirm **Restore From a Backup**.
   - Body: Restoring a backup may replace the information currently stored in Synapse. Any changes made since the backup was created may be lost. A short preview of what is in the file is included.
   - **Cancel**
   - **Replace & Restore**
4. On success: **Restore complete** — Your saved Synapse information is back on this device.
5. If restore fails, existing information is kept when possible.

## Optional Cloud Backup

Shown on iPhone when Sign in with Apple is available, or when you are already signed in.

### Sign in with Apple

Use your Apple ID to upload a backup to Synapse cloud storage and restore it after a reinstall or on another iPhone. Manual file backup above still works without an account.

Cloud backups are stored with your Synapse account (not end-to-end encrypted). Prefer Sign in with Apple and treat this like any online copy of health information.

**Signed out:** black or white **Sign in with Apple** button, matching the app appearance.

If sign-in fails, the alert is **Sign in failed**.

**Signed in, no upload yet**

- Title: No cloud backup yet
- Detail: Sign in with Apple is connected. Upload a backup when you’re ready.
- **Upload Cloud Backup**
- **Restore From Cloud** is dimmed until an upload exists.
- **Sign Out**

**Signed in, backup already uploaded**

- Title: Cloud backup ready
- Detail: Last uploaded, with the date and time. If the time is missing: A backup is stored with your Apple account.
- **Update Cloud Backup**
- **Restore From Cloud**
- **Sign Out**

**Upload Cloud Backup / Update Cloud Backup**

On success: **Cloud backup saved** — Your Synapse information was uploaded to your signed-in account. You can restore it on this or another device after signing in with the same Apple ID.

**Restore From Cloud**

If nothing has been uploaded: **No cloud backup** — Upload a backup first, or restore from a file instead.

Otherwise:

- Body: Restoring from cloud may replace the information currently stored in Synapse. Any changes made since the backup was uploaded may be lost.
- **Cancel**
- **Replace & Restore**
- On success: **Restore complete** — Your cloud backup is back on this device.
- If restore fails, existing information is kept when possible.

**Sign Out**

- Title: Sign out?
- Body: Signing out stops cloud backup on this device. Your local data and any uploaded cloud backup stay where they are.
- **Cancel**
- **Sign Out**

## How to keep your backup safe

Collapsed by default. Open it for these steps:

1. Tap Save My Backup.
2. Choose Save to Files.
3. Select iCloud Drive or another secure location.
4. Tap Save.
5. Keep the backup file so you can restore it later.

Saving only to On My iPhone may not protect the file if this device is lost or reset.

iCloud Drive file storage is different from automatic Synapse iCloud backup.

## Footnote

Automatic iCloud (CloudKit) backup is unavailable. Manual file backup never requires sign-in. Optional Sign in with Apple cloud backup uploads to Synapse account storage when you choose it.

**Open Privacy for more data tools**
