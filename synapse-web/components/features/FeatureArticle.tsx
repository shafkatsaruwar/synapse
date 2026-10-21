import Link from "next/link";
import { features, type FeatureContent } from "@/lib/feature-content/content";
import { PhoneFrame } from "@/components/product/PhoneFrame";
import { ScreenFor } from "@/components/product/screens";
import { AppStoreLink } from "@/components/ui/AppStoreLink";
import { TrackView } from "@/components/ui/TrackView";

export function FeatureArticle({ feature }: { feature: FeatureContent }) {
  const related = features.filter((item) => item.slug !== feature.slug).slice(0, 3);
  return (
    <article className="feature" data-layout={feature.layout}>
      <TrackView event="feature_visit" id={feature.slug} />
      <header className="feature-hero">
        <div>
          <p className="eyebrow">{feature.eyebrow}</p>
          <h1>{feature.title}</h1>
          <p className="lede">{feature.lede}</p>
        </div>
        <PhoneFrame caption={feature.caption}>
          <ScreenFor name={feature.screen} />
        </PhoneFrame>
      </header>
      <div className="feature-body">
        {feature.explanation.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <section className="steps" aria-labelledby={`${feature.slug}-how`}>
        <h2 id={`${feature.slug}-how`}>How it works</h2>
        <ol>
          {feature.steps.map((step, index) => (
            <li key={step.title}>
              <span>0{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="benefits" aria-labelledby={`${feature.slug}-benefits`}>
        <h2 id={`${feature.slug}-benefits`}>What you can do</h2>
        <ul>
          {feature.benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      </section>
      <aside className="privacy-note">
        <h2>Privacy</h2>
        <p>{feature.privacy}</p>
        <Link href="/privacy">Read how Synapse handles information</Link>
      </aside>
      <div className="hero-actions feature-cta">
        <AppStoreLink placement={`feature-${feature.slug}`} />
        <Link className="btn btn-text" href="/support">
          Support
        </Link>
      </div>
      <nav className="related" aria-label="Related">
        {related.map((item) => (
          <Link key={item.slug} href={`/features/${item.slug}`}>
            <span>{item.eyebrow}</span>
            {item.title}
          </Link>
        ))}
        <Link href="/features">
          <span>All</span>
          Every feature
        </Link>
      </nav>
    </article>
  );
}
