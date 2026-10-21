import Link from "next/link";
import { features } from "@/lib/feature-content/content";
import { PhoneFrame } from "@/components/product/PhoneFrame";
import { ScreenFor } from "@/components/product/screens";
import { AppStoreLink } from "@/components/ui/AppStoreLink";

export function Showcase() {
  return (
    <div className="showcase" id="showcase">
      {features.map((feature) => (
        <section key={feature.slug} className="band" data-layout={feature.layout} id={feature.slug}>
          <div className="band-copy">
            <p className="eyebrow">{feature.eyebrow}</p>
            <h2>{feature.title}</h2>
            <p className="lede">{feature.lede}</p>
            <Link className="text-link" href={`/features/${feature.slug}`}>
              See {feature.nav}
            </Link>
          </div>
          <PhoneFrame caption={feature.caption}>
            <ScreenFor name={feature.screen} />
          </PhoneFrame>
        </section>
      ))}
      <section className="closing">
        <p className="eyebrow">Synapse</p>
        <h2>Your health life, finally in one place.</h2>
        <div className="hero-actions">
          <AppStoreLink placement="closing" />
          <Link className="btn btn-text" href="/features">
            Browse features
          </Link>
        </div>
      </section>
    </div>
  );
}
