# @license
# SPDX-License-Identifier: Apache-2.0

import httpx
import logging

class TMTService:
    """
    Service class for interacting with the Kathmandu University ILPRL TMT API.
    """
    def __init__(self):
        # Configuration for the KU TMT endpoint
        self.api_url = "https://tmt.ilprl.ku.edu.np/lang-translate"
        self.api_key = "team_0c4cf201a499ccad"
        self.timeout = 20.0  # Sufficient timeout for larger document chunks

    def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        """
        Sends text to the KU ILPRL endpoint for translation.
        """
        if not text or not text.strip():
            return text

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Payload structure for the KU TMT API
        payload = {
            "text": text,
            "src_lang": source_lang,
            "tgt_lang": target_lang
        }

        try:
            with httpx.Client() as client:
                response = client.post(
                    self.api_url, 
                    json=payload, 
                    headers=headers, 
                    timeout=self.timeout
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Documentation shows "message_type": "SUCCESS" and "output"
                    if data.get("message_type") == "SUCCESS":
                        return data.get("output", text)
                    
                    # Fallback for other formats
                    return data.get("output") or data.get("translated_text") or text
                else:
                    logging.error(f"API Error {response.status_code}: {response.text}")
                    return text

        except httpx.ConnectError:
            logging.error("Failed to connect to the KU TMT Server.")
            return text
        except Exception as e:
            logging.error(f"Unexpected error during translation: {e}")
            return text

# Example Usage:
# service = TMTService()
# print(service.translate_text("Hello", "en", "ne"))
