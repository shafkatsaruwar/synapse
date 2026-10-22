"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { sceneBridge } from "@/lib/animation/bridge";
import { heroCopy, phaseAt, sectionProgress, type HeroCopy, type PhaseName } from "@/lib/animation/scene-sample";
import { track } from "@/lib/analytics";

type Props = {
  sectionRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onPhase: (phase: PhaseName) => void;
  onCopy: (copy: HeroCopy) => void;
  barRef: RefObject<HTMLDivElement | null>;
};

/**
 * Scroll progress drives the same scene sample as before.
 * A native listener replaces GSAP's ticker, which kept scheduling frames
 * even when the visitor was not scrolling.
 */
export function ScrollTimeline({ sectionRef, enabled, onPhase, onCopy, barRef }: Props) {
  const onPhaseRef = useRef(onPhase);
  const onCopyRef = useRef(onCopy);
  onPhaseRef.current = onPhase;
  onCopyRef.current = onCopy;

  useEffect(() => {
    if (!enabled || sceneBridge.locked) return;
    const node = sectionRef.current;
    if (!node) return;
    let frame = 0;
    let completed = false;

    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const progress = sectionProgress(rect.top, rect.height, window.innerHeight);
      sceneBridge.progress = progress;
      onPhaseRef.current(phaseAt(progress));
      onCopyRef.current(heroCopy(progress));
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
      sceneBridge.requestRender();
      if (!completed && progress > 0.985) {
        completed = true;
        track("scroll_completion");
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [barRef, enabled, sectionRef]);

  return null;
}
