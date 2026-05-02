import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParsePackage = require("pdf-parse");
import "regenerator-runtime/runtime.js";

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";

let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Job Store for SSE
interface TranslationJob {
  id: string;
  status: string;
  progress: number;
  result?: Buffer;
  error?: string;
  fileName: string;
  contentType: string;
  targetLang: string;
}

const jobs = new Map<string, TranslationJob>();
const clients = new Map<string, any>();

function updateJob(id: string, updates: Partial<TranslationJob>) {
  const job = jobs.get(id);
  if (job) {
    const updated = { ...job, ...updates };
    jobs.set(id, updated);
    
    // Notify client via SSE
    const res = clients.get(id);
    if (res) {
      res.write(`data: ${JSON.stringify({ 
        progress: updated.progress, 
        status: updated.status,
        error: updated.error,
        id: updated.id
      })}\n\n`);
    }

    // Fallback cleanup to prevent memory leaks if client disconnects
    if (updated.progress === 100 || updated.status === 'Failed') {
      setTimeout(() => {
        jobs.delete(id);
        const cli = clients.get(id);
        if (cli) cli.end();
        clients.delete(id);
      }, 30 * 60 * 1000); // 30 minutes to claim result
    }
  }
}

/**
 * Advanced Script-based AI Translation using Gemini
 */
