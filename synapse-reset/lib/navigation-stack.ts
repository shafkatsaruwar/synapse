import { getParentHub, isKnownNavKey, resolveNavKey } from "@/lib/navigation-registry";

export type NavStackState = {
  screen: string;
  /** Screens behind the current one (oldest → newest parent). */
  stack: string[];
};

const TOP_LEVEL = new Set([
  "dashboard",
  "medications",
  "appointments",
  "feelinghub",
  "recordshub",
  "wellbeinghub",
  "carehub",
  "emergencyhub",
  "accounthub",
]);

export function isTopLevelNav(key: string): boolean {
  return TOP_LEVEL.has(resolveNavKey(key));
}

/**
 * Compute next navigation state.
 * - Top-level destinations reset the stack.
 * - Child destinations push the current screen when leaving a hub (or known parent).
 * - Repeated taps on the same screen are no-ops for stack growth.
 */
export function pushNav(
  current: NavStackState,
  rawTarget: string,
  options?: { reset?: boolean; source?: string }
): NavStackState {
  const target = resolveNavKey(rawTarget);
  if (!target) return current;

  if (target === current.screen && !options?.reset) {
    return current;
  }

  if (options?.reset || isTopLevelNav(target)) {
    return { screen: target, stack: [] };
  }

  const parent = getParentHub(target);
  // Prefer explicit parent hub when leaving a hub for its child
  if (parent && current.screen === parent) {
    return { screen: target, stack: [...current.stack, parent] };
  }

  // If we already have a sensible parent on the stack, just replace screen
  if (parent && current.stack[current.stack.length - 1] === parent) {
    return { screen: target, stack: current.stack };
  }

  // Crossing from another screen into a child: record parent hub if known
  if (parent) {
    return { screen: target, stack: [...current.stack, parent] };
  }

  // Unknown parent — push current as back target if different
  if (current.screen && current.screen !== target) {
    return { screen: target, stack: [...current.stack, current.screen] };
  }

  return { screen: target, stack: current.stack };
}

export function popNav(current: NavStackState, fallback = "dashboard"): NavStackState {
  if (current.stack.length === 0) {
    const parent = getParentHub(current.screen);
    if (parent) return { screen: parent, stack: [] };
    return { screen: fallback, stack: [] };
  }
  const stack = [...current.stack];
  const screen = stack.pop()!;
  return { screen, stack };
}

export type NavResolveResult =
  | { ok: true; key: string }
  | { ok: false; reason: "unknown" | "flag_disabled" | "role_denied"; key: string };

export function resolveNavigationRequest(
  raw: string,
  opts?: { knownCheck?: (k: string) => boolean }
): NavResolveResult {
  const key = resolveNavKey(raw);
  const check = opts?.knownCheck ?? isKnownNavKey;
  if (!key || !check(key)) {
    return { ok: false, reason: "unknown", key: raw || "(empty)" };
  }
  return { ok: true, key };
}
