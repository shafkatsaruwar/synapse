"use client";

import { useEffect } from "react";
import { trackKatanaPageView } from "@/lib/katana";

export function KatanaPageView({ path }: { path: string }) {
  useEffect(() => {
    trackKatanaPageView(path);
  }, [path]);
  return null;
}
