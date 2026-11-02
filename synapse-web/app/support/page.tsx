import Link from "next/link";
import { supportFaqs } from "@/lib/feature-content/content";
import { pageMeta } from "@/lib/seo";
import { AppStoreLink } from "@/components/ui/AppStoreLink";
import { TrackView } from "@/components/ui/TrackView";
import { KatanaPageView } from "@/components/ui/KatanaPageView";

export const metadata = pageMeta({
  title: "Support",
  description: "Getting started with Synapse, medication reminders, backup and restore, permissions, and how to reach the published app.",
  path: "/support",
});

export default function SupportPage() {
  return (
    <div className="page">
      <KatanaPageView path="/support" />
      <TrackView event="support_visit" id="support" />
      <header className="page-hero">
        <p className="eyebrow">Support</p>
        <h1>Help for the things Synapse actually does.</h1>
        <p className="lede">
          Short answers for setup, medication reminders, backup, permissions, and purchases. Feedback inside the app is saved on the device; email support is available for questions about the published app.
        </p>
      </header>
      <div className="faq">
        {supportFaqs.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
      <div className="support-links">
        <AppStoreLink placement="support">View on the App Store</AppStoreLink>
        <Link className="btn btn-text" href="/privacy">
          Privacy
        </Link>
        <Link className="btn btn-text" href="/features/medications">
          Medication help
        </Link>
        <a className="btn btn-text" href="mailto:mohammedshafkatsaruwar@gmail.com">
          Email support
        </a>
      </div>
    </div>
  );
}
