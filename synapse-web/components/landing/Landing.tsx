import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { DM_Sans } from "next/font/google";
import { AppStoreLink } from "@/components/ui/AppStoreLink";
import { testimonials } from "./testimonials";
import { TestimonialsColumns } from "./TestimonialsColumns";
import s from "./Landing.module.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-landing", display: "swap" });

/* Real app captures, status bar cropped, personal details replaced with sample data. */
const SHOT = { width: 640, height: 1235 };

function Phone({ src, alt, priority = false, sizes = "(max-width: 880px) 70vw, 300px" }: { src: string; alt: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={s.phone}>
      <Image className={s.screen} src={src} alt={alt} width={SHOT.width} height={SHOT.height} sizes={sizes} priority={priority} />
    </div>
  );
}

type IconName = "pill" | "calendar" | "heart" | "folder" | "shield" | "card" | "moon" | "check" | "arrow" | "plus";

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const p: Record<IconName, ReactNode> = {
    pill: <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
    folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M12 9v6M9 12h6" />
      </>
    ),
    moon: <path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z" />,
    check: <path d="M5 12l5 5 9-10" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p[name]}
    </svg>
  );
}

const marquee = ["Medications", "Appointments", "How I'm Feeling", "Health Records", "Wellbeing", "Care & Support", "Emergency Card", "Sick Mode", "Ramadan Mode", "App Lock"];

const tools: { icon: IconName; title: string; body: string }[] = [
  { icon: "pill", title: "Medications", body: "Schedules, doses and reminders" },
  { icon: "calendar", title: "Appointments", body: "Upcoming visits and prep notes" },
  { icon: "heart", title: "How I'm Feeling", body: "Daily log, symptoms, monthly check-in" },
  { icon: "folder", title: "Health Records", body: "Vitals, labs, imaging, timeline" },
];

const stats = [
  { n: "6", label: "Themes" },
  { n: "8", label: "Accent colors" },
  { n: "4", label: "Wallpapers" },
  { n: "3", label: "Surface styles" },
];

const privacyPoints = [
  "Stored on your iPhone by default",
  "No account needed",
  "Nothing syncs on its own",
  "Backups are files you keep",
  "App Lock with Face ID",
  "Apple Health import, read-only",
  "Not a medical device",
  "Every look is free",
];

const faqs = [
  {
    q: "Do I need an account?",
    a: "No. You can track medications, visits and check-ins without signing in. An account is optional.",
  },
  {
    q: "Where does my information live?",
    a: "On your iPhone, by default. You can export a backup file, restore from it, or delete what's stored. Automatic syncing and iCloud backup are not part of this version.",
  },
  {
    q: "How do medication reminders work?",
    a: "Add a medication, set a dose time, and Synapse schedules a local notification on your iPhone. From the notification you can mark it taken or snooze it for 10 minutes.",
  },
  {
    q: "How do I back up or restore?",
    a: "Use Backup & Restore in the app to export a file. Restoring from it replaces what's currently on that device, so it works well when you switch phones.",
  },
  {
    q: "Which permissions does it ask for?",
    a: "Face ID if you turn on App Lock. Apple Health only to read vitals you choose to import. Calendar and Photos only when you use those features.",
  },
  {
    q: "Is Synapse medical advice?",
    a: "No. Synapse is a personal wellness and organization app. It doesn't diagnose or treat, and it doesn't contact emergency services for you.",
  },
];

