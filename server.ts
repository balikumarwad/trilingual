import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Mock Translation Service (Original logic from translation_service.py)
const translateText = (text: string, source_lang: string, target_lang: string): string => {
  if (!text || typeof text !== 'string' || !text.trim()) return text;
  return `Translated: [${text.trim()}] from ${source_lang} to ${target_lang}`;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  const upload = multer({ storage: multer.memoryStorage() });

  // Translation Endpoints - Now handled directly in Node.js to fix deployment
  
  // CSV Translation
  app.post("/api/translate/csv", upload.single("file"), (req, res) => {
    try {
      const file = req.file;
      const targetLang = req.body.target_lang || "ne";
      const sourceLang = req.body.source_lang || "en";

      if (!file) return res.status(400).send("No file uploaded");

      const csvContent = file.buffer.toString();
      const records = parseCsv(csvContent, { 
        columns: true, 
        skip_empty_lines: true,
        relax_column_count: true 
      });
      
      const translatedRecords = records.map((row: any) => {
        const newRow: any = {};
        for (const [key, value] of Object.entries(row)) {
          newRow[key] = translateText(value as string, sourceLang, targetLang);
        }
        return newRow;
      });

      const output = stringifyCsv(translatedRecords, { header: true });
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=translated_${file.originalname}`);
      res.send(output);
    } catch (err) {
      console.error("[CSV Error]:", err);
      res.status(500).send("CSV processing failed");
    }
  });

  // DOCX Translation - Basic implementation for fixed fonts/structure
  app.post("/api/translate/docx", (req, res) => {
    res.status(501).send("DOCX structure-preserving translation requires a Python environment. This Node.js runtime currently supports CSV and PDF (simple).");
  });

  // PDF Translation - Simple rendering for MVP
  app.post("/api/translate/pdf", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      const targetLang = req.body.target_lang || "ne";
      const sourceLang = req.body.source_lang || "en";

      if (!file) return res.status(400).send("No file uploaded");

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      const translated = translateText(`File: ${file.originalname} processed by LinguistHub Node Engine`, sourceLang, targetLang);

      page.drawText("LinguistHub Translation Report (PDF Rendering)", {
        x: 50,
        y: page.getHeight() - 50,
        size: 16,
        font: font,
        color: rgb(0, 0, 0),
      });

      page.drawText(translated, {
        x: 50,
        y: page.getHeight() - 100,
        size: 12,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });

      const pdfBytes = await pdfDoc.save();
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=translated_${file.originalname}`);
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      console.error("[PDF Error]:", err);
      res.status(500).send("PDF processing failed");
    }
  });

  // Health Check
  app.get("/api/ping", (req, res) => {
    res.json({ status: "ok", engine: "Node.js (Unified)", timestamp: new Date().toISOString() });
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
