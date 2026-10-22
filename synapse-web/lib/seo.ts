import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/design-tokens/tokens";

export function pageMeta({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const fullTitle = title.includes("Synapse") ? title : `${title} · Synapse`;
  return {
    title: fullTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      type: "website",
      siteName: "Synapse",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Synapse Health Companion",
    operatingSystem: "iOS",
    applicationCategory: "HealthApplication",
    url: getSiteUrl(),
    installUrl: "https://apps.apple.com/us/app/synapse-health-companion/id6759972036",
    description:
      "A personal health companion for iPhone. Medications, appointments, records, daily check-ins, sick days, and emergency information you choose to keep, stored on the device by default.",
  };
}
