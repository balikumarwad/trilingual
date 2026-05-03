import 'regenerator-runtime/runtime.js';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import axios from 'axios';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParsePackage = require('pdf-parse');

async function test() {
  const [hinted, unhinted] = await Promise.all([
    axios.get("https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf", { responseType: 'arraybuffer' }),
    axios.get("https://raw.githubusercontent.com/googlefonts/noto-fonts/main/unhinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf", { responseType: 'arraybuffer' })
  ]);
  
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(unhinted.data);
  const page = pdfDoc.addPage();
  page.drawText("Brief description of the project (max. 300 words)", { font, size: 12, x: 50, y: 50 });
  const pdfBytes = await pdfDoc.save();
  const parser = new pdfParsePackage.PDFParse({ data: pdfBytes });
  const data = await parser.getText();
  console.log("Extracted unhinted:");
  console.log(data.text);
}
test().catch(console.error);
