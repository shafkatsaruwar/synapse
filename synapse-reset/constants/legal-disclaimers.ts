/**
 * Shared legal / product-scope copy. Keep wording consistent across the app.
 * Synapse is a personal wellness organizer — not a HIPAA product and not medical care.
 */

export const LEGAL = {
  shortNotMedical:
    "Synapse does not provide medical advice, diagnosis, or treatment. Always follow your clinician.",
  shortNotHipaa:
    "Synapse is not HIPAA compliant and is not a covered entity or business associate product.",
  /** One-liner for footers and AI cards */
  banner:
    "Not medical advice · Not HIPAA compliant · For personal organization only",
  /** Slightly longer for AI feature screens */
  aiScope:
    "AI here only helps you organize and prep from information you already saved (summaries, extraction, patterns). It does not diagnose, prescribe, or replace your clinician. Synapse is not HIPAA compliant.",
  appointmentAi:
    "This is appointment prep only — not a diagnosis or medical advice. Synapse is not HIPAA compliant.",
  documentsAi:
    "AI extracts text you uploaded so you can organize it. It is not a lab interpretation or medical advice. Synapse is not HIPAA compliant.",
  insightsAi:
    "Insights highlight patterns in your logs for awareness only. They are not medical advice or a diagnosis. Synapse is not HIPAA compliant.",
  privacyTitle: "Not Medical Care / Not HIPAA",
  privacyBody:
    "Synapse is a personal wellness and organization app, not a medical device, not a healthcare provider, and not a HIPAA covered entity or business associate product. It does not provide medical advice. Always follow your clinician’s guidance.",
} as const;
