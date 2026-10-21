import { AppStoreLink } from "@/components/ui/AppStoreLink";
import { PhoneFrame } from "@/components/product/PhoneFrame";
import { TodayScreen } from "@/components/product/screens";

export function ReducedHero() {
  return (
    <section className="reduced-hero" aria-labelledby="reduced-title">
      <div className="reduced-copy">
        <p className="eyebrow">Meet Synapse</p>
        <h1 id="reduced-title">Your health life, finally in one place.</h1>
        <p className="lede">Your personal health companion.</p>
        <p>
          Medications. Appointments. Records. Important details. They often live in different places. Synapse is where the ones you keep can sit together.
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
