import Link from "next/link";
import { AppStoreLink } from "@/components/ui/AppStoreLink";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div>
        <p className="brand-lockup">Synapse</p>
        <p>Your health life, finally in one place.</p>
      </div>
      <nav aria-label="Footer">
        <Link href="/features">Features</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/story">Our Story</Link>
        <Link href="/support">Support</Link>
      </nav>
      <AppStoreLink className="btn btn-text" placement="footer">
        Download on the App Store
      </AppStoreLink>
      <p className="footer-note">
        Synapse is a personal health companion for iPhone. It does not provide medical advice, and it does not contact emergency services for you. Sample screens use fictional information.
      </p>
    </footer>
  );
}
