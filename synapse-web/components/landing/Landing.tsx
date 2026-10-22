import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { DM_Sans } from "next/font/google";
import { AppStoreLink } from "@/components/ui/AppStoreLink";
import { testimonials } from "./testimonials";
import { TestimonialsColumns } from "./TestimonialsColumns";
import s from "./Landing.module.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-landing", display: "swap" });

/* Real app captures with personal details replaced by sample data. */
const SHOT = { width: 1170, height: 2532 };

function Phone({ src, alt, priority = false, sizes = "(max-width: 880px) 70vw, 300px" }: { src: string; alt: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={s.phone}>
      <Image className={s.screen} src={src} alt={alt} width={SHOT.width} height={SHOT.height} sizes={sizes} priority={priority} unoptimized />
    </div>
  );
}

function Arrow() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const reasons: { n: string; title: string; body: string; src: string; alt: string }[] = [
  {
    n: "01",
    title: "Everything together",
    body: "Keep medications, appointments, and records organized in one place.",
    src: "/screens/medications.png",
    alt: "Health tab listing Medications, Appointments, How I'm Feeling, Health Records, Wellbeing and Care & Support.",
  },
  {
    n: "02",
    title: "Ready when it matters",
    body: "Find important health information and emergency details quickly.",
    src: "/screens/you-settings-real.png",
    alt: "You and Settings screen with a backup reminder, Profile, Conditions, Allergy and Emergency Info, Vaccines and Surgeries.",
  },
  {
    n: "03",
    title: "Private and personal",
    body: "No account required. Your information stays on your iPhone, and you can customize the look for free.",
    src: "/screens/today-sam.png",
    alt: "Synapse Today screen. Your information stays on your iPhone.",
  },
];

const insideShots = [
  { src: "/screens/today-sam.png", alt: "Today screen with the next medication and a missed dose." },
  { src: "/screens/you-settings-real.png", alt: "You and Settings screen with a backup reminder and profile sections." },
  { src: "/screens/emergency-card.png", alt: "Medical emergency card with name, allergies, medications and contacts." },
  { src: "/screens/medications.png", alt: "Medications screen with today's doses and an Add Med button." },
  { src: "/screens/appointments.png", alt: "Appointments calendar with an upcoming visit." },
];

const scattered = [
  { src: "/screens/today-sam.png", alt: "Today screen with the next medication and a missed dose.", label: "Today" },
  { src: "/screens/medications.png", alt: "Medications screen with today's doses.", label: "Medications" },
  { src: "/screens/you-settings-real.png", alt: "You and Settings screen with profile, conditions and allergy details.", label: "Details" },
  { src: "/screens/appointments.png", alt: "Appointments calendar with an upcoming visit.", label: "Appointments" },
];

