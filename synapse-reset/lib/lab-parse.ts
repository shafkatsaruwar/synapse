import type { LabResult } from "@/lib/storage";

/**
 * Pure lab-report parsing logic, deliberately free of any React Native / native
 * imports so it can be unit-tested in plain Node.
 */

const LAB_TEST_ALIASES: Record<string, string[]> = {
  Glucose: ["glucose", "blood glucose", "fasting glucose"],
  Hemoglobin: ["hemoglobin", "hgb", "hb"],
  WBC: ["wbc", "white blood cell", "white blood cells", "white blood count"],
  Platelets: ["platelets", "platelet count", "plt"],
  Creatinine: ["creatinine", "creat"],
  ALT: ["alt", "alanine aminotransferase", "sgpt"],
  AST: ["ast", "aspartate aminotransferase", "sgot"],
  Testosterone: ["testosterone", "total testosterone"],
  "T4, Free": ["t4 free", "free t4", "free thyroxine", "t4, free"],
  "IGF-1": [
    "igf-1",
    "igf 1",
    "insulin like growth factor 1",
    "insulin-like growth factor 1",
    "insulin-like growth factor-1",
  ],
};

// Qualitative results that are valid values but are not numbers or units.
const QUALITATIVE_VALUE =
  /^(positive|negative|detected|not\s+detected|reactive|non-?reactive|normal|abnormal|present|absent|trace|none|equivocal|indeterminate|borderline)$/i;

// Trailing flag words on a result line ("<3 Low", "1.2 H"). Never a unit or a name.
const FLAG_WORD = /^(low|high|normal|abnormal|critical|panic|h|l|a|c|hh|ll)$/i;

// Prose, citations, headings and metadata that must never become a lab result.
const JUNK_LINE =
  /(\bet\.?\s*al\b|\bpmid\b|\bdoi\b|\bjcem\b|reference interval|based on a population|nonobese|years old|copyright|all rights reserved|not yet reviewed|learn more|additional information|view trends|compare result|performed at|lab director|collected on|\breported\b|ordered by|specimen|accession|\bpatient\b|\bprovider\b|\bphysician\b|\baddress\b|\bphone\b|\bfax\b|\bdob\b|\bmrn\b|\bsuite\b)/i;

// A number, optionally qualified with a comparator/sign: <3, ≥916, -0.4, 3.2
const NUMERIC_VALUE = /^[<>≤≥]?[-+]?\d+(?:\.\d+)?$/;

type ParsedValue = { value: string; unit?: string; flag?: string };

/**
 * Extract structured lab results from OCR'd text.
 *
 * Handles two common layouts:
 *  - MyChart-style, where a test name, a "Normal range: A - B unit" line and a
 *    "Value X" line appear on separate lines.
 *  - Tabular reports, where "Name value unit [range]" appear on one line.
 *
 * Non-numeric/qualified values (e.g. "<3", "Positive") are preserved, and prose
 * such as citations, disclaimers and footnotes is skipped instead of being
 * mis-parsed into fake results.
 */
