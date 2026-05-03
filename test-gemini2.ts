import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const ai = new GoogleGenAI({}); // Should pick up GEMINI_API_KEY automatically
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Hello",
  });
  console.log(response.text);
}
test().catch(console.error);
