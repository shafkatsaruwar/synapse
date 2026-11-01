const ROUTE = /^\/[a-zA-Z0-9/_-]*$/;

function uuid() {
  return globalThis.crypto.randomUUID();
}

function visitorId(siteId: string) {
  const key = `katana:${siteId}`;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as
      | { day?: string; id?: string }
      | null;
    if (saved?.day === day && saved.id) return saved.id;
    const id = uuid();
    window.localStorage.setItem(key, JSON.stringify({ day, id }));
    return id;
  } catch {
    return uuid();
  }
}

/** Sends one reviewed, static route label to Katana. No URL, query, referrer, or user data is read. */
export function trackKatanaPageView(path: string) {
  if (typeof window === "undefined") return;
  const endpoint = process.env.NEXT_PUBLIC_KATANA_ENDPOINT;
  const siteId = process.env.NEXT_PUBLIC_KATANA_SITE_ID;
  if (!endpoint || !siteId || !ROUTE.test(path) || path.length > 200) return;

  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:") return;
    url.searchParams.set("site", siteId);
  } catch {
    return;
  }

  const body = JSON.stringify({
    site_id: siteId,
    event_id: uuid(),
    visitor_id: visitorId(siteId),
    path,
  });
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "omit",
    keepalive: true,
    body,
  }).catch(() => {});
}
