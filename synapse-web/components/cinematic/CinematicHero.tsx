"use client";

import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { sceneBridge } from "@/lib/animation/bridge";
import { heroCopy, phaseAt, phaseMidpoint, PHASES, type HeroCopy, type PanelId, type PhaseName } from "@/lib/animation/scene-sample";
import { panelFaces } from "@/lib/screens/draw";
import { track } from "@/lib/analytics";
import { ScrollTimeline } from "@/components/cinematic/ScrollTimeline";
import { ReducedHero } from "@/components/cinematic/ReducedHero";
import { Storyboard } from "@/components/cinematic/Storyboard";
import { AppStoreLink } from "@/components/ui/AppStoreLink";
import type { StudioScene as StudioSceneType } from "@/components/cinematic/StudioScene";

type Mode = "pending" | "3d" | "reduced" | "storyboard";
type StudioModule = typeof import("@/components/cinematic/StudioScene");

/** After load, stay quiet long enough for first paint before the studio compiles. */
const STUDIO_DELAY_MS = 3200;
const POSTER_IDS = ["medications", "appointments", "feeling", "emergency", "records"] as const satisfies readonly PanelId[];

function sameCopy(a: HeroCopy, b: HeroCopy) {
  return a.title === b.title && a.body === b.body && a.kicker === b.kicker && a.showRevealCta === b.showRevealCta && a.showIntroCta === b.showIntroCta;
}

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function HeroPoster({ leaving }: { leaving: boolean }) {
  return (
    <div className={`studio-poster${leaving ? " is-leaving" : ""}`} aria-hidden="true">
      {POSTER_IDS.map((id) => {
        const face = panelFaces[id];
        return (
          <article key={id} className={`poster-card poster-${id}`}>
            <p>{face.foreign}</p>
            <small>{face.foreignDetail}</small>
          </article>
        );
      })}
    </div>
  );
}

/**
 * Prefetch the studio during idle, but do not evaluate three.js until the page
 * has already painted — or until the visitor actually scrolls.
 */
