const { createRequire } = require('module');
const pdfParse = require('pdf-parse');
console.log("Type:", typeof pdfParse);
console.log("Keys:", Object.keys(pdfParse));
if (typeof pdfParse !== 'function') {
  if (pdfParse.default) {
    console.log("pdfParse.default type:", typeof pdfParse.default);
  }
}
