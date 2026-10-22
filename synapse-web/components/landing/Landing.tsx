import Link from "next/link";
import { Outfit } from "next/font/google";
import { AppStoreLink } from "@/components/ui/AppStoreLink";
import s from "./Landing.module.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-landing",
  display: "swap",
});

function PhotoSlot({ label, className }: { label: string; className?: string }) {
  // Placeholder until real photography lands in /public. Swap for <Image>.
  return (
    <div className={`${s.photo} ${className ?? ""}`} role="img" aria-label={label}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="11" r="2" />
        <path d="M21 17l-5-5-9 7" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function Check({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function HeroPhone() {
  return (
    <div className={s.heroPhone} aria-hidden="true">
      <div className={s.heroScreen}>
        <div className={s.island} />
        <div className={s.row}>
          <div className={s.greet}>
            <div className={s.avatar} />
            <div>
              <div className={s.tiny}>Good morning,</div>
              <div className={s.strong}>Alex</div>
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10 21h4" />
          </svg>
        </div>
        <div className={s.screenCard}>
          <div className={s.bigStat}>
            <span className={s.bigNum}>2</span>
            <span>
              doses left
              <br />
              <span className={s.tiny}>today</span>
            </span>
          </div>
          <div className={s.row}>
            <span>
              <b>2:00 PM</b>
              <br />
              <span className={s.tiny}>Next dose</span>
            </span>
            <span className={s.right}>
              <b>Steady</b>
              <br />
              <span className={s.tiny}>Today&apos;s mood</span>
            </span>
          </div>
        </div>
        <div className={s.screenEmergency}>
          <div className={s.row}>
            <span>EMERGENCY CARD</span>
            <span className={s.redDot}>●</span>
          </div>
          <div className={s.bar} style={{ width: "70%" }} />
          <div className={s.bar} style={{ width: "50%", opacity: 0.7 }} />
          <div className={s.bar} style={{ width: "60%", opacity: 0.7 }} />
        </div>
        <div className={s.screenButton}>Log today</div>
        <div className={s.tiny}>This week</div>
        <div className={s.week}>
          {["#CFE2FB", "#CFE2FB", "#7FB3F5", "#CFE2FB", "#E6EDF5", "#E6EDF5", "#E6EDF5"].map((c, i) => (
            <div key={i} style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div className={`${s.page} ${outfit.variable}`}>
      {/* HERO */}
      <section className={s.hero}>
        <h1 className={s.h1}>
          Your health, kept close.
          <br />
          <span className={s.dim}>Private. Simple. Yours.</span>
        </h1>
        <p className={s.lede}>
          Meds, appointments, records and your emergency card in one calm app. No account needed. Your health logs stay on your iPhone.
        </p>
        <AppStoreLink className={s.pill} placement="hero">
          Download on the App Store
        </AppStoreLink>

        <div className={s.stage}>
          <PhotoSlot label="Your photo" className={`${s.float} ${s.photoLeft}`} />
          <div className={`${s.float} ${s.lockBadge}`} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>

          <div className={`${s.float} ${s.floatCard} ${s.apptCard}`} aria-hidden="true">
            <div className={s.row}>
              <span className={s.tiny}>Next appointment</span>
              <span className={s.blue}>Tue</span>
            </div>
            <div className={s.cardTitle}>Follow-up visit</div>
            <div className={s.row}>
              <span className={s.soft}>2:30 PM</span>
              <span className={s.chipBlue}>Leave by 2:00</span>
            </div>
          </div>

          <PhotoSlot label="Your photo" className={`${s.float} ${s.photoRight}`} />

          <div className={`${s.float} ${s.floatCard} ${s.medCard}`} aria-hidden="true">
            <div className={s.row}>
              <span className={s.tiny}>Morning dose</span>
              <span className={s.chipGreen}>Taken</span>
            </div>
            <div className={s.row}>
              <span className={s.tiny}>Evening dose</span>
              <b>8:00 PM</b>
            </div>
            <div className={s.row}>
              <span className={s.tiny}>As needed</span>
              <b>PRN</b>
            </div>
          </div>

          <div className={`${s.float} ${s.dataLives}`}>
            <div className={s.dataTitle}>Where your logs live</div>
            <div className={s.tags}>
              <span>YOUR IPHONE</span>
              <span>BY DEFAULT</span>
            </div>
          </div>

          <HeroPhone />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={s.band}>
        <div className={s.darkPanel}>
          <h2 className={s.h2}>
            <span className={s.dimDark}>How it</span> works?
          </h2>
          <div className={s.howRow}>
            <div className={s.howCol}>
              <div className={`${s.step} ${s.stepOutlined}`}>
                <div className={s.stepNum}>STEP 2</div>
                <div className={s.stepTitle}>Set up your emergency card</div>
                <p>Add conditions, allergies, meds and who to call. Ready to show in seconds.</p>
              </div>
            </div>

            <div className={s.formPhone} aria-hidden="true">
              <div className={s.formScreen}>
                <div className={s.island} />
                <div className={s.formHead}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  Emergency Card
                </div>
                <div className={s.field}>Conditions</div>
                <div className={s.field}>Allergies</div>
                <div className={s.field}>Current medications</div>
                <div className={s.field}>Emergency contact</div>
                <div className={s.grow} />
                <div className={s.save}>Save</div>
              </div>
            </div>

            <div className={s.howCol}>
              <div className={s.step}>
                <div className={s.stepNum}>STEP 1</div>
                <div className={s.stepTitle}>Download. That&apos;s it.</div>
                <p>No sign-up needed to start tracking.</p>
              </div>
              <div className={s.step}>
                <div className={s.stepNum}>STEP 3</div>
                <div className={s.stepTitle}>Check in each day</div>
                <p>Log meds and how you feel. Synapse keeps it on your phone.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KEY FEATURES */}
      <section className={`${s.band} ${s.bandBottom}`} id="features">
        <div className={s.whitePanel}>
          <h2 className={s.h2}>
            Key <span className={s.dim}>features</span>
          </h2>

          <div className={s.grid3}>
            <article className={s.tile}>
              <div className={s.medArt} aria-hidden="true">
                <div className={s.medA}>
                  Morning
                  <b>8:00 AM</b>
                </div>
                <div className={s.medB}>
                  Evening
                  <b>8:00 PM</b>
                </div>
              </div>
              <h3>Medications</h3>
              <p>Schedules, doses and reminders, so nothing slips.</p>
            </article>

            <article className={s.tile}>
              <h3>Appointments</h3>
              <p>Upcoming visits and the notes you want to bring.</p>
              <div className={s.apptArt} aria-hidden="true">
                <div className={s.row} style={{ justifyContent: "flex-start", gap: 10 }}>
                  <div className={s.dateBox}>
                    <span>TUE</span>
                    <b>27</b>
                  </div>
                  <div>
                    <b>Follow-up</b>
                    <div className={s.tiny}>2:30 PM</div>
                  </div>
                </div>
                <div className={s.line} style={{ width: "80%" }} />
                <div className={s.line} style={{ width: "60%" }} />
              </div>
            </article>

            <article className={s.tile}>
              <h3>Emergency Card</h3>
              <p>Your key info, one tap away when it matters most.</p>
              <div className={s.miniPhone} aria-hidden="true">
                <div className={s.checkCircle}>
                  <Check size={20} color="#fff" />
                </div>
                <b>Card ready</b>
              </div>
            </article>
          </div>

          <div className={s.grid2}>
            <article className={`${s.tile} ${s.wide}`}>
              <div className={s.wideText}>
                <h3>Health Records</h3>
                <p>Labs, conditions and allergies you choose to keep. Added by you, kept by you.</p>
              </div>
              <div className={s.listCard} aria-hidden="true">
                <div className={s.row}>
                  <b>Records</b>
                  <span className={s.blue}>›</span>
                </div>
                <div className={s.row}><span>Lab results</span><span className={s.tiny}>Added by you</span></div>
                <div className={s.row}><span>Allergies</span><span className={s.tiny}>2 items</span></div>
                <div className={s.row}><span>Conditions</span><span className={s.tiny}>1 item</span></div>
              </div>
            </article>

            <article className={`${s.tile} ${s.wide} ${s.tileDark}`}>
              <div className={s.wideText}>
                <h3>Sick Mode</h3>
                <p>A calmer screen for bad days. Just the basics, nothing extra.</p>
              </div>
              <div className={s.listCardDark} aria-hidden="true">
                {["Temperature", "Hydration", "Rest"].map((item) => (
                  <div className={s.row} key={item}>
                    <span>{item}</span>
                    <span className={s.logChip}>Log</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* PRIVACY SPLIT */}
      <section className={s.split}>
        <div className={s.splitMedia}>
          <PhotoSlot label="Lifestyle photo: someone using Synapse" className={s.photoWide} />
          <div className={s.savedBadge} aria-hidden="true">
            <b>
              <Check color="#1F6FC5" /> Saved
            </b>
            <span className={s.tiny}>On this iPhone</span>
          </div>
        </div>
        <div className={s.splitText}>
          <h2 className={s.h2Left}>
            Your logs stay <span className={s.dim}>with you.</span>
          </h2>
          <p>
            Health logs are stored on your device by default. No account is required, and nothing syncs to a cloud on its own. You decide if
            anything leaves, like a backup file you export yourself.
          </p>
          <Link className={s.textLink} href="/privacy">
            Read how privacy works →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className={s.ctaWrap}>
        <div className={s.cta}>
          <div className={s.ctaText}>
            <div className={s.ctaKicker}>No account needed. No more scattered notes.</div>
            <h2 className={s.h2Left}>Start with Synapse today</h2>
            <AppStoreLink className={s.pillWhite} placement="cta">
              Download on the App Store
            </AppStoreLink>
          </div>
          <div className={s.ctaPhoneWrap} aria-hidden="true">
            <div className={s.ctaPhone}>
              <div className={s.ctaScreen}>
                <div className={s.island} />
                <b className={s.cardTitle}>Today</b>
                <div className={s.miniRow}><span>Morning dose</span><span className={s.green}>Taken</span></div>
                <div className={s.miniRow}><span>Mood</span><b>Steady</b></div>
                <div className={s.miniDark}>EMERGENCY CARD</div>
                <div className={s.miniButton}>Log today</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
