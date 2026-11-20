import type { LabResult } from "@/lib/storage";

/**
 * Pure lab-report parsing logic — no React Native / native imports (Node-testable).
 *
 * Rules:
 * - Never invent missing values, units, ranges, dates, or flags.
 * - Preserve comparators (<, >, ≤, ≥), decimals, negatives, and qualitative text.
 * - Prefer skipping ambiguous rows over wrong assignment.
 */

const LAB_TEST_ALIASES: Record<string, string[]> = {
  Glucose: ["glucose", "blood glucose", "fasting glucose", "glu"],
  Hemoglobin: ["hemoglobin", "hgb", "hb", "haemoglobin"],
  Hematocrit: ["hematocrit", "hct", "haematocrit"],
  WBC: ["wbc", "white blood cell", "white blood cells", "white blood count", "leukocytes"],
  RBC: ["rbc", "red blood cell", "red blood cells", "red blood count", "erythrocytes"],
  Platelets: ["platelets", "platelet count", "plt"],
  MCV: ["mcv", "mean corpuscular volume"],
  MCH: ["mch", "mean corpuscular hemoglobin", "mean corpuscular haemoglobin"],
  MCHC: ["mchc"],
  RDW: ["rdw", "rdw cv", "rdw-cv"],
  Neutrophils: ["neutrophils", "neut", "neutrophil", "segs"],
  Lymphocytes: ["lymphocytes", "lymph", "lymphs"],
  Monocytes: ["monocytes", "mono"],
  Eosinophils: ["eosinophils", "eos"],
  Basophils: ["basophils", "baso"],
  Sodium: ["sodium", "na"],
  Potassium: ["potassium", "k"],
  Chloride: ["chloride", "cl"],
  CO2: ["co2", "bicarbonate", "hco3", "carbon dioxide"],
  BUN: ["bun", "blood urea nitrogen", "urea nitrogen"],
  Creatinine: ["creatinine", "creat", "crea"],
  eGFR: ["egfr", "estimated gfr", "gfr"],
  Calcium: ["calcium", "ca"],
  Albumin: ["albumin", "alb"],
  "Total Protein": ["total protein", "protein total", "protein"],
  Bilirubin: ["bilirubin", "total bilirubin", "t bili", "tbili"],
  ALT: ["alt", "alanine aminotransferase", "sgpt"],
  AST: ["ast", "aspartate aminotransferase", "sgot"],
  ALP: ["alp", "alkaline phosphatase", "alk phos"],
  "Cholesterol, Total": ["total cholesterol", "cholesterol total", "cholesterol"],
  HDL: ["hdl", "hdl cholesterol", "hdl-c"],
  LDL: ["ldl", "ldl cholesterol", "ldl-c"],
  Triglycerides: ["triglycerides", "trig", "trigs"],
  TSH: ["tsh", "thyroid stimulating hormone"],
  "T4, Free": ["t4 free", "free t4", "free thyroxine", "t4, free", "ft4"],
  "T3, Free": ["t3 free", "free t3", "ft3", "t3, free"],
  "A1C": ["a1c", "hba1c", "hemoglobin a1c", "glycohemoglobin"],
  "Vitamin D": ["vitamin d", "25 oh vitamin d", "25-hydroxy vitamin d", "25 hydroxy vitamin d"],
  "Vitamin B12": ["vitamin b12", "b12", "cobalamin"],
  Ferritin: ["ferritin"],
  Iron: ["iron", "serum iron"],
  "TIBC": ["tibc", "total iron binding capacity"],
  Transferrin: ["transferrin"],
  PSA: ["psa", "prostate specific antigen"],
  Testosterone: ["testosterone", "total testosterone"],
  "IGF-1": [
    "igf-1",
    "igf 1",
    "insulin like growth factor 1",
    "insulin-like growth factor 1",
    "insulin-like growth factor-1",
  ],
  CRP: ["crp", "c reactive protein", "c-reactive protein"],
  ESR: ["esr", "sed rate", "sedimentation rate"],
  INR: ["inr"],
  "Prothrombin Time": ["prothrombin time", "pt", "pt sec"],
};

