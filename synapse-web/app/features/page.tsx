import Link from "next/link";
import { features } from "@/lib/feature-content/content";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Features",
  description:
    "Medications, appointments, health records, daily check-ins, Sick Mode, and an emergency card — what Synapse actually includes.",
  path: "/features",
});

export default function FeaturesPage() {
  return (
    <div className="page">
      <header className="page-hero">
        <p className="eyebrow">Features</p>
        <h1>The parts of a health life, kept in one companion.</h1>
        <p className="lede">
          Six places people usually have to hunt for. Each one in Synapse is something you enter and control. Nothing here claims to sync with a hospital, diagnose you, or call for help on its own.
        </p>
      </header>
      <ol className="feature-index">
        {features.map((feature, index) => (
          <li key={feature.slug}>
            <Link href={`/features/${feature.slug}`}>
              <span>0{index + 1}</span>
              <div>
                <h2>{feature.title}</h2>
                <p>{feature.lede}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
