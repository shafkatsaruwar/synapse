import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const largeBodyParser = express.json({ limit: "20mb" });

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/analyze-document", largeBodyParser, async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
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

If a field has no data, use an empty array. Be thorough and accurate. Only extract what is clearly stated in the document.`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` }
              },
              { type: "text", text: "Analyze this medical document and extract all relevant health data as JSON." }
            ]
          }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      res.json(parsed);
    } catch (error: any) {
      console.error("Document analysis error:", error?.message || error);
      res.status(500).json({ error: "Failed to analyze document" });
    }
  });

  app.post("/api/health-insights", largeBodyParser, async (req: Request, res: Response) => {
    try {
      const { healthLogs, symptoms, medications, medLogs, vitals, fastingLogs, conditions, documents } = req.body;

      const prompt = buildInsightsPrompt({ healthLogs, symptoms, medications, medLogs, vitals, fastingLogs, conditions, documents });

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 4096,
        messages: [
          {
            role: "system",
            content: `You are a health insights assistant for a person with chronic illness. Analyze their health data and provide actionable, empathetic insights.

Return a JSON object with:
{
  "changes": [{"title": "string", "description": "string", "type": "improvement|concern|neutral"}],
  "unclear": [{"title": "string", "description": "string", "suggestion": "string"}],
  "labsToTrack": [{"test": "string", "reason": "string", "frequency": "string"}],
  "symptomCorrelations": [{"pattern": "string", "description": "string", "confidence": "high|medium|low"}],
  "medicationNotes": [{"medication": "string", "note": "string", "type": "timing|interaction|reminder"}],
  "ramadanTips": [{"tip": "string", "category": "medication|hydration|energy|sleep"}],
  "summary": "brief overall health summary in 2-3 sentences"
}

Be specific, use their actual data. Do not make up data. If insufficient data, say so. Focus on patterns and actionable suggestions.`
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      res.json(parsed);
    } catch (error: any) {
      console.error("Health insights error:", error?.message || error);
      res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  app.post("/api/compare-medications", largeBodyParser, async (req: Request, res: Response) => {
    try {
      const { currentMedications, extractedMedications } = req.body;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
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

Match medications by name (accounting for brand/generic equivalents). Be conservative - only flag clear changes.`
          },
          {
            role: "user",
            content: `Current medications:\n${JSON.stringify(currentMedications, null, 2)}\n\nExtracted from document:\n${JSON.stringify(extractedMedications, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      res.json(parsed);
    } catch (error: any) {
      console.error("Medication comparison error:", error?.message || error);
      res.status(500).json({ error: "Failed to compare medications" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function buildInsightsPrompt(data: any): string {
  let prompt = "Analyze this health data and generate insights:\n\n";

  if (data.conditions?.length > 0) {
    prompt += `CONDITIONS: ${data.conditions.join(", ")}\n\n`;
  }

  if (data.healthLogs?.length > 0) {
    const recent = data.healthLogs.slice(-14);
    prompt += `DAILY LOGS (last ${recent.length} days):\n`;
    recent.forEach((l: any) => {
      prompt += `  ${l.date}: Energy=${l.energy}/5, Mood=${l.mood}/5, Sleep=${l.sleep}/5${l.fasting ? ", Fasting" : ""}\n`;
    });
    prompt += "\n";
  }

  if (data.symptoms?.length > 0) {
    const recent = data.symptoms.slice(-20);
    prompt += `SYMPTOMS (recent ${recent.length}):\n`;
    recent.forEach((s: any) => {
      prompt += `  ${s.date}: ${s.name} (severity ${s.severity}/5)${s.notes ? ` - ${s.notes}` : ""}\n`;
    });
    prompt += "\n";
  }

  if (data.medications?.length > 0) {
    prompt += `MEDICATIONS:\n`;
    data.medications.forEach((m: any) => {
      prompt += `  ${m.name} ${m.dosage} (${m.timeTag})${m.active ? "" : " [inactive]"}\n`;
    });
    prompt += "\n";
  }

  if (data.medLogs?.length > 0) {
    const taken = data.medLogs.filter((l: any) => l.taken).length;
    prompt += `MEDICATION ADHERENCE: ${taken}/${data.medLogs.length} doses taken\n\n`;
  }

  if (data.vitals?.length > 0) {
    prompt += `VITALS:\n`;
    data.vitals.slice(-10).forEach((v: any) => {
      prompt += `  ${v.date}: ${v.type} = ${v.value} ${v.unit}\n`;
    });
    prompt += "\n";
  }

  if (data.fastingLogs?.length > 0) {
    prompt += `FASTING LOGS:\n`;
    data.fastingLogs.slice(-7).forEach((f: any) => {
      prompt += `  ${f.date}: Suhoor=${f.suhoorTime || "N/A"}, Iftar=${f.iftarTime || "N/A"}, Water=${f.hydrationGlasses}gl, Energy=${f.energyLevel}/5\n`;
    });
    prompt += "\n";
  }

  if (data.documents?.length > 0) {
    prompt += `RECENT DOCUMENT EXTRACTIONS:\n`;
    data.documents.forEach((d: any) => {
      prompt += `  Summary: ${d.summary || "N/A"}\n`;
      if (d.diagnoses?.length > 0) prompt += `  Diagnoses: ${d.diagnoses.join(", ")}\n`;
      if (d.labResults?.length > 0) {
        prompt += `  Labs: ${d.labResults.map((l: any) => `${l.test}=${l.value}${l.unit ? " " + l.unit : ""} (${l.flag})`).join(", ")}\n`;
      }
    });
    prompt += "\n";
  }

  return prompt;
}
