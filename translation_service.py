import httpx
import logging
import re
import asyncio

class TMTService:
    def __init__(self):
        self.api_url = "https://tmt.ilprl.ku.edu.np/lang-translate"
        self.api_key = "team_0c4cf201a499ccad"
        self.timeout = 60.0

    def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        # १. अनावश्यक स्पेस र न्यु-लाइन हटाउने
        text = " ".join(text.split()).strip()
        
        if not text or len(text) < 2:
            return text

        # २. तामाङ-अङ्ग्रेजी ब्रिज लजिक (Accuracy को लागि)
        # यदि English <-> Tamang छ भने पहिला नेपालीमा अनुवाद गर्ने
        if source_lang == "en" and target_lang == "taj":
            nepali_bridge = self.translate_text(text, "en", "ne")
            return self.translate_text(nepali_bridge, "ne", "taj")
        
        if source_lang == "taj" and target_lang == "en":
            nepali_bridge = self.translate_text(text, "taj", "ne")
            return self.translate_text(nepali_bridge, "ne", "en")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # ३. प्रोम्प्ट ट्युनिङ: AI लाई शुद्ध अनुवाद मात्र गर्न निर्देशन दिने
        payload = {
            "text": text,
            "src_lang": source_lang,
            "tgt_lang": target_lang
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(self.api_url, json=payload, headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    result = data.get("output", text).strip()
                    
                    # ४. अनावश्यक Labels हटाउने (Regex Fix)
                    patterns = [
                        r"^(English|Nepali|Tamang|नेपाली|तामाङ|Translation)[:\s\-]*",
                        r"^.*?अनुवाद[:\s\-]*",
                        r"^\(.*?\) " 
                    ]
                    
                    for pattern in patterns:
                        result = re.sub(pattern, "", result, flags=re.IGNORECASE).strip()
                    
                    # ५. युनिकोड र अदृश्य क्यारेक्टर सफा गर्ने
                    clean_result = result.replace("\u200b", "").replace("\u200c", "").replace("\u200d", "")
                    return clean_result
                
                logging.error(f"API Error: {response.status_code}")
                return text

        except Exception as e:
            logging.error(f"Translation Service Error: {e}")
            return text