import type { AgentAction, SessionConfig } from "../types.js";

export interface SafetyVerdict {
  allowed: boolean;
  reason?: string;
  rewritten?: AgentAction;
}

const PURCHASE_LABEL =
  /\b(buy|purchase|subscribe|start\s+trial|confirm\s+payment|add\s+payment|pay\s+now|upgrade\s+now)\b/i;

const MESSAGE_LABEL =
  /\b(send\s+(message|sms|text|email)|share\s+via|message\s+caregiver|call\s+now)\b/i;

const ACCOUNT_LABEL =
  /\b(sign\s+in\s+with\s+apple|continue\s+with\s+google|create\s+account|log\s+in)\b/i;

/**
 * Controller-side safety filter. Vision agents can still *propose* risky taps;
 * this layer blocks execution in disposable simulator runs.
 */
export function reviewAction(
  action: AgentAction,
  config: SessionConfig,
  labelGuess?: string,
): SafetyVerdict {
  const label = labelGuess ?? ("labelGuess" in action ? action.labelGuess : undefined) ?? "";

  if (!config.allowPurchases && action.type === "tap" && PURCHASE_LABEL.test(label)) {
    return {
      allowed: false,
      reason: `Blocked purchase-like tap ("${label}"). Harness never triggers real purchases.`,
      rewritten: {
        type: "done",
        reason: "Located purchase control; stopped without confirming purchase (safety).",
      },
    };
  }

  if (!config.allowMessages && action.type === "tap" && MESSAGE_LABEL.test(label)) {
    return {
      allowed: false,
      reason: `Blocked messaging/share tap ("${label}").`,
      rewritten: { type: "back" },
    };
  }

  if (!config.allowRealAccounts && action.type === "tap" && ACCOUNT_LABEL.test(label)) {
    return {
      allowed: false,
      reason: `Blocked real-account tap ("${label}"). Prefer skip / continue without account.`,
      rewritten: {
        type: "tap",
        x: action.type === "tap" ? Math.min(0.95, action.x) : 0.5,
        y: action.type === "tap" ? Math.min(0.95, action.y + 0.12) : 0.7,
        labelGuess: "looking for Skip / Not now / Continue without account",
      },
    };
  }

  if (
    !config.allowNotifications &&
    action.type === "tap" &&
    /\b(allow|enable)\b.*\bnotification/i.test(label)
  ) {
    return {
      allowed: false,
      reason: "Blocked enabling real notifications.",
      rewritten: {
        type: "tap",
        x: 0.3,
        y: 0.62,
        labelGuess: "Don't Allow / Not now",
      },
    };
  }

  if (action.type === "type_text") {
    const text = action.text.toLowerCase();
    if (
      text.includes("@gmail.com") ||
      text.includes("@icloud.com") ||
      /\bpassword\b/i.test(label)
    ) {
      return {
        allowed: false,
        reason: "Blocked typing that looks like a real account credential.",
      };
    }
  }

  return { allowed: true };
}

export const SAFETY_BANNER = [
  "SAFETY MODE ON",
  "- No real purchases / StoreKit production buys",
  "- No real notifications opt-in when Skip is available",
  "- No real messaging / caregiver alerts",
  "- Fictional health data only",
].join("\n");