const translateText = async (text: string, source_lang: string, target_lang: string): Promise<string> => {
  if (!text || typeof text !== 'string' || !text.trim()) return text;
  
  const langMap: Record<string, string> = {
    'en': 'English',
    'ne': 'Nepali',
    'tmg': 'Tamang'
  };

  const srcLib = langMap[source_lang] || source_lang;
  const tgtLib = langMap[target_lang] || target_lang;

  try {
    const prompt = `You are a professional linguistic translation engine. Translate the following text from ${srcLib} to ${tgtLib}. 
    Only output the accurately translated text. Do not include quotes, markdown formatting, or any extra explanation.
    
    Text to translate:
    ${text}`;

    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    if (response.text) {
      return response.text.trim();
    }
    return text;
  } catch (error: any) {
    console.error(`[Gemini Neural Translation Error]:`, error.message);
    return text; // Fallback to original text if translation fails
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Pre-load fonts for efficiency
let devanagariFontBuffer: Uint8Array | null = null;
let latinFontBuffer: Uint8Array | null = null;

async function preloadFonts() {
  try {
    const urls = {
      devanagari: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",
      latin: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf"
    };
    
    console.log("[Font] Pre-loading fonts (timeout 60s)...");
    const [devResp, latResp] = await Promise.all([
      axios.get(urls.devanagari, { responseType: 'arraybuffer', timeout: 60000 }),
      axios.get(urls.latin, { responseType: 'arraybuffer', timeout: 60000 })
    ]);
    
    devanagariFontBuffer = new Uint8Array(devResp.data);
    latinFontBuffer = new Uint8Array(latResp.data);
    console.log("[Font] Fonts pre-loaded successfully");
  } catch (err: any) {
    console.error("[Font Error] Failed to pre-load fonts:", err.message);
  }
}

async function startServer() {
  await preloadFonts();
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit to prevent DoS
  });

  // SSE Endpoint for progress tracking
  app.get("/api/jobs/progress/:jobId", (req, res) => {
    const jobId = req.params.jobId;
    const job = jobs.get(jobId);

    if (!job) return res.status(404).json({ error: "Job not found" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    clients.set(jobId, res);

    req.on("close", () => {
      clients.delete(jobId);
    });

    // Initial state
    res.write(`data: ${JSON.stringify({ 
      progress: job.progress, 
      status: job.status,
      id: job.id 
    })}\n\n`);
  });

  // Download endpoint
  app.get("/api/jobs/download/:jobId", (req, res) => {
    const jobId = req.params.jobId;
    const job = jobs.get(jobId);

    if (!job || !job.result) {
      return res.status(404).json({ error: "Result not ready or job expired" });
    }

    res.setHeader("Content-Type", job.contentType);
    res.setHeader("Content-Disposition", `attachment; filename=translated_${job.fileName}`);
    res.end(job.result);
    
    // Cleanup memory 5 minutes after download is available, or right after download
    setTimeout(() => {
      jobs.delete(jobId);
      clients.delete(jobId);
    }, 5 * 60 * 1000);
  });

  // Unified translation trigger endpoint
  app.post("/api/translate/:ext", upload.single("file"), async (req, res) => {
    const { ext } = req.params;
    const file = req.file;
    const targetLang = req.body.target_lang || "ne";
    const sourceLang = req.body.source_lang || "en";

    if (!file) return res.status(400).send("No file uploaded");

    const jobId = uuidv4();
    jobs.set(jobId, {
      id: jobId,
      status: "Starting...",
      progress: 0,
      fileName: file.originalname,
      contentType: file.mimetype,
      targetLang
    });

    res.json({ jobId });

    // Process in background
    (async () => {
      try {
        if (ext === "csv") {
          await processCsvJob(jobId, file, sourceLang, targetLang);
        } else if (ext === "pdf") {
          await processPdfJob(jobId, file, sourceLang, targetLang);
        } else {
          updateJob(jobId, { status: "Unsupported file type", progress: 100, error: "Unsupported format" });
        }
      } catch (err: any) {
        console.error(`[Job ${jobId}] Failed:`, err);
        updateJob(jobId, { status: "Failed", progress: 100, error: err.message });
      }
    })();
  });

  async function processCsvJob(jobId: string, file: any, sourceLang: string, targetLang: string) {
    updateJob(jobId, { status: "Parsing CSV...", progress: 10 });
    const csvContent = file.buffer.toString();
    const records = parseCsv(csvContent, { columns: true, skip_empty_lines: true, relax_column_count: true });
    
    // Safety limit to prevent runaway requests
    const safeRecords = records.slice(0, 100); 
    const translatedRecords = [];
    
    for (let i = 0; i < safeRecords.length; i++) {
      const row = safeRecords[i];
      let newRow: any = Object.assign({}, row);
      
      try {
        const textToTranslate = JSON.stringify(row);
        // Specialized prompt for objects
        const prompt = `Translate the VALUES of this JSON object from ${sourceLang} to ${targetLang}, but keep the KEYS exactly as they are in English. Return ONLY the raw valid JSON object without markdown formatting:\n${textToTranslate}`;
        
        const response = await getAI().models.generateContent({
           model: "gemini-2.5-flash",
           contents: prompt
        });
        
        if (response.text) {
           let cleaned = response.text.trim();
           if (cleaned.startsWith("\`\`\`json")) cleaned = cleaned.replace(/^\`\`\`json/,"").replace(/\`\`\`$/,"").trim();
           const parsed = JSON.parse(cleaned);
           if (typeof parsed === "object" && parsed !== null) {
              newRow = parsed;
           }
        }
      } catch (err) {
        console.warn("[CSV Translation Row Fallback]");
      }
      
      translatedRecords.push(newRow);
      await sleep(1000); // 1 second delay between rows
      
      const p = 10 + Math.floor((i / safeRecords.length) * 80);
      updateJob(jobId, { status: `Translating rows (${i + 1}/${safeRecords.length})...`, progress: p });
    }

    const output = stringifyCsv(translatedRecords, { header: true });
    updateJob(jobId, { 
      status: "Complete", 
      progress: 100, 
      result: Buffer.from(output), 
      contentType: "text/csv" 
    });
  }

  async function processPdfJob(jobId: string, file: any, sourceLang: string, targetLang: string) {
    updateJob(jobId, { status: "Extracting PDF content...", progress: 5 });
    
    let extractedText = "";
    try {
      if (pdfParsePackage && typeof pdfParsePackage.PDFParse === "function") {
        // pdf-parse v2+ (e.g. 2.4.5)
        const parser = new pdfParsePackage.PDFParse({ data: file.buffer });
        const data = await parser.getText();
        extractedText = data.text;
        await parser.destroy();
      } else {
        // legacy pdf-parse v1
        let parseFunc: any = pdfParsePackage;
        if (typeof parseFunc !== "function") {
          if (parseFunc && typeof parseFunc.default === "function") {
            parseFunc = parseFunc.default;
          } else if (parseFunc && typeof parseFunc.pdf === "function") {
            parseFunc = parseFunc.pdf;
          }
        }
        
        if (typeof parseFunc === "function") {
          const data = await parseFunc(file.buffer);
          extractedText = data?.text || "";
        } else {
          console.error("[PDF Error] pdf-parse resolution failed. Type:", typeof pdfParsePackage, "Keys:", Object.keys(pdfParsePackage || {}));
          throw new Error("The PDF processing engine failed to initialize. Please try again later.");
        }
      }
    } catch (extractErr: any) {
      console.error("[PDF Extraction Error]:", extractErr.message);
      throw new Error(`Failed to extract text from PDF: ${extractErr.message}`);
    }

    if (!extractedText || !extractedText.trim()) {
      throw new Error("No readable text found in the PDF. It might be a scanned image or protected.");
    }

    updateJob(jobId, { status: "Analyzing structure...", progress: 15 });

    const sentences = extractedText
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 2);
      
    // Reasonable limit for real-time processing
    const limitedSentences = sentences.slice(0, 400);
    const translatedSentences = [];

    const batchSize = 15; // Group sentences into larger paragraphs
    for (let i = 0; i < limitedSentences.length; i += batchSize) {
      const batch = limitedSentences.slice(i, i + batchSize);
      const paragraph = batch.join(" "); // Send as one block
      
      try {
        const translatedParagraph = await translateText(paragraph, sourceLang, targetLang);
        translatedSentences.push(translatedParagraph);
      } catch {
        translatedSentences.push(paragraph);
      }
      
      await sleep(1000); // 1 second delay between requests to strongly respect rate limits
      
      const p = 20 + Math.floor((i / limitedSentences.length) * 65);
      updateJob(jobId, { 
        status: `Translating (${i + batch.length}/${limitedSentences.length})...`, 
        progress: p 
      });
    }

    updateJob(jobId, { status: "Preparing final document...", progress: 90 });
    
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    let page = pdfDoc.addPage();
    
    const isIndic = targetLang === 'ne' || targetLang === 'tmg';
    const preferredBuffer = isIndic ? devanagariFontBuffer : latinFontBuffer;
    let font;
    
    if (preferredBuffer) {
      try {
        font = await pdfDoc.embedFont(preferredBuffer);
      } catch (err) {
        console.error("Failed to embed custom font:", err);
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
    } else {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const fontSize = 11;
    const margin = 50;
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const wrapWidth = pageWidth - 2 * margin;
    let y = pageHeight - margin;

    const charCache = new Map<string, boolean>();
    const cleanTextString = (str: string) => {
      let cleaned = "";
      for (const char of str) {
        if (!charCache.has(char)) {
          try {
            font.widthOfTextAtSize(char, fontSize);
            charCache.set(char, true);
          } catch {
            charCache.set(char, false);
          }
        }
        if (charCache.get(char)) {
          cleaned += char;
        } else {
          cleaned += " ";
        }
      }
      return cleaned;
    };

    const wrapText = (text: string, width: number) => {
      const cleanedText = cleanTextString(text);
      const words = cleanedText.split(/\s+/);
      const lines = [];
      let currentLine = words[0] || "";
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        try {
          const widthOfLine = font.widthOfTextAtSize(currentLine + " " + word, fontSize);
          if (widthOfLine < width) {
            currentLine += " " + word;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        } catch {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    for (const text of translatedSentences) {
      const wrappedLines = wrapText(text, wrapWidth);
      for (const line of wrappedLines) {
        if (y < margin + 20) {
          page = pdfDoc.addPage();
          y = pageHeight - margin;
        }
        try {
          page.drawText(line, {
            x: margin,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
          });
        } catch (drawErr) {
          console.warn("[PDF Draw Error] Character issue in line:", drawErr);
        }
        y -= fontSize + 5;
      }
      y -= 8;
    }

    const pdfBytes = await pdfDoc.save();
    updateJob(jobId, { 
      status: "Complete", 
      progress: 100, 
      result: Buffer.from(pdfBytes), 
      contentType: "application/pdf" 
    });
  }

  // Remove the old endpoints

  // Health Check
  app.get("/api/ping", (req, res) => {
    res.json({ status: "ok", engine: "Node.js (Real TMT)", timestamp: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
