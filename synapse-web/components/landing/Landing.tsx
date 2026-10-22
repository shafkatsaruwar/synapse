import Image from "next/image";
import Link from "next/link";
import { AppStoreLink } from "@/components/ui/AppStoreLink";
import s from "./Landing.module.css";

/* Screens are real app captures, status bar cropped, personal details replaced with sample data. */
const SHOT = { width: 640, height: 1235 };

function Phone({ src, alt, priority = false, sizes = "(max-width: 880px) 70vw, 300px" }: { src: string; alt: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={s.phone}>
      <Image className={s.screen} src={src} alt={alt} width={SHOT.width} height={SHOT.height} sizes={sizes} priority={priority} />
    </div>
  );
}

type IconName = "card" | "shield" | "heart" | "pulse" | "archive" | "lock";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M12 9v6M9 12h6" />
      </>
    ),
    shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
    heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
    pulse: <path d="M3 12h4l2-5 4 10 2-5h6" />,
    archive: (
      <>
        <rect x="3" y="4" width="18" height="5" rx="1" />
        <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const extras: { icon: IconName; title: string; body: string }[] = [
  { icon: "card", title: "Emergency Card", body: "Allergies, medications and contacts, ready to show." },
  { icon: "shield", title: "Sick Mode", body: "One tap to a calmer screen with just the basics." },
  { icon: "heart", title: "How I'm Feeling", body: "Daily log, symptoms and a monthly check-in." },
  { icon: "pulse", title: "Apple Health import", body: "Copy selected vitals onto your phone. Read-only." },
  { icon: "archive", title: "Backup & restore", body: "Export a file you keep. Restore it on a new phone." },
  { icon: "lock", title: "App Lock", body: "Face ID, Touch ID or your passcode." },
];

export function Landing() {
  return (
    <div className={s.page}>
      {/* HERO */}
      <section className={s.hero}>
        <div className={s.heroText}>
          <p className={s.eyebrow}>Health companion for iPhone</p>
          <h1 className={s.h1}>Your health life, finally in one place.</h1>
          <p className={s.lede}>
            Medications, appointments, records and the details you keep. Stored on your iPhone by default. No account needed.
          </p>
          <div className={s.actions}>
            <AppStoreLink className={s.primary} placement="hero">
              Download on the App Store
            </AppStoreLink>
            <a className={s.secondary} href="#inside">
              See what&apos;s inside
            </a>
          </div>
        </div>
        <div className={s.heroMedia}>
          <Phone
            src="/screens/home-blue.webp"
            alt="Synapse home screen: today's next medication, upcoming appointment, a check-in card and Sick Mode."
            priority
            sizes="(max-width: 880px) 72vw, 340px"
          />
        </div>
      </section>

      {/* STATEMENT */}
      <section className={s.statement} aria-label="Why Synapse">
        <p>
          Meds in one app. Appointments in another. Lab notes in a folder somewhere. <strong>No more.</strong>
        </p>
      </section>

      {/* FEATURE ROWS */}
      <section id="inside" className={s.rows}>
        <div className={s.row}>
          <div className={s.rowMedia}>
            <Phone src="/screens/health-hub.webp" alt="Health tab listing Medications, Appointments, How I'm Feeling, Health Records, Wellbeing and Care & Support." />
          </div>
          <div className={s.rowText}>
            <p className={s.num}>01</p>
            <h2 className={s.h2}>Everything you manage, one tab.</h2>
            <p className={s.body}>
              Medications with doses and reminders. Visits with prep notes. Labs, imaging and vitals in your records. Your doctors and pharmacies in one list.
            </p>
          </div>
        </div>

        <div className={`${s.row} ${s.flip}`}>
          <div className={s.rowMedia}>
            <Phone src="/screens/you-settings.webp" alt="You & Settings screen with Profile, Conditions, Allergy & Emergency Info, Vaccines, Surgeries and a backup reminder." />
          </div>
          <div className={s.rowText}>
            <p className={s.num}>02</p>
            <h2 className={s.h2}>The details doctors always ask for.</h2>
            <p className={s.body}>
              Conditions, allergies, vaccines and past surgeries, kept where you can find them. Synapse nudges you to save a backup, so switching phones doesn&apos;t mean starting over.
            </p>
          </div>
        </div>

        <div className={s.row}>
          <div className={s.rowMedia}>
            <Phone src="/screens/preferences.webp" alt="Preferences screen with Simple Mode, Full Mode, Appearance Studio, Menu sections and a Ramadan Mode toggle." />
          </div>
          <div className={s.rowText}>
            <p className={s.num}>03</p>
            <h2 className={s.h2}>Simple when you need it.</h2>
            <p className={s.body}>
              Simple Mode gives you bigger controls and fewer distractions. Ramadan Mode adds fasting-aware tools and schedules. Turn on only what fits your life.
            </p>
          </div>
        </div>
      </section>

      {/* THEMES */}
      <section className={s.themes}>
        <div className={s.themesHead}>
          <h2 className={s.h2}>Make it feel like yours.</h2>
          <p className={s.body}>Six themes, accent colors, wallpapers and surface styles. Every option is free for everyone.</p>
        </div>
        <ul className={s.themeRow}>
          {[
            { src: "/screens/home-evergreen.webp", name: "Evergreen" },
            { src: "/screens/home-blue.webp", name: "Blue" },
            { src: "/screens/home-red.webp", name: "Light" },
          ].map((t) => (
            <li key={t.name} className={s.themeItem}>
              <Phone src={t.src} alt={`Home screen in the ${t.name} theme.`} sizes="(max-width: 880px) 60vw, 260px" />
              <span className={s.themeName}>{t.name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ALSO INSIDE */}
      <section className={s.extras}>
        <h2 className={s.h2}>Also inside.</h2>
        <ul className={s.extraGrid}>
          {extras.map((e) => (
            <li key={e.title} className={s.extra}>
              <span className={s.extraIcon}>
                <Icon name={e.icon} />
              </span>
              <div>
                <h3 className={s.h3}>{e.title}</h3>
                <p className={s.small}>{e.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* PRIVACY */}
      <section className={s.privacy}>
        <div className={s.privacyInner}>
          <h2 className={s.h2}>You control what leaves your phone.</h2>
          <dl className={s.facts}>
            <div>
              <dt>On your device</dt>
              <dd>Health logs are stored on your iPhone by default.</dd>
            </div>
            <div>
              <dt>Account optional</dt>
              <dd>Track everything without signing in.</dd>
            </div>
            <div>
              <dt>No auto sync</dt>
              <dd>Nothing goes to a cloud on its own. Backups are files you export.</dd>
            </div>
          </dl>
          <Link className={s.textLink} href="/privacy">
            Read the full privacy details
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className={s.cta}>
        <h2 className={s.h2}>Start with what matters today.</h2>
        <AppStoreLink className={s.primary} placement="cta">
          Download on the App Store
        </AppStoreLink>
      </section>
    </div>
  );
}
