import Link from "next/link";
import { APP_STORE_URL } from "@/lib/design-tokens/tokens";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Terms",
  description: "Synapse does not publish a separate Terms of Service in this repository. The App Store listing is the public download page.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="page prose">
      <header className="page-hero">
        <p className="eyebrow">Terms</p>
        <h1>No separate terms document is in this project.</h1>
        <p className="lede">
          The Synapse repository and the app source do not include a Terms of Service or a custom end-user license. This page does not invent one.
        </p>
      </header>
      <p>
        Synapse Health Companion is distributed on the App Store. That listing is the public place to download the iPhone app:{" "}
        <a href={APP_STORE_URL} rel="noopener noreferrer">
          Synapse Health Companion
        </a>
        .
      </p>
      <p>
        How the app handles information is described in the app’s Privacy & Data screen and restated on <Link href="/privacy">Privacy</Link>. Synapse does not provide medical advice, and it does not contact emergency services for you.
      </p>
      <p>
        Questions about using the app are on <Link href="/support">Support</Link>.
      </p>
    </div>
  );
}