export function Landing() {
  return (
    <div className={`${s.page} ${dmSans.variable}`}>
      {/* HERO */}
      <section className={s.hero}>
        <div className={s.wrap}>
          <div className={s.heroGrid}>
            <div className={s.heroText}>
              <span className={s.badge}>Your health companion for iPhone</span>
              <h1 className={s.h1}>Your health life, finally in one place.</h1>
              <p className={s.lede}>Medications, appointments, records and the details you keep. Stored on your iPhone by default. No account needed.</p>
              <AppStoreLink className={s.primary} placement="hero">
                Download on the App Store <Icon name="arrow" size={18} />
              </AppStoreLink>
            </div>
            <div className={s.heroMedia}>
              <div className={s.glow} aria-hidden="true" />
              <Phone
                src="/screens/home-evergreen.webp"
                alt="Synapse home screen with the next medication, an upcoming appointment, a check-in card and Sick Mode."
                priority
                sizes="(max-width: 880px) 70vw, 320px"
              />
              <div className={s.floatChip} aria-hidden="true">
                <Icon name="shield" size={18} />
                Activate Sick Mode
              </div>
            </div>
          </div>
        </div>

        <div className={s.marqueeBlock}>
          <p className={s.kicker}>
            Everything in <span>one app</span>
          </p>
          <div className={s.marquee}>
            <ul className={s.track}>
              {[...marquee, ...marquee].map((m, i) => (
                <li key={i} aria-hidden={i >= marquee.length ? true : undefined}>
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* DAILY TOOLS */}
      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.head}>
            <p className={s.kicker}>
              Your <span>daily tools</span>
            </p>
            <h2 className={s.h2}>Everything you manage, one tab.</h2>
          </div>
          <ul className={s.toolGrid}>
            {tools.map((t) => (
              <li key={t.title} className={s.tool}>
                <span className={s.toolIcon}>
                  <Icon name={t.icon} />
                </span>
                <h3 className={s.h3}>{t.title}</h3>
                <p className={s.small}>{t.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* SHOWCASE */}
      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.showGrid}>
            <article className={s.showCard}>
              <div className={s.showText}>
                <p className={s.kicker}>
                  Your <span>profile</span>
                </p>
                <h3 className={s.h3Big}>The details doctors always ask for.</h3>
                <p className={s.body}>Conditions, allergies, vaccines and past surgeries, kept where you can find them, with a nudge to save a backup.</p>
              </div>
              <div className={s.showPhone}>
                <Phone src="/screens/you-settings.webp" alt="You & Settings screen with Profile, Conditions, Allergy & Emergency Info, Vaccines and Surgeries." sizes="(max-width: 880px) 60vw, 240px" />
              </div>
            </article>
            <article className={s.showCard}>
              <div className={s.showText}>
                <p className={s.kicker}>
                  Your <span>pace</span>
                </p>
                <h3 className={s.h3Big}>Simple when you need it.</h3>
                <p className={s.body}>Simple Mode gives you bigger controls and fewer distractions. Ramadan Mode adds fasting-aware tools and schedules.</p>
              </div>
              <div className={s.showPhone}>
                <Phone src="/screens/preferences.webp" alt="Preferences screen with Simple Mode, Full Mode, Appearance Studio and a Ramadan Mode toggle." sizes="(max-width: 880px) 60vw, 240px" />
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className={s.sectionTight}>
        <div className={s.wrap}>
          <div className={s.head}>
            <p className={s.kicker}>
              Appearance <span>Studio</span>
            </p>
            <h2 className={s.h2}>Make it feel like yours.</h2>
          </div>
          <dl className={s.stats}>
            {stats.map((st) => (
              <div key={st.label} className={s.stat}>
                <dt>{st.label}</dt>
                <dd>{st.n}</dd>
              </div>
            ))}
          </dl>
          <p className={s.statNote}>Every option is included for everyone.</p>
        </div>
      </section>

      {/* BANNER */}
      <section className={s.sectionTight}>
        <div className={s.wrap}>
          <div className={s.banner}>
            <div className={s.bannerText}>
              <h2 className={s.h2Light}>Private by design, not by promise.</h2>
              <p className={s.body}>Your health logs stay on your phone unless you choose to export them.</p>
            </div>
            <Link className={s.primary} href="/privacy">
              How privacy works <Icon name="arrow" size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* PRIVACY SPLIT */}
      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.split}>
            <div className={s.splitText}>
              <p className={s.kicker}>
                Synapse <span>privacy</span>
              </p>
              <h2 className={s.h2}>You control what leaves your phone.</h2>
              <p className={s.body}>No servers holding your history. No account wall. You decide when anything moves.</p>
              <ul className={s.checks}>
                {privacyPoints.map((pt) => (
                  <li key={pt}>
                    <Icon name="check" size={18} />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
            <div className={s.splitMedia}>
              <Phone src="/screens/health-hub.webp" alt="Health tab listing Medications, Appointments, How I'm Feeling, Health Records, Wellbeing and Care & Support." sizes="(max-width: 880px) 70vw, 300px" />
            </div>
          </div>
        </div>
      </section>

      {/* ALWAYS BY YOUR SIDE */}
      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.head}>
            <p className={s.kicker}>
              Always <span>by your side</span>
            </p>
            <h2 className={s.h2}>Built for the hard days too.</h2>
          </div>
          <div className={s.waveCard}>
            <svg className={s.wave} viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 120 L120 110 L200 70 L280 112 L380 96 L470 120 L560 60 L640 104 L720 92 L820 118 L900 86 L990 110 L1080 80 L1200 104 L1200 200 L0 200 Z" className={s.waveFill} />
              <path d="M0 120 L120 110 L200 70 L280 112 L380 96 L470 120 L560 60 L640 104 L720 92 L820 118 L900 86 L990 110 L1080 80 L1200 104" className={s.waveLine} />
            </svg>
            <ul className={s.sideRow}>
              {[
                { icon: "shield" as IconName, t: "Sick Mode", b: "One tap to a calmer screen with just the basics." },
                { icon: "card" as IconName, t: "Emergency Card", b: "Allergies, medications and contacts, ready to show." },
                { icon: "moon" as IconName, t: "Ramadan Mode", b: "Fasting-aware tools and schedules." },
              ].map((x) => (
                <li key={x.t} className={s.side}>
                  <span className={s.sideIcon}>
                    <Icon name={x.icon} size={26} />
                  </span>
                  <h3 className={s.h3}>{x.t}</h3>
                  <p className={s.small}>{x.b}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
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

      {/* FAQ */}
      <section className={s.section}>
        <div className={s.wrapNarrow}>
          <div className={s.head}>
            <p className={s.kickerCaps}>Popular questions</p>
            <h2 className={s.h2}>Learn more about Synapse</h2>
          </div>
          <div className={s.faq}>
            {faqs.map((f) => (
              <details key={f.q} className={s.faqItem}>
                <summary>
                  {f.q}
                  <span className={s.faqIcon}>
                    <Icon name="plus" size={20} />
                  </span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* DOWNLOAD */}
      <section className={s.download}>
        <div className={s.wrap}>
          <div className={s.downloadGrid}>
            <div className={s.downloadText}>
              <span className={s.badge}>Built for iPhone</span>
              <h2 className={s.downloadH2}>Your health, in your pocket.</h2>
              <p className={s.lede}>Keep your medications, visits and records together, and open them in seconds.</p>
              <AppStoreLink className={s.primary} placement="download">
                Download on the App Store <Icon name="arrow" size={18} />
              </AppStoreLink>
              <p className={s.small}>No account needed. Your data stays on your iPhone by default.</p>
            </div>
            <div className={s.downloadMedia}>
              <div className={s.glow} aria-hidden="true" />
              <Phone src="/screens/home-blue.webp" alt="Synapse home screen in the Blue theme." sizes="(max-width: 980px) 70vw, 300px" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
