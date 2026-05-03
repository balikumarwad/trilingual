import axios from "axios";
async function test() {
  try {
    const res = await axios.get("https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf", { responseType: 'arraybuffer', timeout: 5000 });
    console.log("Success latin:", res.data.length);
  } catch (e) {
    console.log("Error latin:", e.message);
  }
}
test();