export function parseLabResults(rawText: string): LabResult[] {
  const seen = new Set<string>();
  const results: LabResult[] = [];
  const lines = splitLines(rawText).map(normalizeScanLine);

  let pendingName = "";
  let pendingRange: string | undefined;
  let pendingUnit: string | undefined;

  const push = (result: LabResult) => {
    const name = result.name.trim();
    const value = typeof result.value === "string" ? result.value.trim() : result.value;
    if (!name || value === "" || value == null) return;
    const key = `${name.toLowerCase()}|${value}|${(result.unit ?? "").toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      name,
      value,
      unit: result.unit ?? "",
      ...(result.referenceRange ? { referenceRange: result.referenceRange } : {}),
      ...(result.flag ? { flag: result.flag } : {}),
    });
  };

  for (const line of lines) {
    if (!line || isJunkLine(line)) continue;

    // "Normal range: 264 - 916 ng/dL" — capture and hold for the next value.
    const rangeMatch = line.match(/(?:normal|reference|ref)\.?\s*range\s*:?\s*(.+)$/i);
    if (rangeMatch) {
      const { range, unit } = extractRangeAndUnit(rangeMatch[1]);
      if (range) {
        pendingRange = unit ? `${range} ${unit}` : range;
        pendingUnit = unit;
      }
      continue;
    }

    // "Value <3 Low" — explicit MyChart value line.
    const valueMatch = line.match(/^value\s*:?\s*(.+)$/i);
    if (valueMatch) {
      const parsed = parseValuePart(valueMatch[1]);
      if (parsed) {
        push({
          name: mapLabTestName(pendingName || "Result"),
          value: parsed.value,
          unit: parsed.unit ?? pendingUnit ?? "",
          referenceRange: pendingRange,
          flag: parsed.flag,
        });
        pendingName = "";
        pendingRange = undefined;
        pendingUnit = undefined;
      }
      continue;
    }

    // "Glucose 95 mg/dL 70-99" — single-line tabular result.
    const inline = matchInlineResult(line);
    if (inline) {
      push(inline);
      continue;
    }

    // A value on its own line ("<3 Low", "129") attaches to the pending name/range.
    if (pendingName && isStandaloneValueLine(line)) {
      const parsed = parseValuePart(line);
      if (parsed) {
        push({
          name: mapLabTestName(pendingName),
          value: parsed.value,
          unit: parsed.unit ?? pendingUnit ?? "",
          referenceRange: pendingRange,
          flag: parsed.flag,
        });
        pendingName = "";
        pendingRange = undefined;
        pendingUnit = undefined;
        continue;
      }
    }

    // Otherwise treat a short, non-prose line as the next test-name heading.
    if (isNameCandidate(line)) {
      pendingName = line.replace(/[:\-\s]+$/g, "").trim();
      pendingRange = undefined;
      pendingUnit = undefined;
    }
  }

  return results.slice(0, 40);
}

function splitLines(rawText: string) {
  return rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeScanLine(line: string) {
  return line.replace(/[\u2012-\u2015]/g, "-").replace(/[ \t]+/g, " ").trim();
}

function isJunkLine(line: string) {
  if (JUNK_LINE.test(line)) return true;
  // Lab result lines are short; long prose sentences never are.
  if (line.split(/\s+/).filter(Boolean).length > 8) return true;
  return false;
}

function isPlausibleUnit(unit?: string): unit is string {
  if (!unit) return false;
  const u = unit.trim().replace(/[.,;)]+$/g, "");
  if (!u || FLAG_WORD.test(u)) return false;
  if (/[/%]/.test(u)) return true; // mg/dL, %
  if (/\d/.test(u)) return true; // 10^3, x10E3/uL
  return /^(mg|mcg|ug|µg|ng|pg|g|kg|dl|l|ml|cl|mmol|mol|nmol|pmol|umol|µmol|meq|iu|miu|u|units?|cells|k|fl|mm|cm|sec|s|ratio|copies|index|osm|mosm)$/i.test(u);
}

function parseValuePart(text: string): ParsedValue | null {
  // Join comparators to their number: "< 3" -> "<3".
  const joined = text.replace(/([<>≤≥])\s+/g, "$1").trim();
  const tokens = joined.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const first = tokens[0].replace(/[,;]+$/g, "");
  const firstTwo = tokens.slice(0, 2).join(" ");
  let value: string;
  if (NUMERIC_VALUE.test(first)) {
    value = first;
  } else if (QUALITATIVE_VALUE.test(firstTwo)) {
    value = titleCaseWords(firstTwo);
  } else if (QUALITATIVE_VALUE.test(first)) {
    value = titleCaseWords(first);
  } else {
    return null;
  }

  let unit: string | undefined;
  let flag: string | undefined;
  for (const token of tokens.slice(1)) {
    const clean = token.replace(/[.,;)]+$/g, "");
    if (!unit && isPlausibleUnit(clean)) unit = clean;
    else if (!flag && FLAG_WORD.test(clean)) flag = titleCaseWords(clean);
  }
  return { value, unit, flag };
}

function isStandaloneValueLine(line: string) {
  const joined = line.replace(/([<>≤≥])\s+/g, "$1").trim();
  const tokens = joined.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 3) return false;
  const first = tokens[0].replace(/[,;]+$/g, "");
  if (!NUMERIC_VALUE.test(first) && !QUALITATIVE_VALUE.test(first)) return false;
  // Any remaining tokens must be a unit or a flag, never prose.
  return tokens.slice(1).every((token) => {
    const clean = token.replace(/[.,;)]+$/g, "");
    return isPlausibleUnit(clean) || FLAG_WORD.test(clean);
  });
}

function matchInlineResult(line: string): LabResult | null {
  const match = line.match(
    /^([A-Za-z][A-Za-z0-9 .,()'/-]{0,44}?)\s*[:\-]?\s+([<>≤≥]?[-+]?\d+(?:\.\d+)?)\s*([A-Za-z%µμ][A-Za-z%µμ/^0-9.]*)?(.*)$/,
  );
  if (!match) return null;

  const rawName = match[1].replace(/[:\-\s]+$/g, "").trim();
  if (!rawName || isJunkLine(rawName) || FLAG_WORD.test(rawName)) return null;

  const value = match[2].replace(/\s+/g, "");
  const unitCandidate = match[3]?.trim();
  const unit = isPlausibleUnit(unitCandidate) ? unitCandidate.replace(/[.,;)]+$/g, "") : undefined;
  const rest = `${unit ? "" : match[3] ?? ""} ${match[4] ?? ""}`;

  const rangeMatch = rest.match(/([<>]?[-+]?\d+(?:\.\d+)?\s*-\s*[-+]?\d+(?:\.\d+)?)\s*([A-Za-z%µμ][A-Za-z%µμ/^0-9.]*)?/);
  let referenceRange: string | undefined;
  if (rangeMatch) {
    const rangeUnit = isPlausibleUnit(rangeMatch[2]) ? rangeMatch[2].trim() : undefined;
    referenceRange = `${rangeMatch[1].replace(/\s+/g, " ").trim()}${rangeUnit ? ` ${rangeUnit}` : ""}`;
  }
  const flagMatch = rest.match(/\b(low|high|normal|abnormal|critical)\b/i);
  const flag = flagMatch ? titleCaseWords(flagMatch[1]) : undefined;

  // Guard against prose ("between 19 and"): require a real unit, a range, or a known test.
  if (!unit && !referenceRange && !isKnownLabName(rawName)) return null;

  return {
    name: mapLabTestName(rawName),
    value,
    unit: unit ?? "",
    ...(referenceRange ? { referenceRange } : {}),
    ...(flag ? { flag } : {}),
  };
}

function extractRangeAndUnit(text: string): { range?: string; unit?: string } {
  const match = text.match(
    /([<>]?[-+]?\d+(?:\.\d+)?(?:\s*-\s*[-+]?\d+(?:\.\d+)?)?)\s*([A-Za-z%µμ][A-Za-z%µμ/^0-9.]*(?:\/[A-Za-z%µμ^0-9.]+)?)?/,
  );
  if (!match) return {};
  const range = match[1].replace(/\s+/g, " ").trim();
  const unit = isPlausibleUnit(match[2]) ? match[2].trim() : undefined;
  return { range: range || undefined, unit };
}

function isNameCandidate(line: string) {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6) return false;
  if (!/[A-Za-z]/.test(line)) return false;
  if (/^\d{4}\b/.test(line)) return false; // years / citation fragments
  if (/\brange\b/i.test(line)) return false;
  if (FLAG_WORD.test(line.trim())) return false;
  if (/^(results?|value)$/i.test(line.trim())) return false;
  return true;
}

function normalizeLabName(rawName: string) {
  return rawName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isKnownLabName(rawName: string) {
  const normalized = normalizeLabName(rawName);
  return Object.values(LAB_TEST_ALIASES).some((aliases) => aliases.includes(normalized));
}

function mapLabTestName(rawName: string) {
  const normalized = normalizeLabName(rawName);
  for (const [canonical, aliases] of Object.entries(LAB_TEST_ALIASES)) {
    if (aliases.includes(normalized)) return canonical;
  }
  // Keep original casing so acronyms like IGF-1 / T4 are not mangled.
  return rawName.replace(/\b(result|value|test)\b/gi, "").replace(/\s+/g, " ").replace(/[:\-\s]+$/g, "").trim();
}

function titleCaseWords(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
