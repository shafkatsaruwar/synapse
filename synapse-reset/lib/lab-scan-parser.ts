export type ParsedLabResult = {
  name: string;
  value: number;
  unit: string;
  referenceRange?: string;
  flag?: string;
  valuePrefix?: "<" | ">";
};

export type ParsedLabScan = {
  doctorName: string;
  date: string;
  testName: string;
  labFacility: string;
  notes: string;
  results: ParsedLabResult[];
};

const LAB_TEST_ALIASES: Record<string, string[]> = {
  Glucose: ["glucose", "blood glucose", "fasting glucose"],
  Hemoglobin: ["hemoglobin", "hgb", "hb"],
  WBC: ["wbc", "white blood cell", "white blood cells", "white blood count"],
  Platelets: ["platelets", "platelet count", "plt"],
  Creatinine: ["creatinine", "creat"],
  ALT: ["alt", "alanine aminotransferase", "sgpt"],
  AST: ["ast", "aspartate aminotransferase", "sgot"],
  Testosterone: ["testosterone", "total testosterone", "free testosterone"],
};

const LAB_UNITS = new Set([
  "mg/dl", "mmol/l", "g/dl", "ng/dl", "pg/ml", "iu/l", "u/l", "mcg/dl", "ug/dl",
  "meq/l", "mm/hr", "sec", "fl", "pg", "%", "k/ul", "m/ul", "x10e3/ul", "x10e6/ul",
  "cells/ul", "copies/ml", "ratio", "index", "ml/min", "g/l", "nmol/l", "pmol/l",
]);

const LAB_SKIP_LINE =
  /\b(mychart|epic|labcorp|quest|patient|mrn|medical record|account number|date of birth|dob|sex|gender|address|phone|fax|page \d|printed|generated|lab director|specimen|accession|client|requisition|npi|insurance|guarantor|ordering provider|performing lab|report status|disclaimer|continued on|see note|instructions|status:|not yet reviewed|care team|reviewed by|sign.?out|clinical info|fasting|random|source:|received:|reported:|collected by)\b/i;

const LAB_FLAG_WORDS = new Set(["low", "high", "critical", "abnormal", "normal", "panic"]);

export function parseLabResults(rawText: string): ParsedLabResult[] {
  const seen = new Set<string>();
  const results: ParsedLabResult[] = [];
  const lines = cleanLines(rawText);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (shouldSkipLabLine(line)) continue;

    const inline = parseInlineLabResult(line);
    if (inline) {
      pushLabResult(results, seen, inline);
      continue;
    }

    const block = parseLabResultBlock(lines, index);
    if (block) {
      pushLabResult(results, seen, block.result);
      index = block.nextIndex;
    }
  }

  return results.slice(0, 40);
}

export function parseLabScan(rawText: string): ParsedLabScan {
  const lines = cleanLines(rawText);
  const doctorLine = lines.find((line) => /\b(dr\.?|md|provider|ordered by|physician)\b/i.test(line)) ?? "";
  const results = parseLabResults(rawText);
  const testName = detectLabPanelName(lines, results);
  const labFacility = detectLabFacility(lines);
  const collectedDate = parseCollectedDate(rawText);

  return {
    doctorName: cleanDoctorName(doctorLine),
    date: collectedDate ?? parseDate(rawText),
    testName,
    labFacility,
    notes: buildLabNotes({ labFacility, results, lines }),
    results,
  };
}

export function formatLabValueDisplay(result: Pick<ParsedLabResult, "value" | "unit" | "valuePrefix">) {
  const prefix = result.valuePrefix ?? "";
  return `${prefix}${result.value} ${result.unit}`.trim();
}

