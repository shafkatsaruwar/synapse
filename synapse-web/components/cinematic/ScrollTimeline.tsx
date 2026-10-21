"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { sceneBridge } from "@/lib/animation/bridge";
import { heroCopy, phaseAt, type HeroCopy, type PhaseName } from "@/lib/animation/scene-sample";
import { track } from "@/lib/analytics";

type Props = {
  sectionRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onPhase: (phase: PhaseName) => void;
  onCopy: (copy: HeroCopy) => void;
  barRef: RefObject<HTMLDivElement | null>;
};

export function ScrollTimeline({ sectionRef, enabled, onPhase, onCopy, barRef }: Props) {
  const onPhaseRef = useRef(onPhase);
  const onCopyRef = useRef(onCopy);
  onPhaseRef.current = onPhase;
  onCopyRef.current = onCopy;

  useEffect(() => {
    if (!enabled || sceneBridge.locked) return;
    let revert: (() => void) | undefined;
    let dead = false;
    const completed = { current: false };

    void (async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (dead || !sectionRef.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => {
            sceneBridge.progress = self.progress;
            onPhaseRef.current(phaseAt(self.progress));
            onCopyRef.current(heroCopy(self.progress));
            if (barRef.current) barRef.current.style.transform = `scaleX(${self.progress})`;
            if (!completed.current && self.progress > 0.985) {
              completed.current = true;
              track("scroll_completion");
            }
          },
        });
      }, sectionRef);
      revert = () => ctx.revert();
      if (dead) revert();
    })();

    return () => {
      dead = true;
      revert?.();
    };
  }, [barRef, enabled, sectionRef]);

  return null;
}
