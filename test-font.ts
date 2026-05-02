import axios from 'axios';
axios.head('https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf')
  .then(res => console.log('DEVANAGARI OK:', res.status))
  .catch(err => console.log('DEVANAGARI ERR:', err.response?.status));

axios.head('https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf')
  .then(res => console.log('LATIN OK:', res.status))
  .catch(err => console.log('LATIN ERR:', err.response?.status));
