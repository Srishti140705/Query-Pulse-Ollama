from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from fastapi import HTTPException


class AIService:
    def __init__(self) -> None:
        self.provider = (os.getenv("AI_PROVIDER") or "ollama").lower()
        self.timeout = int(os.getenv("AI_TIMEOUT_SECONDS") or "60")

    def generate_json(self, instruction: str) -> dict:
        if self.provider == "ollama":
            return self._ollama(instruction)
        if self.provider == "gemini":
            return self._gemini(instruction)
        raise HTTPException(status_code=500, detail="AI_PROVIDER must be 'ollama' or 'gemini'")

    def _ollama(self, instruction: str) -> dict:
        base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        model = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:3b")
        body = json.dumps({"model": model, "prompt": instruction, "format": "json", "stream": False}).encode("utf-8")
        request = urllib.request.Request(f"{base_url}/api/generate", data=body, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return json.loads(payload["response"])
        except urllib.error.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Local Ollama request failed. Confirm the selected model is installed.") from exc
        except (urllib.error.URLError, TimeoutError):
            raise HTTPException(status_code=503, detail="Ollama is not running. Start Ollama, then try again.")
        except (KeyError, json.JSONDecodeError):
            raise HTTPException(status_code=502, detail="Local model returned an invalid response. Try again or use another model.")

    def _gemini(self, instruction: str) -> dict:
        api_key = os.getenv("GEMINI_API_KEY")
        model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        if not api_key:
            raise HTTPException(status_code=503, detail="Gemini is not configured. Set GEMINI_API_KEY or use AI_PROVIDER=ollama.")
        body = json.dumps({"contents": [{"parts": [{"text": instruction}]}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}}).encode("utf-8")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return json.loads(payload["candidates"][0]["content"]["parts"][0]["text"])
        except urllib.error.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Gemini provider request failed") from exc
        except (urllib.error.URLError, TimeoutError):
            raise HTTPException(status_code=504, detail="Gemini provider timed out or is unavailable")
        except (KeyError, IndexError, json.JSONDecodeError):
            raise HTTPException(status_code=502, detail="Gemini provider returned an invalid response")


def ai_service() -> AIService:
    return AIService()
