# LabFix — lab import reliability

## Pipeline

1. Image / PDF pick (`VisualScanImportModal`)
2. On-device text: iOS Vision OCR; PDFs prefer embedded text layer, else raster OCR (≤12 pages)
3. `parseLabReport` / `parseLabScan` (rule-based, local)
4. Review UI (editable rows, flags, evidence, warnings)
5. `labWorkStorage.save` with duplicate warning

## Guarantees

- Does not invent missing dates, units, ranges, or flags
- Preserves `<`, `>`, `≤`, `≥`, decimals, negatives, qualitative values
- Ambiguous rows marked `needsReview`
- Duplicate imports warn; legitimate same-day repeats can still be saved

## Limits

- OCR / PDF text extraction is **iOS native only**
- Embedded-text PDF improvement requires a **new native build** (Swift bridge)
- Parser improvements and review UI are **OTA-safe**
- No external AI document endpoints in this path
- Android/web cannot scan; manual entry remains available
