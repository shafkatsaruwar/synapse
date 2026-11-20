/**
 * LabFix parser + duplicate detection tests.
 * Run: npx tsx lib/lab-parse.test.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractAnyDocumentDate,
  findLikelyDuplicateLabWork,
  mapLabTestName,
  parseLabReport,
  parseLabResults,
} from "./lab-parse";

const here = dirname(fileURLToPath(import.meta.url));
function fixture(name: string) {
  return readFileSync(join(here, "fixtures", "lab-reports", name), "utf8");
}

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log("  FAIL: " + msg);
  }
}
function section(name: string) {
  console.log("\n=== " + name + " ===");
}

section("MyChart multi-line panel");
{
  const report = parseLabReport(fixture("mychart-panel.txt"));
  assert(report.results.length >= 5, `expected ≥5 results, got ${report.results.length}`);
  const glucose = report.results.find((r) => r.name === "Glucose");
  assert(!!glucose && String(glucose.value) === "95", "glucose 95");
  assert(glucose?.unit === "mg/dL", "glucose unit");
  assert(!!glucose?.referenceRange?.includes("70"), "glucose range");
  const potassium = report.results.find((r) => r.name === "Potassium");
  assert(potassium?.flag === "High", "potassium high flag");
  assert(report.collectedAt === "2026-03-12", `collected ${report.collectedAt}`);
  assert(!!report.labName && /quest/i.test(report.labName), "lab name quest");
  assert(!report.results.some((r) => /pmid|population/i.test(r.name)), "no junk prose rows");
}

section("Tabular CBC");
{
  const results = parseLabResults(fixture("tabular-cbc.txt"));
  assert(results.some((r) => r.name === "WBC"), "WBC");
  assert(results.some((r) => r.name === "Hemoglobin"), "Hemoglobin alias");
  assert(results.some((r) => r.name === "Platelets"), "Platelets");
  const hgb = results.find((r) => r.name === "Hemoglobin");
  assert(String(hgb?.value) === "14.2", "hgb value");
}

section("Comparators and qualitative");
{
  const report = parseLabReport(fixture("comparators-qualitative.txt"));
  const vitD = report.results.find((r) => /vitamin d/i.test(r.name));
  assert(!!vitD && String(vitD.value) === "<10", `vitD ${vitD?.value}`);
  assert(vitD?.flag === "Low", "vitD low");
  const hbs = report.results.find((r) => /hbsag/i.test(r.name));
  assert(!!hbs && String(hbs.value) === "Negative", "HBsAg Negative");
  const igf = report.results.find((r) => r.name === "IGF-1");
  assert(!!igf && String(igf.value).includes("916"), "IGF-1 ≥916");
  const psa = report.results.find((r) => r.name === "PSA");
  assert(!!psa && String(psa.value) === "-0.1", "negative PSA preserved");
}

section("Missing fields do not invent data");
{
  const report = parseLabReport(fixture("missing-fields.txt"));
  assert(!report.results.some((r) => /pmid|population|prose/i.test(r.name)), "junk skipped");
  const mystery = report.results.find((r) => /mystery/i.test(r.name));
  assert(!!mystery, "mystery analyte kept");
  assert(!mystery?.referenceRange, "no invented range");
  assert(mystery?.needsReview === true || !mystery?.unit, "mystery flagged/incomplete");
  const glucose = report.results.find((r) => r.name === "Glucose");
  assert(!!glucose, "known glucose without unit still extractable or skipped safely");
}

section("Duplicate rows within one parse");
{
  const results = parseLabResults(fixture("duplicate-rows.txt"));
  const glucose = results.filter((r) => r.name === "Glucose");
  assert(glucose.length === 1, "dedupes identical glucose rows");
}

section("No invented date");
{
  const report = parseLabReport(fixture("no-date.txt"));
  assert(!report.collectedAt && !report.reportedAt, "no labeled dates");
  assert(extractAnyDocumentDate(fixture("no-date.txt")) == null, "no fallback today");
  assert(report.warnings.some((w) => /date/i.test(w)), "warns about missing date");
}

section("Aliases preserve clinical meaning");
{
  assert(mapLabTestName("HbA1c") === "A1C", "A1C");
  assert(mapLabTestName("free t4") === "T4, Free", "Free T4");
  assert(mapLabTestName("White Blood Count") === "WBC", "WBC");
}

section("Document date helpers");
{
  assert(extractAnyDocumentDate("Collected: 03/12/2026") === "2026-03-12", "collected numeric");
  assert(extractAnyDocumentDate("Draw Date: Jan 8, 2026") === "2026-01-08", "month name");
  assert(extractAnyDocumentDate("no dates here") == null, "undefined when absent");
}

section("Duplicate import detection");
{
  const existing = [
    {
      id: "a1",
      testName: "Imported",
      date: "2026-05-05",
      documentUri: "file:///labs/a.pdf",
      results: [
        { name: "Glucose", value: "90", unit: "mg/dL" },
        { name: "Creatinine", value: "1.0", unit: "mg/dL" },
        { name: "Sodium", value: "138", unit: "mmol/L" },
      ],
    },
  ];
  const byDoc = findLikelyDuplicateLabWork(existing, {
    testName: "Again",
    date: "2026-05-05",
    documentUri: "file:///labs/a.pdf",
    results: [{ name: "Glucose", value: "90", unit: "mg/dL" }],
  });
  assert(!!byDoc && /document/i.test(byDoc.reason), "same documentUri");

  const byOverlap = findLikelyDuplicateLabWork(existing, {
    testName: "Again",
    date: "2026-05-05",
    results: [
      { name: "Glucose", value: "90", unit: "mg/dL" },
      { name: "Creatinine", value: "1.0", unit: "mg/dL" },
      { name: "Sodium", value: "138", unit: "mmol/L" },
    ],
  });
  assert(!!byOverlap, "overlap duplicate");

  const legitimateRepeat = findLikelyDuplicateLabWork(existing, {
    testName: "Follow-up",
    date: "2026-06-01",
    results: [
      { name: "Glucose", value: "90", unit: "mg/dL" },
      { name: "Creatinine", value: "1.0", unit: "mg/dL" },
      { name: "Sodium", value: "138", unit: "mmol/L" },
    ],
  });
  assert(legitimateRepeat == null, "different date is not a duplicate");
}

section("Failed / empty import");
{
  const report = parseLabReport("Copyright All rights reserved. Learn more. View trends.");
  assert(report.results.length === 0, "empty on junk-only");
  assert(report.warnings.length > 0, "warns on empty");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