const QUALITATIVE_VALUE =
  /^(positive|negative|detected|not\s+detected|reactive|non-?reactive|normal|abnormal|present|absent|trace|none|equivocal|indeterminate|borderline)$/i;

const FLAG_WORD = /^(low|high|normal|abnormal|critical|panic|h|l|a|c|hh|ll)$/i;

const JUNK_LINE =
  /(\bet\.?\s*al\b|\bpmid\b|\bdoi\b|\bjcem\b|reference interval|based on a population|nonobese|years old|copyright|all rights reserved|not yet reviewed|learn more|additional information|view trends|compare result|performed at|lab director|\breported\b|ordered by|specimen|accession|\bprovider\b|\bphysician\b|\baddress\b|\bphone\b|\bfax\b|\bdob\b|\bmrn\b|\bsuite\b|page\s+\d+\s+of\s+\d+)/i;

const NUMERIC_VALUE = /^[<>≤≥]?[-+]?\d+(?:\.\d+)?$/;

const MAX_RESULTS = 80;

export type ParsedLabResult = LabResult & {
  /** Ambiguous or incomplete extraction — show in review UI. */
  needsReview?: boolean;
  /** Source line(s) used for this result (not PHI logging — local review only). */
  sourceEvidence?: string;
};

export type LabParseReport = {
  results: ParsedLabResult[];
  warnings: string[];
  labName?: string;
  /** ISO date only when a collection/report date was found on the document. */
  collectedAt?: string;
  reportedAt?: string;
  recognizedCount: number;
  unresolvedHints: string[];
  truncated: boolean;
};

type ParsedValue = { value: string; unit?: string; flag?: string };

/**
 * Extract structured lab results from OCR or PDF text.
 */
export function parseLabResults(rawText: string): LabResult[] {
  return parseLabReport(rawText).results.map(stripParseMeta);
}

