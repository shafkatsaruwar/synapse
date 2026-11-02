import Link from "next/link";
import { APP_STORE_URL } from "@/lib/design-tokens/tokens";
import { pageMeta } from "@/lib/seo";
import { KatanaPageView } from "@/components/ui/KatanaPageView";

export const metadata = pageMeta({
  title: "Terms of Use",
  description: "Terms of use for Synapse Health Companion, including purchases, account deletion, and the medical information disclaimer.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="page prose">
      <KatanaPageView path="/terms" />
      <header className="page-hero">
        <p className="eyebrow">Terms</p>
        <h1>Terms of Use</h1>
        <p className="lede">Simple terms for using Synapse Health Companion.</p>
        <p>
          <strong>Effective Date:</strong> October 22, 2026
          <br />
          <strong>Last Updated:</strong> October 22, 2026
        </p>
      </header>

      <h2>Using Synapse</h2>
      <p>
        Synapse is a personal health organization tool. You may use it to record information, organize medication and appointment reminders, and prepare information for conversations with a healthcare professional. You are responsible for the information you enter and for protecting access to your device and exported backups.
      </p>

      <h2>Medical disclaimer</h2>
      <p>
        Synapse is not a medical device, healthcare provider, emergency response service, or substitute for professional care. Synapse does not diagnose conditions or recommend treatment. Do not rely on the App for an emergency or make medication changes without appropriate clinical guidance. Contact local emergency services when necessary.
      </p>

      <h2>Accounts and deletion</h2>
      <p>
        An account is optional for cloud backup and related features. If you create an account, you can delete it from the App under <strong>Privacy &amp; Data → Delete Account</strong>. Deletion removes the account and available Synapse cloud data; it does not cancel an Apple subscription, which must be managed in Apple ID Subscriptions. Local files and exported backups may need to be removed separately from your device or storage provider.
      </p>

      <h2>Synapse Plus purchases</h2>
      <p>
        Optional digital Plus features are purchased through Apple&apos;s In-App Purchase system. Subscription price, billing period, introductory offer, renewal terms, and what each plan unlocks are shown in the App before purchase. Subscriptions renew automatically unless canceled through Apple at least 24 hours before the current period ends. Use <strong>Restore Purchases</strong> in the App to restore eligible purchases on the same Apple ID.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We may update, suspend, or discontinue parts of Synapse as the App evolves. Reminders depend on device permissions and operating-system behavior, so they are organizational aids rather than guaranteed alerts. We may update these terms when functionality or legal requirements change.
      </p>

      <h2>Privacy and support</h2>
      <p>
        Our <Link href="/privacy">Privacy Policy</Link> explains how Synapse handles information. For setup and troubleshooting, visit <Link href="/support">Support</Link>. Questions can be sent to <a href="mailto:mohammedshafkatsaruwar@gmail.com">mohammedshafkatsaruwar@gmail.com</a>.
      </p>

      <p>
        Synapse Health Companion is distributed on the <a href={APP_STORE_URL} rel="noopener noreferrer">App Store</a>.
      </p>
    </div>
  );
}
