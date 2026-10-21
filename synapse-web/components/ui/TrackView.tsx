"use client";

import { useEffect } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

export function TrackView({ event, id }: { event: AnalyticsEvent; id?: string }) {
  useEffect(() => {
    track(event, id ? { id } : undefined);
  }, [event, id]);
  return null;
}
