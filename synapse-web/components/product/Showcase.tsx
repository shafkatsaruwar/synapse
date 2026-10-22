import Link from "next/link";
import { features } from "@/lib/feature-content/content";
import { AppearanceDemo } from "@/components/product/AppearanceDemo";
import { PhoneFrame } from "@/components/product/PhoneFrame";
import { ScreenFor } from "@/components/product/screens";
import { AppStoreLink } from "@/components/ui/AppStoreLink";

export function Showcase() {
  return (
    <div className="showcase" id="showcase">
      {features.map((feature) =>
        feature.slug === "appearance" ? (
          <section key={feature.slug} className="band appearance-band" data-layout={feature.layout} id={feature.slug}>
            <div className="band-copy">
              <p className="eyebrow">{feature.eyebrow}</p>
              <h2>{feature.title}</h2>
              <p className="lede">{feature.lede}</p>
              <p className="lede">Themes, accents, wallpapers, and more — free for everyone.</p>
              <Link className="text-link" href={`/features/${feature.slug}`}>
                See {feature.nav}
              </Link>
            </div>
            <AppearanceDemo variant="stage" />
          </section>
        ) : (
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
              <ScreenFor name={feature.screen === "appearance" ? "today" : feature.screen} />
            </PhoneFrame>
          </section>
        ),
      )}
      <section className="closing" aria-labelledby="closing-title">
        <h2 id="closing-title">Your health life, finally in one place.</h2>
        <p className="lede">
          Synapse brings the health information you choose to organize into one thoughtful, personal experience.
        </p>
        <AppStoreLink className="btn btn-primary closing-cta" placement="closing">
          Get Synapse on the App Store
        </AppStoreLink>
      </section>
    </div>
  );
}
