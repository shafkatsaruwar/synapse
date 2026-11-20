const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

export type ExpoPushResult = {
  tickets: ExpoPushTicket[];
  expiredTokens: string[];
};

/**
 * Send Expo push messages. Never include PHI or customer identity in title/body/data.
 * Marks DeviceNotRegistered tokens for cleanup by the caller.
 */
export async function sendExpoPushMessages(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = { kind: "owner_plus_purchase_alert" },
): Promise<ExpoPushResult> {
  if (tokens.length === 0) return { tickets: [], expiredTokens: [] };

  const messages = tokens.map((to) => ({
    to,
    sound: "default" as const,
    title,
    body,
    data,
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo push HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as { data?: ExpoPushTicket | ExpoPushTicket[] };
  const tickets = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
  const expiredTokens: string[] = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      const token = tokens[index];
      if (token) expiredTokens.push(token);
    }
  });

  return { tickets, expiredTokens };
}
