import { GoogleGenAI } from "@google/genai";

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Translate the following text from en to ne. Maintain the exact original formatting and line breaks.
    
    Text to translate:
    Brief description of the project (max. 300 words)`,
  });
  console.log(response.text);
}
test();
