import axios from "axios";
async function test() {
  try {
    const res = await axios.get("https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf", { responseType: 'arraybuffer', timeout: 5000 });
    console.log("Success devanagari:", res.data.length);
  } catch (e) {
    console.log("Error devanagari:", e.message);
  }
}
test();