function shouldSkipLabLine(line: string) {
  if (!line || line.length < 2) return true;
  if (LAB_SKIP_LINE.test(line)) return true;
  if (/^component(\s+result|\s+name|\s+value|\s+flag|\s+units|\s+reference)/i.test(line)) return true;
  if (/^(result|flag|units|reference(\s+range|\s+interval)?)$/i.test(line)) return true;
  if (/^collected\b/i.test(line) && !parseInlineLabResult(line)) return true;
  if (/^reference\s+(range|interval)\s+\d/i.test(line)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)) return true;
  if (/^age\s+\d+/i.test(line)) return true;
  if (/^(male|female)\b/i.test(line)) return true;
  if (/^[A-Z0-9]{6,}$/.test(line.replace(/\s/g, ""))) return true;
  return false;
}

function parseInlineLabResult(line: string): ParsedLabResult | null {
  const labeled = line.match(
    /^([A-Za-z][A-Za-z0-9\s./()-]{1,48}?)\s*:+\s*([<>]?\s*\d+(?:\.\d+)?)\s*([A-Za-z/%][A-Za-z0-9/%^µμ.-]{0,20})?(?:\s*\(([^)]+)\))?/i
  );
  if (labeled) {
    const parsedValue = parseLabNumericValue(labeled[2]);
    if (!parsedValue) return null;
    const unit = normalizeLabUnit(labeled[3]);
    if (!unit) return null;
    const name = mapLabTestName(labeled[1]);
    if (!isLikelyAnalyteName(name)) return null;
    const referenceRange = extractReferenceRange(labeled[4] ?? line) ?? findReferenceRangeOnNearbyLine(line);
    const flag = extractFlag(line);
    return {
      name,
      value: parsedValue.value,
      unit,
      ...(parsedValue.prefix ? { valuePrefix: parsedValue.prefix } : {}),
      ...(referenceRange ? { referenceRange } : {}),
      ...(flag ? { flag } : {}),
    };
  }

  const compact = line.match(
    /^([A-Za-z][A-Za-z0-9\s./()-]{1,48}?)\s+([<>]?\s*\d+(?:\.\d+)?)\s+(?:(Low|High|Critical|Abnormal|Normal)\s+)?([A-Za-z/%][A-Za-z0-9/%^µμ.-]{1,20})(?:\s+(.+))?$/i
  );
  if (compact) {
    const parsedValue = parseLabNumericValue(compact[2]);
    if (!parsedValue) return null;
    const unit = normalizeLabUnit(compact[4]);
    if (!unit) return null;
    const name = mapLabTestName(compact[1]);
    if (!isLikelyAnalyteName(name)) return null;
    const referenceRange = extractReferenceRange(compact[5] ?? line);
    const flag = compact[3] ?? extractFlag(line);
    return {
      name,
      value: parsedValue.value,
      unit,
      ...(parsedValue.prefix ? { valuePrefix: parsedValue.prefix } : {}),
      ...(referenceRange ? { referenceRange } : {}),
      ...(flag ? { flag } : {}),
    };
  }

  return null;
}

function parseLabResultBlock(lines: string[], startIndex: number): { result: ParsedLabResult; nextIndex: number } | null {
  const line = lines[startIndex];
  const valueLineMatch = line.match(
    /^([A-Za-z][A-Za-z0-9\s./()-]{1,48}?)\s*:?\s*([<>]?\s*\d+(?:\.\d+)?)\s*([A-Za-z/%][A-Za-z0-9/%^µμ.-]{0,20})?$/i
  );
  if (!valueLineMatch) return null;

  const parsedValue = parseLabNumericValue(valueLineMatch[2]);
  if (!parsedValue) return null;

  let unit = normalizeLabUnit(valueLineMatch[3]);
  let referenceRange: string | undefined;
  let flag: string | undefined;
  let nextIndex = startIndex;

  for (let offset = 1; offset <= 3 && startIndex + offset < lines.length; offset += 1) {
    const candidate = lines[startIndex + offset];
    if (shouldSkipLabLine(candidate) && !/^reference\b/i.test(candidate)) continue;

    if (!unit) {
      const unitOnly = candidate.match(/^([A-Za-z/%][A-Za-z0-9/%^µμ.-]{1,20})$/);
      if (unitOnly) unit = normalizeLabUnit(unitOnly[1]);
    }

    if (!referenceRange) {
      referenceRange = extractReferenceRange(candidate) ?? undefined;
    }

    if (!flag) {
      flag = extractFlag(candidate);
    }

    if (/^[A-Za-z][A-Za-z0-9\s./()-]{1,48}?\s*:?\s*[<>]?\s*\d/.test(candidate) && offset > 0) {
      break;
    }

    nextIndex = startIndex + offset;
    if (referenceRange && (flag || unit)) break;
  }

  if (!unit) return null;

  const name = mapLabTestName(valueLineMatch[1]);
  if (!isLikelyAnalyteName(name)) return null;

  return {
    result: {
      name,
      value: parsedValue.value,
      unit,
      ...(parsedValue.prefix ? { valuePrefix: parsedValue.prefix } : {}),
      ...(referenceRange ? { referenceRange } : {}),
      ...(flag ? { flag } : {}),
    },
    nextIndex,
  };
}

