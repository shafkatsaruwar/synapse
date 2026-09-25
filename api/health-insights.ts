import type { VercelRequest, VercelResponse } from "@vercel/node";
import { rejectIfNotAllowed, getOpenAI, AI_MODEL } from "./_shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectIfNotAllowed(req, res)) return;

  const openai = getOpenAI();
  if (!openai) {
    return res.status(503).json({ error: "AI insights are not available right now." });
  }

  try {
    const { healthLogs, symptoms, medications, medLogs, vitals, fastingLogs, conditions, documents } = req.body ?? {};
    const prompt = buildInsightsPrompt({ healthLogs, symptoms, medications, medLogs, vitals, fastingLogs, conditions, documents });

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
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

Be specific, use their actual data. Do not make up data. If insufficient data, say so. Focus on patterns and actionable suggestions.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    return res.status(200).json(JSON.parse(content));
  } catch (error: any) {
    console.error("Health insights error:", error?.message || "unknown");
    return res.status(500).json({ error: "Failed to generate insights" });
  }
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
