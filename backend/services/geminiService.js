import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function analyzeSpeech({ text, step }) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
You are a voice-call AI for an Indian service center.

User said: "${text}"
Current step: "${step}"

Return ONLY JSON (no markdown, no explanation):

{
  "confidence": "CLEAR or LOW",
  "intent": "PHONE | CHASSIS | COMPLAINT | UNKNOWN",
  "value": "extracted value or full complaint",
  "reply": "short Hindi reply"
}

Rules:
- PHONE = exactly 10 digits
- CHASSIS = alphanumeric
- If unclear → confidence LOW
`;

    const result = await model.generateContent(prompt);
    let raw = result.response.text().trim();

    // 🔥 CRITICAL FIX — strip markdown if Gemini adds it
    raw = raw.replace(/```json|```/g, "").trim();

    const json = JSON.parse(raw);

    return {
      confidence: json.confidence || "LOW",
      intent: json.intent || "UNKNOWN",
      value: json.value || "",
      reply: json.reply || "Kripya dobara boliye.",
    };
  } catch (err) {
    console.error("Gemini error:", err.message);

    return {
      confidence: "LOW",
      intent: "UNKNOWN",
      value: "",
      reply: "Main samajh nahi paaya. Kripya dobara boliye.",
    };
  }
}