function pushLabResult(results: ParsedLabResult[], seen: Set<string>, result: ParsedLabResult) {
  const key = `${result.name.toLowerCase()}|${result.valuePrefix ?? ""}${result.value}|${result.unit.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  results.push(result);
}

function parseLabNumericValue(raw: string): { value: number; prefix?: "<" | ">" } | null {
  const cleaned = raw.replace(/\s+/g, "");
  const match = cleaned.match(/^([<>])?(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const value = Number(match[2]);
  if (!Number.isFinite(value)) return null;
  const prefix = match[1] === "<" || match[1] === ">" ? match[1] : undefined;
  return { value, prefix };
}

function normalizeLabUnit(raw?: string | null) {
  if (!raw) return "";
  const unit = raw.trim().replace(/\.$/, "");
  if (!unit || unit.length > 24) return "";
  if (/^(h|l|c|a|n)$/i.test(unit)) return "";
  if (/^\d+$/.test(unit)) return "";
  const normalized = unit.toLowerCase();
  if (LAB_UNITS.has(normalized)) return unit;
  if (/^(mg|g|ng|pg|mcg|ug|iu|u|meq|mmol|nmol|pmol|k|m|x10e\d+|cells|copies)\/?[a-z0-9%]+$/i.test(unit)) {
    return unit;
  }
  return "";
}

function extractReferenceRange(text: string) {
  const match = text.match(
    /(?:ref(?:erence)?(?:\s*range|\s*interval)?|normal(?:\s*range)?)\s*:?\s*([<>]?\s*\d+(?:\.\d+)?\s*[-–]\s*[<>]?\s*\d+(?:\.\d+)?(?:\s*[A-Za-z/%][A-Za-z0-9/%^µμ.-]*)?)/i
  );
  if (match?.[1]) return match[1].replace(/\s+/g, " ").trim();

  const bare = text.match(/\b(\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?(?:\s*[A-Za-z/%][A-Za-z0-9/%^µμ.-]*)?)\b/);
  if (bare?.[1] && /reference|range|interval/i.test(text)) {
    return bare[1].replace(/\s+/g, " ").trim();
  }

  if (/^\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?(?:\s*[A-Za-z/%][A-Za-z0-9/%^µμ.-]*)?$/i.test(text.trim())) {
    return text.trim().replace(/\s+/g, " ");
  }

  return undefined;
}

function findReferenceRangeOnNearbyLine(line: string) {
  return extractReferenceRange(line);
}

function extractFlag(text: string) {
  const labeled = text.match(/\bflag\s*:?\s*(low|high|critical|abnormal|normal)\b/i);
  if (labeled?.[1]) return titleCase(labeled[1]);

  const bare = text.trim();
  if (LAB_FLAG_WORDS.has(bare.toLowerCase())) return titleCase(bare);
  return undefined;
}

function isLikelyAnalyteName(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized || normalized.length < 2) return false;
  if (/^(reference range|reference interval|result|value|test|status|lab|collected|reported|page|years|year|male|female)$/.test(normalized)) {
    return false;
  }
  if (/^\d/.test(normalized)) return false;
  if (/\b(age|years old|street|avenue|suite|phone|patient)\b/.test(normalized)) return false;
  return true;
}

function mapLabTestName(rawName: string) {
  const normalized = rawName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const [canonical, aliases] of Object.entries(LAB_TEST_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) return canonical;
  }
  return titleCase(rawName.replace(/\b(result|value|test)\b/gi, "").trim());
}

function detectLabPanelName(lines: string[], results: ParsedLabResult[]) {
  const panelLine = lines.find((line) =>
    /^[A-Z0-9][A-Z0-9\s/&-]{3,}$/.test(line) &&
    !LAB_SKIP_LINE.test(line) &&
    !/\d/.test(line)
  );
  if (panelLine) return titleCase(panelLine.trim());

  if (results.length === 1) return results[0].name;
  if (results.length > 1) {
    const uniqueNames = new Set(results.map((result) => result.name));
    if (uniqueNames.size === 1) return results[0].name;
    return "Lab panel";
  }
  return "Lab Work";
}

function detectLabFacility(lines: string[]) {
  const facilityLine = lines.find((line) =>
    /\b(labcorp|quest diagnostics|mayo clinic|bioreference|arup|mayo medical)\b/i.test(line) ||
    (/\blab\b/i.test(line) && /\b(holyoke|boston|clinic|medical|hospital|center)\b/i.test(line))
  );
  if (!facilityLine) return "";
  return facilityLine.replace(/^lab\s*:?\s*/i, "").trim();
}

function parseCollectedDate(rawText: string) {
  const collected = rawText.match(/\bcollected\s+(?:on\s+)?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  if (!collected?.[1]) return undefined;

  const monthMatch = collected[1].match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i);
  if (monthMatch) {
    const date = new Date(`${monthMatch[1]} ${monthMatch[2]}, ${monthMatch[3] ?? new Date().getFullYear()}`);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const numeric = collected[1].match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (numeric) {
    const year = normalizeYear(numeric[3]);
    return `${year}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`;
  }

  return undefined;
}

function buildLabNotes(input: {
  labFacility: string;
  results: ParsedLabResult[];
  lines: string[];
}) {
  const parts: string[] = [];
  if (input.labFacility) parts.push(`Lab: ${input.labFacility}`);

  const statusLine = input.lines.find((line) => /not yet reviewed|pending review|preliminary/i.test(line));
  if (statusLine) parts.push(statusLine.trim());

  if (input.results.length === 0) {
    parts.push("Imported from scan — review extracted values before saving.");
    return parts.join("\n");
  }

  const flagged = input.results.filter((result) => result.flag);
  if (flagged.length) {
    parts.push(
      flagged
        .slice(0, 4)
        .map((result) => {
          const display = formatLabValueDisplay(result);
          return `${result.name}: ${display}${result.flag ? ` (${result.flag})` : ""}`;
        })
        .join("; ")
    );
  }

  return parts.join("\n").slice(0, 400);
}

function cleanLines(rawText: string) {
  return rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseDate(rawText: string) {
  const numeric = rawText.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (numeric) {
    const year = normalizeYear(numeric[3]);
    return `${year}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`;
  }

  const month = rawText.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i);
  if (month) {
    const date = new Date(`${month[1]} ${month[2]}, ${month[3] ?? new Date().getFullYear()}`);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function normalizeYear(year: string) {
  if (year.length === 4) return year;
  const value = parseInt(year, 10);
  return `${value > 70 ? 1900 + value : 2000 + value}`;
}

function cleanDoctorName(value: string) {
  return titleCase(
    value
      .replace(/^(ordered by|provider|physician)\s*:?\s*/i, "")
      .replace(/\b(md|m\.d\.)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bDr\b/g, "Dr.");
}
