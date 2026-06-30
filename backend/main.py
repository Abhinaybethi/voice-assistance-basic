"""
Neural OS — FastAPI Backend
Upgraded with: Agent Orchestrator, Tool Registry, Memory Manager, Task Planner
"""

import os
import json
import asyncio
from typing import Optional, AsyncGenerator
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests
from dotenv import load_dotenv
from google import genai

from memory_manager import get_all as memory_get_all, remember, recall, forget, log_command, get_all
from tool_manager import execute_tool, TOOL_REGISTRY, get_system_info
from agent_orchestrator import create_orchestrator
from task_planner import generate_plan, get_step_icon

load_dotenv()

app = FastAPI(title="Neural OS — Autonomous Agent Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_genai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Global agent orchestrator (lazy init)
_orchestrator = None

def get_orchestrator():
    global _orchestrator
    if _orchestrator is None and GEMINI_API_KEY:
        _orchestrator = create_orchestrator()
    return _orchestrator


# ─── Request/Response Models ──────────────────────────────────────────────────

class SummarizeRequest(BaseModel):
    city: str
    headlines: list[str]

class AgentExecuteRequest(BaseModel):
    goal: str
    city: str = "Hyderabad"

class MemoryRequest(BaseModel):
    category: str
    key: str
    value: str

class ToolExecuteRequest(BaseModel):
    tool_name: str
    args: dict = {}

class ChatRequest(BaseModel):
    message: str
    city: str = "Hyderabad"


# ─── Existing Endpoints (preserved) ──────────────────────────────────────────

def get_mock_news(city: str):
    return [
        {"title": f"{city} Smart Grid Upgrade Initiative Launched", "source": "TechCity News", "published": "10 mins ago", "image": "https://picsum.photos/id/1/200/120"},
        {"title": f"Local AI Innovation Hub to open in {city} next quarter", "source": "Global Industry Info", "published": "2 hours ago", "image": "https://picsum.photos/id/3/200/120"},
        {"title": f"Extreme Weather Advisory: {city} alerts residents of storm systems", "source": "Met Service", "published": "4 hours ago", "image": "https://picsum.photos/id/4/200/120"},
        {"title": f"Clean Energy Project approved for local {city} districts", "source": "EcoDaily", "published": "6 hours ago", "image": "https://picsum.photos/id/10/200/120"}
    ]

def get_live_intelligence(query_str, max_records=4):
    import xml.etree.ElementTree as ET
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

    try:
        url = "https://api.gdeltproject.org/api/v2/doc/doc"
        params = {"query": query_str, "mode": "artlist", "format": "json", "maxrecords": max_records}
        response = requests.get(url, params=params, headers=headers, timeout=8)
        if response.status_code == 200:
            articles = response.json().get("articles", [])
            if articles:
                return [{"title": art.get("title", ""), "source": art.get("domain", "GDELT"), "published": "Recent", "image": art.get("socialimage") or f"https://picsum.photos/id/{10+i}/200/120"} for i, art in enumerate(articles)]
    except Exception:
        pass

    try:
        rss_url = f"https://news.google.com/rss/search?q={requests.utils.quote(query_str)}&hl=en-US&gl=US&ceid=US:en"
        response = requests.get(rss_url, headers=headers, timeout=8)
        if response.status_code == 200:
            root = ET.fromstring(response.text)
            news_items = []
            for idx, item in enumerate(root.findall(".//item")[:max_records]):
                title_text = item.find("title").text
                source_text = "Google News"
                if " - " in title_text:
                    title_text, source_text = title_text.rsplit(" - ", 1)
                news_items.append({"title": title_text, "source": source_text, "published": "Recent", "image": f"https://picsum.photos/id/{10+idx}/200/120"})
            return news_items
    except Exception:
        pass

    return []

@app.get("/api/reverse-geocode")
async def reverse_geocode(lat: float = Query(...), lon: float = Query(...)):
    url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json"
    headers = {"User-Agent": "NeuralOS/2.0 (abhinaybethi26@gmail.com)"}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            address = data.get("address", {})
            city = address.get("city") or address.get("town") or address.get("village") or address.get("suburb") or "Unknown Location"
            return {"city": city, "country": address.get("country", ""), "display_name": data.get("display_name", "")}
    except Exception:
        pass
    return {"city": "Hyderabad", "country": "India", "display_name": "Hyderabad, India"}

@app.get("/api/news")
async def get_news_endpoint(city: str = Query(...)):
    live_news = get_live_intelligence(city)
    if live_news:
        return live_news
    return get_mock_news(city)

@app.post("/api/summarize")
async def summarize_news(request: SummarizeRequest):
    city = request.city
    headlines = request.headlines
    if not headlines:
        return {"summary": f"Initializing voice link. Welcome to {city}. No active news items at this time."}

    summary_prompt = (
        f"You are Neural OS, a futuristic AI voice assistant. Summarize the following news headlines "
        f"for the city of {city}. Keep it brief, conversational, and futuristic (3 to 4 sentences). "
        f"Prefix with a welcoming greeting. Headlines: {', '.join(headlines)}"
    )

    if _genai_client:
        try:
            response = _genai_client.models.generate_content(
                model="gemini-1.5-flash",
                contents=summary_prompt
            )
            return {"summary": response.text.strip()}
        except Exception:
            pass

    return {"summary": f"Systems online. Welcome to {city}. Your local intelligence feeds are synchronized and active."}

@app.get("/api/status")
async def get_status():
    return {
        "gps": "active",
        "internet": "connected",
        "api": "active" if GEMINI_API_KEY else "simulation_mode",
        "voice": "active",
        "news": "synchronized",
        "agent": "ready" if get_orchestrator() else "simulation_mode",
        "tools": len(TOOL_REGISTRY),
        "version": "2.0.0"
    }


# ─── NEW: Agent Endpoints ─────────────────────────────────────────────────────

@app.post("/api/agent/execute")
async def agent_execute(request: AgentExecuteRequest):
    """
    Master agent endpoint. Executes a natural language goal using
    the Gemini function-calling orchestrator.
    """
    goal = request.goal.strip()
    if not goal:
        raise HTTPException(status_code=400, detail="Goal cannot be empty")

    log_command(goal, "agent_execute")

    orchestrator = get_orchestrator()
    if not orchestrator:
        # Simulation mode: use basic Gemini without tools
        if _genai_client:
            try:
                prompt = f"You are Neural OS. Answer briefly and futuristically: {goal}"
                response = _genai_client.models.generate_content(
                    model="gemini-1.5-flash",
                    contents=prompt
                )
                answer = response.text.strip()
                return {
                    "goal": goal,
                    "steps": [{"step_number": 1, "description": "Process with Gemini AI", "tool": "synthesize", "status": "done", "result": answer}],
                    "final_answer": answer,
                    "spoken_summary": answer,
                    "tool_calls": [],
                    "success": True,
                    "mode": "gemini_direct"
                }
            except Exception as e:
                pass

        return {
            "goal": goal,
            "steps": [],
            "final_answer": f"Neural OS is running in simulation mode. Configure GEMINI_API_KEY for full agent capabilities. Your goal was: {goal}",
            "spoken_summary": "Neural OS is in simulation mode. Please configure your API key for full capabilities.",
            "tool_calls": [],
            "success": False,
            "mode": "simulation"
        }

    # Run the full agentic loop
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: orchestrator.execute(goal, request.city)
    )
    return {**result, "mode": "agent"}


