import datetime
import os
import webbrowser
import requests
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
import google.generativeai as genai

# Load shared API configuration
load_dotenv("backend/.env")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
AGENT_API_BASE = "http://localhost:8000"

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def call_agent_api(goal: str, city: str = "Hyderabad") -> str:
    """Route a command through the Neural OS agent API."""
    try:
        res = requests.post(
            f"{AGENT_API_BASE}/api/agent/execute",
            json={"goal": goal, "city": city},
            timeout=30
        )
        if res.status_code == 200:
            data = res.json()
            return data.get("spoken_summary") or data.get("final_answer") or "Task completed."
    except Exception:
        pass
    return None


def call_chat_api(message: str, city: str = "Hyderabad") -> str:
    """Use the simple chat API for quick Q&A."""
    try:
        res = requests.post(
            f"{AGENT_API_BASE}/api/chat",
            json={"message": message, "city": city},
            timeout=10
        )
        if res.status_code == 200:
            return res.json().get("reply", "")
    except Exception:
        pass
    return None


class Brain:
    def __init__(self):
        self.city = "Hyderabad"

    def process(self, command: str) -> str:
        command_lower = command.lower().strip()

        # ── Fast local responses ───────────────────────────────────
        if any(w in command_lower for w in ["what time", "current time", "time is"]):
            return f"The time is {datetime.datetime.now().strftime('%I:%M %p')}"

        if any(w in command_lower for w in ["what date", "today's date", "what day"]):
            return f"Today is {datetime.datetime.now().strftime('%A, %B %d, %Y')}"

        if "stop" in command_lower or "shutdown" in command_lower:
            exit("Neural OS shutting down...")

        if "hello" in command_lower or "hi karna" in command_lower:
            return "Hello, I am Neural OS. All systems are online. How can I assist you?"

        if "who are you" in command_lower or "your name" in command_lower:
            return "I am Neural OS, your autonomous AI agent. I can search the web, control applications, manage files, check weather, and much more."

        # ── Open applications locally if backend is down ───────────
        if "open youtube" in command_lower:
            webbrowser.open("https://youtube.com")
            return "Opening YouTube in your browser."

        if "open google" in command_lower:
            webbrowser.open("https://google.com")
            return "Opening Google."

        # ── Route to Agent API (multi-step orchestration) ─────────
        # Determine if this is a complex agent task
        agent_keywords = [
            "find", "search", "download", "create", "write", "open", "close",
            "weather", "news", "happening", "system", "files", "folder",
            "show me", "tell me", "what is", "how is", "give me"
        ]
        needs_agent = any(kw in command_lower for kw in agent_keywords)

        if needs_agent:
            result = call_agent_api(command, self.city)
            if result:
                return result

        # ── Direct Gemini chat fallback ────────────────────────────
        chat_result = call_chat_api(command, self.city)
        if chat_result:
            return chat_result

        # ── Offline fallback ───────────────────────────────────────
        return (
            "Neural OS is operating in offline mode. "
            "Please ensure the backend server is running on port 8000 for full capabilities."
        )
