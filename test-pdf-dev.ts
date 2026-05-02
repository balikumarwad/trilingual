import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import axios from 'axios';
import fs from 'fs';

async function test() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const res = await axios.get("https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf", { responseType: 'arraybuffer' });
  const font = await pdfDoc.embedFont(res.data);
  const page = pdfDoc.addPage();
  page.drawText("नमस्ते म नेपालबाट हुँ", { font, size: 24, x: 50, y: 500 });
  fs.writeFileSync('test.pdf', await pdfDoc.save());
}
test().catch(console.error);
