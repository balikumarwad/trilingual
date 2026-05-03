import 'regenerator-runtime/runtime.js';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import axios from 'axios';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParsePackage = require('pdf-parse');

async function test() {
  const [poppins] = await Promise.all([
    axios.get("https://raw.githubusercontent.com/googlefonts/poppins/main/products/Poppins-Regular.ttf", { responseType: 'arraybuffer' })
  ]);
  
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(poppins.data);
  const page = pdfDoc.addPage();
  page.drawText("परियोजनाको Brief description of the project (max. 300 words)", { font, size: 12, x: 50, y: 50 });
  const pdfBytes = await pdfDoc.save();
  const parser = new pdfParsePackage.PDFParse({ data: pdfBytes });
  const data = await parser.getText();
  console.log("Extracted Poppins:");
  console.log(data.text);
}
test().catch(console.error);
