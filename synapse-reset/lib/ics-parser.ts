export interface ParsedICSEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  phoneNumber: string;
  organizer: string;
}

function unfoldLines(text: string): string {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parseDateFromValue(value: string): { date: string; time: string } {
  // Handles: 20240315T130000Z, 20240315T130000, 20240315
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return { date: "", time: "" };
  const [, year, month, day, hour, minute] = match;
  return {
    date: `${year}-${month}-${day}`,
    time: hour != null && minute != null ? `${hour}:${minute}` : "",
  };
}

function extractPhone(text: string): string {
  const match = text.match(/(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function decodeICSText(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\N/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

export function parseICS(icsText: string): ParsedICSEvent | null {
  const unfolded = unfoldLines(icsText);
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  // Track last seen value per key (first VEVENT wins)
  const props: Record<string, { rawKey: string; value: string }> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") { inEvent = true; continue; }
    if (trimmed === "END:VEVENT") break;
    if (!inEvent || !trimmed) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;

    const rawKey = line.substring(0, colonIdx);
    const value = line.substring(colonIdx + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    // Keep first occurrence
    if (!(key in props)) props[key] = { rawKey, value };
  }

  const get = (key: string) => props[key]?.value ?? "";
  const dtStart = get("DTSTART");
  if (!dtStart) return null;

  const startParsed = parseDateFromValue(dtStart);
  const endParsed = parseDateFromValue(get("DTEND"));

  const title = decodeICSText(get("SUMMARY"));
  const location = decodeICSText(get("LOCATION"));
  const description = decodeICSText(get("DESCRIPTION"));
  const contact = get("CONTACT");

  // CN may appear in the rawKey: ORGANIZER;CN="Dr. Smith":mailto:...
  const organizerRawKey = props["ORGANIZER"]?.rawKey ?? "";
  const organizerCN = organizerRawKey.match(/CN="?([^":;]+)"?/i)?.[1]?.trim() ?? "";

  const phone =
    extractPhone(contact) ||
    extractPhone(description) ||
    extractPhone(location);

  return {
    title,
    date: startParsed.date,
    startTime: startParsed.time || "09:00",
    endTime: endParsed.time || "",
    location,
    notes: description,
    phoneNumber: phone,
    organizer: organizerCN,
  };
}