@app.post("/api/agent/plan")
async def agent_plan(request: AgentExecuteRequest):
    """
    Generate a structured multi-step plan for a goal without executing it.
    Returns the plan for UI display.
    """
    plan = generate_plan(request.goal, request.city)
    # Add icons for UI
    for step in plan:
        step["icon"] = get_step_icon(step.get("tool", ""))
    return {"goal": request.goal, "plan": plan, "total_steps": len(plan)}


@app.get("/api/agent/stream")
async def agent_stream(goal: str = Query(...), city: str = Query("Hyderabad")):
    """
    SSE streaming endpoint for real-time agent progress updates.
    The frontend can subscribe and see tool calls as they happen.
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        orchestrator = get_orchestrator()
        if not orchestrator:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Agent not configured'})}\n\n"
            return

        events = []
        done = asyncio.Event()

        def progress_callback(event: dict):
            events.append(event)

        async def run_agent():
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: orchestrator.execute(goal, city, progress_callback)
            )
            done.set()

        task = asyncio.create_task(run_agent())

        # Stream events as they come in
        sent_idx = 0
        while not done.is_set() or sent_idx < len(events):
            if sent_idx < len(events):
                event = events[sent_idx]
                yield f"data: {json.dumps(event)}\n\n"
                sent_idx += 1
            else:
                await asyncio.sleep(0.1)

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


# ─── NEW: Tool Endpoints ──────────────────────────────────────────────────────

@app.get("/api/tools")
async def list_tools():
    """List all available agent tools with descriptions."""
    return {
        "tools": [
            {"name": name, "description": info["description"]}
            for name, info in TOOL_REGISTRY.items()
        ],
        "count": len(TOOL_REGISTRY)
    }

@app.post("/api/tools/execute")
async def execute_tool_endpoint(request: ToolExecuteRequest):
    """Directly execute a specific tool with given args."""
    result = execute_tool(request.tool_name, request.args)
    return {"tool": request.tool_name, "args": request.args, "result": result}

@app.get("/api/tools/system")
async def system_info():
    """Get current system information."""
    return get_system_info()

@app.get("/api/tools/weather")
async def weather_endpoint(city: str = Query("Hyderabad")):
    """Get weather for a city."""
    from tool_manager import get_weather
    return get_weather(city)

@app.get("/api/tools/search")
async def search_endpoint(q: str = Query(...)):
    """Search the web."""
    from tool_manager import search_web
    return search_web(q)


# ─── NEW: Memory Endpoints ────────────────────────────────────────────────────

@app.get("/api/memory")
async def get_memory():
    """Return the full agent memory store."""
    return memory_get_all()

@app.post("/api/memory")
async def set_memory(request: MemoryRequest):
    """Store a value in the agent memory."""
    return remember(request.category, request.key, request.value)

@app.delete("/api/memory/{category}/{key}")
async def delete_memory(category: str, key: str):
    """Remove a memory entry."""
    return forget(category, key)

@app.get("/api/memory/{category}")
async def get_memory_category(category: str):
    """Return all memory in a specific category."""
    result = recall(category)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Memory category '{category}' not found")
    return {category: result}


# ─── Chat via Tavily (no Gemini needed) ──────────────────────────────────────

class TavilyChatRequest(BaseModel):
    message: str
    city: str = "Hyderabad"
    search_depth: str = "advanced"

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """Legacy Gemini chat — falls through to Tavily if no API key."""
    tavily_req = TavilyChatRequest(message=request.message, city=request.city)
    return await tavily_chat_endpoint(tavily_req)


@app.post("/api/tavily/chat")
async def tavily_chat_endpoint(request: TavilyChatRequest):
    """
    Tavily-powered conversational search chat.
    Uses Tavily's synthesized answer as the AI response and returns
    source links alongside it. Works without any Gemini/OpenAI key.
    """
    TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
    if not TAVILY_API_KEY:
        return {
            "reply": "Tavily API key not configured. Add TAVILY_API_KEY to .env.",
            "sources": [],
            "engine": "none",
        }

    # Enrich query with city context for location-aware queries
    location_keywords = ["weather", "news", "near", "local", "today", "here"]
    query = request.message
    if any(kw in query.lower() for kw in location_keywords):
        query = f"{request.message} {request.city}"

    try:
        tavily_url = "https://api.tavily.com/search"
        payload = {
            "api_key": TAVILY_API_KEY,
            "query": query,
            "max_results": 5,
            "search_depth": request.search_depth,
            "include_answer": True,
            "include_raw_content": False,
        }
        res = requests.post(tavily_url, json=payload, timeout=15)
        res.raise_for_status()
        data = res.json()

        answer = data.get("answer", "").strip()
        sources = [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "snippet": r.get("content", "")[:200],
                "score": r.get("score", 0),
            }
            for r in data.get("results", [])[:4]
        ]

        if not answer:
            # Fall back to top result snippet
            answer = sources[0]["snippet"] if sources else "No results found for your query."

        # Prepend a futuristic Neural OS framing
        reply = f"{answer}"

        return {
            "reply": reply,
            "sources": sources,
            "engine": "tavily",
            "query_used": query,
        }

    except Exception as e:
        return {
            "reply": f"Search subsystem error: {str(e)}",
            "sources": [],
            "engine": "error",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
