import { GoogleGenAI } from "@google/genai";

async function test() {
  const ai = new GoogleGenAI({});
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello",
    });
    console.log("gemini-2.5-flash worked");
  } catch(e:any) {
    console.error("gemini-2.5-flash failed", e.message);
  }
}
test();