function scheduleStudio(start: () => void) {
  let started = false;
  let timer = 0;
  const run = () => {
    if (started) return;
    started = true;
    window.clearTimeout(timer);
    window.removeEventListener("pointerdown", run);
    window.removeEventListener("keydown", run);
    window.removeEventListener("touchstart", run);
    window.removeEventListener("wheel", onIntent);
    window.removeEventListener("scroll", onScroll);
    start();
  };
  const onIntent = () => run();
  const onScroll = () => {
    if (window.scrollY > 24) run();
  };
  const arm = () => {
    timer = window.setTimeout(run, STUDIO_DELAY_MS);
  };
  if (document.readyState === "complete") arm();
  else window.addEventListener("load", arm, { once: true });
  window.addEventListener("pointerdown", run, { passive: true });
  window.addEventListener("keydown", run);
  window.addEventListener("touchstart", run, { passive: true });
  window.addEventListener("wheel", onIntent, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    started = true;
    window.clearTimeout(timer);
    window.removeEventListener("pointerdown", run);
    window.removeEventListener("keydown", run);
    window.removeEventListener("touchstart", run);
    window.removeEventListener("wheel", onIntent);
    window.removeEventListener("scroll", onScroll);
  };
}

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("pending");
  const [Scene, setScene] = useState<typeof StudioSceneType | null>(null);
  const [active, setActive] = useState(true);
  const [studioReady, setStudioReady] = useState(false);
  const [posterMounted, setPosterMounted] = useState(true);
  const [phase, setPhaseState] = useState<PhaseName>("INTRO");
  const [copy, setCopyState] = useState<HeroCopy>(() => heroCopy(0));

  const onPhase = useCallback((next: PhaseName) => {
    setPhaseState((current) => (current === next ? current : next));
  }, []);

  const onCopy = useCallback((next: HeroCopy) => {
    setCopyState((current) => (sameCopy(current, next) ? current : next));
  }, []);

  useEffect(() => {
    if (!studioReady) return;
    const timer = window.setTimeout(() => setPosterMounted(false), 700);
    return () => window.clearTimeout(timer);
  }, [studioReady]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("phase")?.toUpperCase() ?? "";
    const known = PHASES.some((item) => item.name === forced);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const weak = Boolean(connection?.saveData) || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2);
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    sceneBridge.mobile = mobile;
    sceneBridge.quality = mobile ? "low" : "high";

    if (reduce && !known) {
      setMode("reduced");
      return;
    }
    if (weak && !known) {
      setMode("storyboard");
      return;
    }
    if (known) {
      const progress = phaseMidpoint(forced as PhaseName);
      sceneBridge.progress = progress;
      sceneBridge.locked = true;
      setPhaseState(forced as PhaseName);
      setCopyState(heroCopy(progress));
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
    }

    let cancelled = false;
    const load = () => {
      import(/* webpackPrefetch: true, webpackChunkName: "studio" */ "@/components/cinematic/StudioScene")
        .then(async (mod: StudioModule) => {
          if (cancelled) return;
          await mod.warmStudioAssets();
          if (cancelled) return;
          setScene(() => mod.StudioScene);
          setMode("3d");
        })
        .catch(() => {
          if (!cancelled) setMode("storyboard");
        });
    };
    // A forced phase is a direct look at the studio, so it should not wait.
    const cancelSchedule = known ? (load(), () => {}) : scheduleStudio(load);
    return () => {
      cancelled = true;
      cancelSchedule();
    };
  }, []);

  useEffect(() => {
    if (mode !== "3d") return;
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        sceneBridge.visible = visible;
        setActive(visible);
        if (visible) sceneBridge.requestRender();
      },
      { threshold: 0.01 },
    );
    observer.observe(node);
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const apply = () => {
      sceneBridge.mobile = mobileQuery.matches;
      sceneBridge.quality = mobileQuery.matches ? "low" : "high";
    };
    mobileQuery.addEventListener("change", apply);
    return () => {
      observer.disconnect();
      mobileQuery.removeEventListener("change", apply);
    };
  }, [mode]);

  useEffect(() => {
    if (mode === "3d") track("hero_engagement", { phase });
  }, [mode, phase]);

  if (mode === "reduced") return <ReducedHero />;
  if (mode === "storyboard") return <Storyboard />;

  const showCopy = Boolean(copy.title);

  return (
    <section ref={sectionRef} className="cinematic" data-phase={phase} aria-label="Your health. Everywhere.">
      <div className="studio-layer" aria-hidden="true">
        {mode === "3d" && Scene ? (
          <SceneBoundary onError={() => setMode("storyboard")}>
            <Scene active={active} onReady={() => setStudioReady(true)} />
          </SceneBoundary>
        ) : null}
        {posterMounted ? <HeroPoster leaving={studioReady} /> : null}
      </div>
      <ScrollTimeline sectionRef={sectionRef} enabled={mode === "3d"} onPhase={onPhase} onCopy={onCopy} barRef={barRef} />
      <div className={`cinematic-sticky ${showCopy ? "is-captioned" : ""}`}>
        <div className={`hero-copy ${showCopy ? "is-visible" : ""}`}>
          <div aria-hidden="true">
            {copy.kicker ? <p className="eyebrow">{copy.kicker}</p> : null}
            <p className="hero-title">{copy.title}</p>
            {copy.body ? <p className="lede">{copy.body}</p> : null}
          </div>
          {copy.showIntroCta || copy.showRevealCta ? (
            <div className="hero-actions">
              <AppStoreLink placement={copy.showRevealCta ? "hero-reveal" : "hero-intro"} />
              {copy.showRevealCta ? (
                <a className="btn btn-text" href="#showcase">
                  Explore Synapse
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="progress-line" aria-hidden="true">
          <div ref={barRef} />
        </div>
      </div>
      <div className="story-transcript">
        <h1 id="hero-title">Your health life, finally in one place.</h1>
        <p>Your health. Everywhere. Medications. Appointments. Records. Important details. All in different places.</p>
        <p>Different apps. Different platforms. Different places to look.</p>
        <p>No more.</p>
        <p>Meet Synapse. Your personal health companion. Your health life, finally in one place.</p>
      </div>
    </section>
  );
}
