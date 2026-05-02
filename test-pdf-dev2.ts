import 'regenerator-runtime/runtime.js';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import axios from 'axios';

async function test() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const res = await axios.get("https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf", { responseType: 'arraybuffer' });
  const font = await pdfDoc.embedFont(res.data);
  const str = "नमस्ते";
  for (const char of str) {
    try {
      font.widthOfTextAtSize(char, 24);
      console.log(char, "OK");
    } catch(e: any) {
      console.log(char, "ERR", e.message);
    }
  }
}
test().catch(console.error);
