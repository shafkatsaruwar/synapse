import Link from "next/link";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Privacy",
  description:
    "How Synapse handles health information: on-device by default, optional account and export, and what the app does not claim.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="page prose">
      <header className="page-hero">
        <p className="eyebrow">Privacy</p>
        <h1>You control what leaves this device.</h1>
        <p className="lede">
          This page restates how the Synapse app describes its own privacy behavior. The repository does not contain a separate hosted privacy-policy URL or a lawyer-drafted policy. The in-app Privacy & Data screen is the product’s own account of what happens to information.
        </p>
      </header>

      <h2>Local-first</h2>
      <p>
        Health logs are stored on the device by default. The app’s privacy screen says so directly: it is a personal wellness tracker, and you control what leaves the device. Manual backup and restore — a file you keep — is the backup path that is available. Apple Health import and other optional tools run only when you use them.
      </p>
      <p>
        Automatic iCloud backup is currently unavailable. CloudKit backup code exists, and the app is configured with an iCloud container, but the feature flag is off because the production CloudKit schema is not ready. Do not expect iCloud backup to be working in this version.
      </p>

      <h2>Optional account</h2>
      <p>
        You can use Synapse without signing in. An account is not required to track medications, visits, or check-ins. This version does not automatically sync health logs to the cloud.
      </p>

      <h2>What you can do with your data</h2>
      <ul>
        <li>Export a JSON file of what Synapse has stored.</li>
        <li>Restore from a Synapse export, which can replace what is currently on the device.</li>
        <li>Delete all data from the device.</li>
        <li>Turn on App Lock with Face ID, Touch ID, or the device passcode. App Lock is not available on web.</li>
      </ul>
      <p>Exports are described in the app as unencrypted JSON. Treat them like medical records. Synapse does not sell health data to advertisers.</p>

      <h2>Permissions</h2>
      <ul>
        <li>Face ID, if you enable App Lock, to keep the app locked on that device.</li>
        <li>Apple Health, read-only, for heart rate, blood pressure, weight, temperature, oxygen, blood glucose, sleep, and steps — and only when you connect it. This version does not write to Apple Health.</li>
        <li>Calendar, read-only, so you can import selected events as appointments. Synapse can add an event only when you choose to export one.</li>
        <li>Photos, when you pick an image or save one.</li>
        <li>Notifications, if you want medication reminders.</li>
      </ul>

      <h2>Optional tools</h2>
      <p>
        Apple Health import, when you connect it, copies selected vitals onto the device. It is read-only in this version, and it is not a connection to a hospital or patient portal. A document scanner exists in the source behind a switch that is off, so scanning is not part of the app this site describes.
      </p>
      <p>
        This site does not market automatic syncing, automatic iCloud backup, or an AI assistant. If a control in the app can send or share something, it runs only when you use it.
      </p>

      <h2>What Synapse is not</h2>
      <p>
        The app states that it is a personal wellness and organization app, not a medical device, not a healthcare provider, and not a HIPAA covered entity or business associate product. It does not provide medical advice. It is not end-to-end encrypted, and this site does not describe local storage as encrypted. Follow your clinician’s guidance.
      </p>
      <p>
        This marketing site does not load a third-party analytics SDK. The app’s own milestone notes stay on the device. No health information is collected here.
      </p>
      <p>
        <Link href="/terms">Terms</Link>
        {" · "}
        <Link href="/support">Support</Link>
      </p>
    </div>
  );
}
