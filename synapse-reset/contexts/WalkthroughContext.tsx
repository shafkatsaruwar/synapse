import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { View } from "react-native";

export type WalkthroughMeasure = () => Promise<{ x: number; y: number; width: number; height: number } | null>;

type Register = (id: string, measure: WalkthroughMeasure) => void;
type Unregister = (id: string) => void;
type GetTarget = (id: string) => WalkthroughMeasure | undefined;

interface WalkthroughContextValue {
  registerTarget: Register;
  unregisterTarget: Unregister;
  getTarget: GetTarget;
  version: number;
}

const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  const targetsRef = useRef(new Map<string, WalkthroughMeasure>());
  const registerTarget = useCallback<Register>((id, measure) => {
    targetsRef.current.set(id, measure);
    setTick((t) => t + 1);
  }, []);
  const unregisterTarget = useCallback<Unregister>((id) => {
    if (!targetsRef.current.has(id)) return;
    targetsRef.current.delete(id);
    setTick((t) => t + 1);
  }, []);
  const getTarget = useCallback<GetTarget>((id) => targetsRef.current.get(id), []);
  const value = useMemo(
    () => ({ registerTarget, unregisterTarget, getTarget, version: tick }),
    [registerTarget, unregisterTarget, getTarget, tick]
  );
  return (
    <WalkthroughContext.Provider value={value}>
      {children}
    </WalkthroughContext.Provider>
  );
}

export function useWalkthroughTargets() {
  const ctx = useContext(WalkthroughContext);
  if (!ctx) return null;
  return ctx;
}

/** Measure a view ref in window coordinates. */
export function measureInWindow(
  ref: React.RefObject<View | null>
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!ref.current) {
      resolve(null);
      return;
    }
    ref.current.measureInWindow((x, y, width, height) => {
      resolve({ x, y, width, height });
    });
  });
}