export function Landing(): ReactNode {
  return (
    <div className={`${s.page} ${dmSans.variable} landing-root`}>
      {/* HERO: the first screen answers what it is, who it's for, and where to download it */}
      <section className={s.hero}>
        <div className={s.wrap}>
          <div className={s.heroGrid}>
            <div className={s.heroText}>
              <span className={s.badge}>Health companion for iPhone</span>
              <h1 className={s.h1}>Your health life, finally in one place.</h1>
              <p className={s.lede}>
                Medications, appointments, medical records, symptoms, and emergency information. Beautifully organized in one private iPhone app.
              </p>
              <div className={s.actions}>
                <AppStoreLink className={s.primary} placement="hero">
                  Download Free on the App Store <Arrow />
                </AppStoreLink>
                <a className={s.secondary} href="#how-it-works">
                  See How It Works
                </a>
              </div>
            </div>
            <div className={s.heroMedia}>
              <div className={s.glow} aria-hidden="true" />
              <Phone
                src="/screens/today-sam.png"
                alt="Synapse Today screen showing a greeting, the next medication, a missed dose, and Activate Sick Mode."
                priority
                sizes="(max-width: 880px) 80vw, 340px"
              />
            </div>
          </div>
        </div>
      </section>

      {/* THREE REASONS */}
      <section className={s.section} aria-labelledby="reasons-title">
        <div className={s.wrap}>
          <div className={s.head}>
            <p className={s.kicker}>
              Why <span>Synapse</span>
            </p>
            <h2 className={s.h2} id="reasons-title">
              Three reasons to download it today.
            </h2>
          </div>
          <ol className={s.reasonGrid}>
            {reasons.map((r) => (
              <li key={r.n} className={s.reason}>
                <div className={s.reasonMedia}>
                  <Phone src={r.src} alt={r.alt} sizes="(max-width: 880px) 70vw, 260px" />
                </div>
                <p className={s.num}>{r.n}</p>
                <h3 className={s.h3}>{r.title}</h3>
                <p className={s.body}>{r.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* HOW IT WORKS: scattered cards that settle into one place as you scroll */}
      <section className={s.scatterSection} id="how-it-works" aria-labelledby="how-title">
        <div className={s.wrap}>
          <div className={s.head}>
            <p className={s.kicker}>
              How it <span>works</span>
            </p>
            <h2 className={s.h2} id="how-title">
              Different places to look. Then one place.
            </h2>
            <p className={s.body}>Your health details tend to live in a lot of corners. Synapse brings them together, so you can open one app and find what you need.</p>
          </div>
          <div className={s.scatter}>
            {scattered.map((c, i) => (
              <figure key={c.label} className={s.scatterCard} style={{ "--r": `${[-7, 4, -3, 6][i]}deg`, "--x": `${[-18, 12, -6, 22][i]}px`, "--y": `${[30, 10, 60, 24][i]}px` } as CSSProperties}>
                <div className={s.scatterShot}>
                  <Image src={c.src} alt={c.alt} width={SHOT.width} height={SHOT.height} sizes="(max-width: 880px) 60vw, 240px" className={s.scatterImg} />
                </div>
                <figcaption className={s.scatterLabel}>{c.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* INSIDE THE APP: real captures, files unchanged, displayed by height */}
      <section className={s.section} aria-labelledby="inside-title">
        <div className={s.wrap}>
          <div className={s.head}>
            <p className={s.kicker}>
              Inside <span>the app</span>
            </p>
            <h2 className={s.h2} id="inside-title">
              Real screens, nothing dressed up.
            </h2>
          </div>
        </div>
        <ul className={s.strip} aria-label="Synapse screenshots">
          {insideShots.map((shot) => (
            <li key={shot.src} className={s.stripItem}>
              <img className={s.stripImg} src={shot.src} alt={shot.alt} width={1170} height={2532} loading="lazy" decoding="async" />
            </li>
          ))}
        </ul>
      </section>

      {/* TESTIMONIALS (hidden until real quotes are added to testimonials.ts) */}
      {testimonials.length > 0 && (
        <section className={s.section}>
          <div className={s.wrap}>
            <div className={s.head}>
              <span className={s.pill}>Testimonials</span>
              <h2 className={s.h2}>What our users say</h2>
              <p className={s.body}>Real words from people using Synapse.</p>
            </div>
            <div className={s.colsMask}>
              <TestimonialsColumns items={testimonials} />
            </div>
          </div>
        </section>
      )}

      {/* DOWNLOAD: repeated CTA near the footer */}
      <section className={s.download}>
        <div className={s.wrap}>
          <div className={s.downloadGrid}>
            <div className={s.downloadText}>
              <span className={s.badge}>Built for iPhone</span>
              <h2 className={s.downloadH2}>
                {"Your health life, finally in one place.".split(" ").map((w, i) => (
                  <Fragment key={`${w}-${i}`}>
                    {i > 0 && " "}
                    <span className={s.word} style={{ "--d": `${i * 90}ms` } as CSSProperties}>
                      {w}
                    </span>
                  </Fragment>
                ))}
              </h2>
              <p className={s.lede}>Free to download. No account required.</p>
              <AppStoreLink className={s.primary} placement="download">
                Download Free on the App Store <Arrow />
              </AppStoreLink>
            </div>
            <div className={s.downloadMedia}>
              <div className={s.glow} aria-hidden="true" />
              <Phone src="/screens/home-blue.webp" alt="Synapse home screen in the Blue theme." sizes="(max-width: 980px) 70vw, 300px" />
              <AppStoreLink className={s.floatChip} placement="download-float">
                Download on the App Store
              </AppStoreLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