/** Full parse with warnings, lab name, and dated fields — never invents missing dates. */
export function parseLabReport(rawText: string): LabParseReport {
  const warnings: string[] = [];
  const unresolvedHints: string[] = [];
  const seen = new Set<string>();
  const results: ParsedLabResult[] = [];
  const lines = splitLines(rawText).map(normalizeScanLine);

  const labName = extractLabName(lines);
  const collectedAt = extractLabeledDate(rawText, ["collected", "collection date", "specimen collected", "draw date"]);
  const reportedAt = extractLabeledDate(rawText, ["reported", "report date", "resulted", "final report"]);

  let pendingName = "";
  let pendingRange: string | undefined;
  let pendingUnit: string | undefined;
  let pendingEvidence: string[] = [];
  let sawTabularHeader = false;

  const push = (result: ParsedLabResult) => {
    const name = result.name.trim();
    const value = typeof result.value === "string" ? result.value.trim() : result.value;
    if (!name || value === "" || value == null) return;
    if (/^result$/i.test(name)) {
      unresolvedHints.push("Skipped a value without a clear test name.");
      return;
    }
    const key = `${name.toLowerCase()}|${String(value).toLowerCase()}|${(result.unit ?? "").toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    const needsReview =
      result.needsReview === true ||
      !result.unit ||
      !result.referenceRange ||
      /^[A-Za-z]{1,2}$/.test(name);
    results.push({
      name,
      value,
      unit: result.unit ?? "",
      ...(result.referenceRange ? { referenceRange: result.referenceRange } : {}),
      ...(result.flag ? { flag: result.flag } : {}),
      ...(needsReview ? { needsReview: true } : {}),
      ...(result.sourceEvidence ? { sourceEvidence: result.sourceEvidence } : {}),
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || isJunkLine(line)) continue;

    if (isTabularHeader(line)) {
      sawTabularHeader = true;
      continue;
    }

    // "Normal range: 264 - 916 ng/dL"
    const rangeMatch = line.match(/(?:normal|reference|ref)\.?\s*range\s*:?\s*(.+)$/i);
    if (rangeMatch) {
      const { range, unit } = extractRangeAndUnit(rangeMatch[1]);
      if (range) {
        pendingRange = unit ? `${range} ${unit}` : range;
        pendingUnit = unit ?? pendingUnit;
        pendingEvidence.push(line);
      }
      continue;
    }

    // "Value <3 Low"
    const valueMatch = line.match(/^value\s*:?\s*(.+)$/i);
    if (valueMatch) {
      const parsed = parseValuePart(valueMatch[1]);
      if (parsed && pendingName) {
        push({
          name: mapLabTestName(pendingName),
          value: parsed.value,
          unit: parsed.unit ?? pendingUnit ?? "",
          referenceRange: pendingRange,
          flag: parsed.flag,
          sourceEvidence: [...pendingEvidence, line].join(" · "),
          needsReview: !pendingName || pendingName.length < 2,
        });
      } else if (parsed && !pendingName) {
        unresolvedHints.push(`Found a value without a test name: “${valueMatch[1].slice(0, 40)}”.`);
      }
      pendingName = "";
      pendingRange = undefined;
      pendingUnit = undefined;
      pendingEvidence = [];
      continue;
    }

    // Single-line tabular: "Glucose 95 mg/dL 70-99"
    const inline = matchInlineResult(line);
    if (inline) {
      push({ ...inline, sourceEvidence: line });
      pendingName = "";
      pendingRange = undefined;
      pendingUnit = undefined;
      pendingEvidence = [];
      continue;
    }

    // Name / value split across two lines after a table header.
    if (sawTabularHeader && pendingName && isStandaloneValueLine(line)) {
      const parsed = parseValuePart(line);
      if (parsed) {
        push({
          name: mapLabTestName(pendingName),
          value: parsed.value,
          unit: parsed.unit ?? pendingUnit ?? "",
          referenceRange: pendingRange,
          flag: parsed.flag,
          sourceEvidence: [...pendingEvidence, line].join(" · "),
        });
        pendingName = "";
        pendingRange = undefined;
        pendingUnit = undefined;
        pendingEvidence = [];
        continue;
      }
    }

    if (pendingName && isStandaloneValueLine(line)) {
      const parsed = parseValuePart(line);
      if (parsed) {
        push({
          name: mapLabTestName(pendingName),
          value: parsed.value,
          unit: parsed.unit ?? pendingUnit ?? "",
          referenceRange: pendingRange,
          flag: parsed.flag,
          sourceEvidence: [...pendingEvidence, line].join(" · "),
        });
        pendingName = "";
        pendingRange = undefined;
        pendingUnit = undefined;
        pendingEvidence = [];
        continue;
      }
    }

    // Peek: name on this line, value on next (common OCR split).
    const next = lines[i + 1];
    if (isNameCandidate(line) && next && isStandaloneValueLine(next) && !/^value\s*:?/i.test(next)) {
      pendingName = line.replace(/[:\-\s]+$/g, "").trim();
      pendingEvidence = [line];
      pendingRange = undefined;
      pendingUnit = undefined;
      continue;
    }

    if (isNameCandidate(line)) {
      pendingName = line.replace(/[:\-\s]+$/g, "").trim();
      pendingEvidence = [line];
      pendingRange = undefined;
      pendingUnit = undefined;
    }
  }

  if (pendingName) {
    unresolvedHints.push(`Left unmatched test heading: “${pendingName.slice(0, 48)}”.`);
  }

  const truncated = results.length > MAX_RESULTS;
  if (truncated) warnings.push(`Stopped after ${MAX_RESULTS} results to avoid runaway parses.`);
  const sliced = results.slice(0, MAX_RESULTS);

  if (sliced.length === 0 && lines.length > 0) {
    warnings.push("No structured lab rows were recognized. You can add results manually.");
  }
  const reviewCount = sliced.filter((r) => r.needsReview).length;
  if (reviewCount > 0) {
    warnings.push(`${reviewCount} result${reviewCount === 1 ? "" : "s"} flagged for manual review.`);
  }
  if (!collectedAt && !reportedAt) {
    warnings.push("No collection or report date was found on the document.");
  }

  return {
    results: sliced,
    warnings,
    labName,
    collectedAt,
    reportedAt,
    recognizedCount: sliced.length,
    unresolvedHints: unresolvedHints.slice(0, 12),
    truncated,
  };
}

function stripParseMeta(result: ParsedLabResult): LabResult {
  const { needsReview: _n, sourceEvidence: _s, ...rest } = result;
  return rest;
}

function splitLines(rawText: string) {
  return rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeScanLine(line: string) {
  return line
    .replace(/[\u2012-\u2015]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function isJunkLine(line: string) {
  if (JUNK_LINE.test(line)) return true;
  if (/\bpatient\b/i.test(line) && /\b(name|id|dob|mrn)\b/i.test(line)) return true;
  if (line.split(/\s+/).filter(Boolean).length > 10) return true;
  return false;
}

function isTabularHeader(line: string) {
  const lower = line.toLowerCase();
  const hasResult = /\bresult\b|\bvalue\b/.test(lower);
  const hasRef = /\bref\b|\brange\b|\breference\b/.test(lower);
  const hasUnit = /\bunit\b|\bunits\b/.test(lower);
  const hasFlag = /\bflag\b|\babnormal\b/.test(lower);
  return (hasResult && hasRef) || (hasResult && hasUnit) || (hasRef && hasFlag);
}

function isPlausibleUnit(unit?: string): unit is string {
  if (!unit) return false;
  const u = unit.trim().replace(/[.,;)]+$/g, "");
  if (!u || FLAG_WORD.test(u)) return false;
  if (/[/%]/.test(u)) return true;
  if (/\d/.test(u)) return true;
  return /^(mg|mcg|ug|µg|ng|pg|g|kg|dl|l|ml|cl|mmol|mol|nmol|pmol|umol|µmol|meq|iu|miu|u|units?|cells|k|fl|mm|cm|sec|s|ratio|copies|index|osm|mosm|th\/mm3|x10e3|x10\^3)$/i.test(
    u,
  );
}

function parseValuePart(text: string): ParsedValue | null {
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
    const clean = token.replace(/[.,;()]+$/g, "").replace(/^\(+/, "");
    if (!unit && isPlausibleUnit(clean)) unit = clean;
    else if (!flag && FLAG_WORD.test(clean)) flag = normalizeFlag(clean);
  }
  return { value, unit, flag };
}

function isStandaloneValueLine(line: string) {
  const joined = line.replace(/([<>≤≥])\s+/g, "$1").trim();
  const tokens = joined.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) return false;
  const first = tokens[0].replace(/[,;]+$/g, "");
  if (!NUMERIC_VALUE.test(first) && !QUALITATIVE_VALUE.test(first)) return false;
  return tokens.slice(1).every((token) => {
    const clean = token.replace(/[.,;()]+$/g, "").replace(/^\(+/, "");
    return isPlausibleUnit(clean) || FLAG_WORD.test(clean);
  });
}

function matchInlineResult(line: string): ParsedLabResult | null {
  const match = line.match(
    /^([A-Za-z][A-Za-z0-9 .,()'/%-]{0,48}?)\s*[:\-]?\s+([<>≤≥]?[-+]?\d+(?:\.\d+)?)\s*([A-Za-z%µμ][A-Za-z%µμ/^0-9.]*)?(.*)$/,
  );
  if (!match) {
    // Qualitative inline: "HBsAg Negative"
    const qual = line.match(/^([A-Za-z][A-Za-z0-9 .,()'/%-]{0,48}?)\s+((?:not\s+)?(?:detected|reactive)|positive|negative|trace|equivocal)\b(.*)$/i);
    if (!qual) return null;
    const rawName = qual[1].replace(/[:\-\s]+$/g, "").trim();
    if (!rawName || isJunkLine(rawName) || FLAG_WORD.test(rawName)) return null;
    const flagMatch = qual[3]?.match(/\b(low|high|normal|abnormal|critical)\b/i);
    return {
      name: mapLabTestName(rawName),
      value: titleCaseWords(qual[2]),
      unit: "",
      ...(flagMatch ? { flag: normalizeFlag(flagMatch[1]) } : {}),
      needsReview: !isKnownLabName(rawName),
    };
  }

  const rawName = match[1].replace(/[:\-\s]+$/g, "").trim();
  if (!rawName || isJunkLine(rawName) || FLAG_WORD.test(rawName)) return null;

  const value = match[2].replace(/\s+/g, "");
  const unitCandidate = match[3]?.trim();
  const unit = isPlausibleUnit(unitCandidate) ? unitCandidate.replace(/[.,;)]+$/g, "") : undefined;
  const rest = `${unit ? "" : match[3] ?? ""} ${match[4] ?? ""}`;

  const rangeMatch = rest.match(
    /([<>]?[-+]?\d+(?:\.\d+)?\s*-\s*[-+]?\d+(?:\.\d+)?)\s*([A-Za-z%µμ][A-Za-z%µμ/^0-9.]*)?/,
  );
  let referenceRange: string | undefined;
  if (rangeMatch) {
    const rangeUnit = isPlausibleUnit(rangeMatch[2]) ? rangeMatch[2].trim() : undefined;
    referenceRange = `${rangeMatch[1].replace(/\s+/g, " ").trim()}${rangeUnit ? ` ${rangeUnit}` : ""}`;
  }
  const flagMatch = rest.match(/\b(low|high|normal|abnormal|critical|panic)\b|\b([hlca]{1,2})\b/i);
  const flag = flagMatch ? normalizeFlag(flagMatch[1] || flagMatch[2]) : undefined;

  if (!unit && !referenceRange && !isKnownLabName(rawName)) return null;

  return {
    name: mapLabTestName(rawName),
    value,
    unit: unit ?? "",
    ...(referenceRange ? { referenceRange } : {}),
    ...(flag ? { flag } : {}),
    needsReview: !unit && !referenceRange,
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
  if (words.length === 0 || words.length > 7) return false;
  if (!/[A-Za-z]/.test(line)) return false;
  if (/^\d{4}\b/.test(line)) return false;
  if (/\brange\b/i.test(line)) return false;
  if (FLAG_WORD.test(line.trim())) return false;
  if (/^(results?|value|units?|flag|reference)$/i.test(line.trim())) return false;
  if (NUMERIC_VALUE.test(line.replace(/\s+/g, ""))) return false;
  return true;
}

function normalizeLabName(rawName: string) {
  return rawName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isKnownLabName(rawName: string) {
  const normalized = normalizeLabName(rawName);
  return Object.values(LAB_TEST_ALIASES).some((aliases) => aliases.includes(normalized));
}

export function mapLabTestName(rawName: string) {
  const normalized = normalizeLabName(rawName);
  for (const [canonical, aliases] of Object.entries(LAB_TEST_ALIASES)) {
    if (aliases.includes(normalized)) return canonical;
  }
  return rawName
    .replace(/\b(result|value|test)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[:\-\s]+$/g, "")
    .trim();
}

function normalizeFlag(raw: string) {
  const t = raw.trim().toLowerCase();
  if (t === "h" || t === "hh") return "High";
  if (t === "l" || t === "ll") return "Low";
  if (t === "a") return "Abnormal";
  if (t === "c") return "Critical";
  return titleCaseWords(raw);
}

function titleCaseWords(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extractLabName(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 12)) {
    if (/\b(laboratory|laboratories|labcorp|quest diagnostics|quest|lab\s*corp|clinic lab|medical laboratory)\b/i.test(line)) {
      const cleaned = line
        .replace(/\b(final report|results?|patient report)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned.length >= 3 && cleaned.length <= 80) return cleaned;
    }
  }
  return undefined;
}

/** Parse a labeled date from report text. Returns YYYY-MM-DD or undefined — never invents. */
export function extractLabeledDate(rawText: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*:?\\s*(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}|[A-Za-z]{3,9}\\.?\\s+\\d{1,2},?\\s+\\d{4})`,
      "i",
    );
    const match = rawText.match(re);
    if (match?.[1]) {
      const parsed = coerceDateToken(match[1]);
      if (parsed) return parsed;
    }
  }
  return undefined;
}

