import type { VercelRequest, VercelResponse } from "@vercel/node";
import { rejectIfNotAllowed, getOpenAI, AI_MODEL } from "./_shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectIfNotAllowed(req, res)) return;

  const openai = getOpenAI();
  if (!openai) {
    return res.status(503).json({ error: "Medication comparison is not available right now." });
  }

  try {
    const { currentMedications, extractedMedications } = req.body ?? {};

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `Compare two medication lists and identify changes. Current medications are what the patient is taking. Extracted medications come from a medical document.

Return a JSON object:
{
  "new": [{"name": "string", "dosage": "string", "frequency": "string", "source": "document description"}],
  "stopped": [{"name": "string", "dosage": "string", "reason": "string"}],
  "doseChanged": [{"name": "string", "oldDosage": "string", "newDosage": "string"}],
  "unchanged": [{"name": "string", "dosage": "string"}],
  "summary": "brief comparison summary"
}

Match medications by name (accounting for brand/generic equivalents). Be conservative - only flag clear changes.`,
        },
        {
          role: "user",
          content: `Current medications:\n${JSON.stringify(currentMedications, null, 2)}\n\nExtracted from document:\n${JSON.stringify(extractedMedications, null, 2)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    return res.status(200).json(JSON.parse(content));
  } catch (error: any) {
    console.error("Medication comparison error:", error?.message || "unknown");
    return res.status(500).json({ error: "Failed to compare medications" });
  }
}
