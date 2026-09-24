import type { VercelRequest, VercelResponse } from "@vercel/node";
import { rejectIfNotAllowed, getOpenAI, AI_MODEL } from "./_shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectIfNotAllowed(req, res)) return;

  const openai = getOpenAI();
  if (!openai) {
    return res.status(503).json({ error: "Document analysis is not available right now." });
  }

  try {
    const { imageBase64, mimeType } = req.body ?? {};
    if (!imageBase64) {
      return res.status(400).json({ error: "Image data is required" });
    }

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a medical document analyzer. Extract structured data from medical documents (lab reports, prescriptions, doctor notes, discharge summaries).

Return a JSON object with these fields:
{
  "diagnoses": ["list of diagnoses found"],
  "medications": [{"name": "string", "dosage": "string", "frequency": "string", "status": "new|continued|changed|stopped"}],
  "labResults": [{"test": "string", "value": "string", "unit": "string", "referenceRange": "string", "flag": "normal|high|low"}],
  "followUpDates": [{"date": "YYYY-MM-DD or description", "doctor": "string", "purpose": "string"}],
  "doctorInstructions": ["list of instructions"],
  "summary": "brief summary of the document"
}

If a field has no data, use an empty array. Be thorough and accurate. Only extract what is clearly stated in the document.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` },
            },
            { type: "text", text: "Analyze this medical document and extract all relevant health data as JSON." },
          ] as any,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    return res.status(200).json(JSON.parse(content));
  } catch (error: any) {
    console.error("Document analysis error:", error?.message || "unknown");
    return res.status(500).json({ error: "Failed to analyze document" });
  }
}