/** Best-effort document date without inventing “today”. */
export function extractAnyDocumentDate(rawText: string): string | undefined {
  const labeled =
    extractLabeledDate(rawText, [
      "collected",
      "collection date",
      "specimen collected",
      "draw date",
      "reported",
      "report date",
      "result date",
      "date of service",
      "dos",
    ]) ?? undefined;
  if (labeled) return labeled;

  // Avoid lab ranges like "3.8-10.8" (decimals) being mistaken for dates.
  const numeric = rawText.match(/\b(\d{1,2})([\/.])(\d{1,2})\2(\d{2,4})\b/);
  if (numeric) {
    return coerceDateToken(`${numeric[1]}/${numeric[3]}/${numeric[4]}`);
  }
  const dashed = rawText.match(/\b(\d{1,2})-(\d{1,2})-(\d{4})\b/);
  if (dashed) {
    return coerceDateToken(`${dashed[1]}/${dashed[2]}/${dashed[3]}`);
  }
  const month = rawText.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))\b/i,
  );
  if (month) {
    return coerceDateToken(`${month[1]} ${month[2]}, ${month[3]}`);
  }
  return undefined;
}

function coerceDateToken(token: string): string | undefined {
  const trimmed = token.trim();
  const numeric = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (numeric) {
    const a = parseInt(numeric[1], 10);
    const b = parseInt(numeric[2], 10);
    const year = normalizeYear(numeric[3]);
    // Prefer US month-first when unambiguous; if first > 12, treat as D/M/Y.
    let month = a;
    let day = b;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function normalizeYear(year: string) {
  if (year.length === 4) return year;
  const value = parseInt(year, 10);
  return `${value > 70 ? 1900 + value : 2000 + value}`;
}

/** Detect likely duplicate LabWork imports without discarding legitimate repeats. */
export function findLikelyDuplicateLabWork(
  existing: Array<{ id: string; testName: string; date: string; results?: LabResult[]; documentUri?: string }>,
  candidate: { testName: string; date: string; results?: LabResult[]; documentUri?: string },
): { id: string; reason: string } | null {
  if (candidate.documentUri) {
    const byDoc = existing.find((item) => item.documentUri && item.documentUri === candidate.documentUri);
    if (byDoc) return { id: byDoc.id, reason: "Same source document was imported before." };
  }
  const candKeys = new Set(
    (candidate.results ?? []).map(
      (r) => `${String(r.name).toLowerCase()}|${String(r.value).toLowerCase()}|${String(r.unit ?? "").toLowerCase()}`,
    ),
  );
  if (candKeys.size === 0) return null;
  for (const item of existing) {
    if (item.date !== candidate.date) continue;
    const keys = (item.results ?? []).map(
      (r) => `${String(r.name).toLowerCase()}|${String(r.value).toLowerCase()}|${String(r.unit ?? "").toLowerCase()}`,
    );
    if (keys.length === 0) continue;
    const overlap = keys.filter((k) => candKeys.has(k)).length;
    const ratio = overlap / Math.max(keys.length, candKeys.size);
    if (overlap >= 3 && ratio >= 0.7) {
      return { id: item.id, reason: `Similar results already saved for ${item.date} (${overlap} matching tests).` };
    }
  }
  return null;
}
