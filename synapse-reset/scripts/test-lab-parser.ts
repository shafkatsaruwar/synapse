import assert from "node:assert/strict";
import { formatLabValueDisplay, parseLabResults, parseLabScan } from "../lib/lab-scan-parser";

const MYCHART_TESTOSTERONE = `
MyChart
Tufts Medicine
TESTOSTERONE
Collected Aug 17, 2026 8:42 AM
Component Result Flag Units Reference Range
Testosterone <3 Low ng/dL 264 - 916 ng/dL
Lab: Labcorp Holyoke
Status: Not yet reviewed by care team
Patient John Example
Age 45 Years
Reference Range 70-99
`;

function testMyChartTestosterone() {
  const parsed = parseLabScan(MYCHART_TESTOSTERONE);
  assert.equal(parsed.testName, "Testosterone");
  assert.equal(parsed.date, "2026-08-17");
  assert.equal(parsed.labFacility.toLowerCase(), "labcorp holyoke");
  assert.ok(parsed.notes.length < 500, "notes should be a short summary, not full OCR");
  assert.ok(!parsed.notes.includes("Patient John Example"), "notes should not include patient demographics");
  assert.equal(parsed.results.length, 1);

  const testosterone = parsed.results[0];
  assert.equal(testosterone.name, "Testosterone");
  assert.equal(testosterone.value, 3);
  assert.equal(testosterone.valuePrefix, "<");
  assert.equal(testosterone.unit, "ng/dL");
  assert.equal(testosterone.flag, "Low");
  assert.match(testosterone.referenceRange ?? "", /264.*916/i);
  assert.equal(formatLabValueDisplay(testosterone), "<3 ng/dL");
}

function testSkipsDemographicsAndReferenceHeaders() {
  const noisy = `
Glucose 95 mg/dL
Reference Range 70-99
Age 45 Years
Hemoglobin 14.2 g/dL
Reference Interval 13.5 - 17.5 g/dL
`;
  const results = parseLabResults(noisy);
  assert.equal(results.length, 2);
  assert.equal(results[0].name, "Glucose");
  assert.equal(results[1].name, "Hemoglobin");
  assert.ok(!results.some((result) => /reference range/i.test(result.name)));
  assert.ok(!results.some((result) => result.unit === "H"));
}

function testInlineColonFormat() {
  const text = "Creatinine: 1.1 mg/dL (Reference: 0.6-1.3 mg/dL)";
  const results = parseLabResults(text);
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Creatinine");
  assert.equal(results[0].value, 1.1);
  assert.equal(results[0].unit, "mg/dL");
}

function testAboveReportingLimit() {
  const text = "PSA: >100 ng/mL Reference: 0-4 ng/mL Flag: High";
  const results = parseLabResults(text);
  assert.equal(results.length, 1);
  assert.equal(results[0].valuePrefix, ">");
  assert.equal(results[0].value, 100);
  assert.equal(results[0].flag, "High");
}

function run() {
  testMyChartTestosterone();
  testSkipsDemographicsAndReferenceHeaders();
  testInlineColonFormat();
  testAboveReportingLimit();
  console.log("lab parser tests passed");
}

run();
