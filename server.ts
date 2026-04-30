import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParsePackage = require("pdf-parse");

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

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
  }
}

// Configuration for Real TMT API
const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";
const API_TOKEN = "team_0c4cf201a499ccad";

/**
 * Real translation logic using Axios
 */
const translateText = async (text: string, source_lang: string, target_lang: string): Promise<string> => {
  if (!text || typeof text !== 'string' || !text.trim()) return text;
  
  try {
    const payload = {
      text: text.trim(),
      src_lang: source_lang,
      tgt_lang: target_lang
    };
    
    const response = await axios.post(API_URL, payload, {
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json"
      },
      timeout: 20000 
    });

    console.log(`[TMT] Chunk: "${text.substring(0, 30)}..." -> Status: ${response.status}`);
    
      if (response.data && typeof response.data === 'object') {
        const data = response.data;
        // Handle both message_type and message type (observed inconsistency in KU API)
        const msgType = data.message_type || data['message type'];
        const output = data.output || data.translated_text;

        if (msgType === 'SUCCESS' && output) {
          return output;
        }
        
        // Final fallback to output if it exists regardless of status
        if (output) return output;
      }
  } catch (error: any) {
    console.error("[TMT Error]:", error.response?.status, error.message);
    return text; 
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Pre-load fonts for efficiency
let devanagariFontBuffer: Uint8Array | null = null;
let latinFontBuffer: Uint8Array | null = null;

async function preloadFonts() {
  try {
    const urls = {
      devanagari: "https://raw.githubusercontent.com/googlefonts/noto-fonts/master/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",
      latin: "https://raw.githubusercontent.com/googlefonts/noto-fonts/master/hinted/ttf/NotoSans/NotoSans-Regular.ttf"
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
  const upload = multer({ storage: multer.memoryStorage() });

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
    
    // Optionally cleanup
    // setTimeout(() => jobs.delete(jobId), 60000);
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
    
    const translatedRecords = [];
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const newRow: any = {};
      for (const [key, value] of Object.entries(row)) {
        newRow[key] = await translateText(value as string, sourceLang, targetLang);
      }
      translatedRecords.push(newRow);
      
      const p = 10 + Math.floor((i / records.length) * 80);
      updateJob(jobId, { status: `Translating rows (${i + 1}/${records.length})...`, progress: p });
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
    
    let parseFunc: any = pdfParsePackage;
    
    // Exhaustive check for the function in different module systems
    if (typeof parseFunc !== "function") {
      if (parseFunc && typeof parseFunc.default === "function") {
        parseFunc = parseFunc.default;
      } else if (parseFunc && typeof parseFunc.pdf === "function") {
        parseFunc = parseFunc.pdf;
      }
    }
    
    if (typeof parseFunc !== "function") {
      console.error("[PDF Error] pdf-parse resolution failed. Type:", typeof pdfParsePackage, "Keys:", Object.keys(pdfParsePackage || {}));
      throw new Error("The PDF processing engine failed to initialize. Please try again later.");
    }

    let data;
    try {
      data = await parseFunc(file.buffer);
    } catch (extractErr: any) {
      console.error("[PDF Extraction Error]:", extractErr.message);
      throw new Error(`Failed to extract text from PDF: ${extractErr.message}`);
    }

    const extractedText = data?.text;
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

    const batchSize = 5;
    for (let i = 0; i < limitedSentences.length; i += batchSize) {
      const batch = limitedSentences.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (sentence) => {
        try {
          return await translateText(sentence, sourceLang, targetLang);
        } catch {
          return sentence;
        }
      }));
      translatedSentences.push(...batchResults);
      await sleep(250); // Optimized delay for stability
      
      const p = 20 + Math.floor((translatedSentences.length / limitedSentences.length) * 65);
      updateJob(jobId, { 
        status: `Translating (${translatedSentences.length}/${limitedSentences.length})...`, 
        progress: p 
      });
    }

    updateJob(jobId, { status: "Preparing final document...", progress: 90 });
    
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    
    const isIndic = targetLang === 'ne' || targetLang === 'tmg';
    const preferredBuffer = isIndic ? devanagariFontBuffer : latinFontBuffer;
    let font;
    
    if (preferredBuffer) {
      font = await pdfDoc.embedFont(preferredBuffer);
    } else {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const fontSize = 11;
    const margin = 50;
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const wrapWidth = pageWidth - 2 * margin;
    let y = pageHeight - margin;

    const wrapText = (text: string, width: number) => {
      const words = text.split(/\s+/);
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
          console.warn("[PDF Draw Error] Character issue in line, skipping parts.");
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
