import { AppStoreLink } from "@/components/ui/AppStoreLink";
import { PhoneFrame } from "@/components/product/PhoneFrame";
import { TodayScreen } from "@/components/product/screens";

export function ReducedHero() {
  return (
    <section className="reduced-hero" aria-labelledby="reduced-title">
      <div className="reduced-copy">
        <p className="eyebrow">Meet Synapse</p>
        <h1 id="reduced-title">Your health. Everywhere.</h1>
        <p className="lede">Your health life, finally in one place.</p>
        <p>
          Medications, appointments, records, and the details you choose to keep can sit together in one personal companion. This still view is the same story, without the scroll animation.
        </p>
        <div className="hero-actions">
          <AppStoreLink placement="reduced-hero" />
          <a className="btn btn-text" href="#showcase">
            Explore Synapse
          </a>
        </div>
      </div>
      <PhoneFrame caption="Today in Synapse, with fictional sample information.">
        <TodayScreen />
      </PhoneFrame>
    </section>
  );
}
