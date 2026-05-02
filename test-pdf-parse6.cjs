const { createRequire } = require('module');
const myRequire = createRequire(__filename);
const pdf = myRequire('pdf-parse');
console.log(typeof pdf);
console.log(Object.keys(pdf));
