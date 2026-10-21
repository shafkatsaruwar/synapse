import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteNav } from "@/components/navigation/SiteNav";
import { getSiteUrl } from "@/lib/design-tokens/tokens";
import { siteJsonLd } from "@/lib/seo";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const description =
  "Synapse is a personal health companion for iPhone. Medications, appointments, records, and the details you keep — finally in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Synapse — Your health life, finally in one place.",
    template: "%s",
  },
  description,
  applicationName: "Synapse",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Synapse — Your health life, finally in one place.",
    description,
    siteName: "Synapse",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Synapse — Your health life, finally in one place.",
    description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = siteJsonLd();
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <SiteNav />
        <main id="content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
