"""
tool_manager.py — Neural OS Tool Registry

All executable agent tools. Each tool is a pure function that returns
a structured dict result. Tools are sandboxed and safe by default.
"""

import os
import subprocess
import platform
import json
import shutil
import webbrowser
from pathlib import Path
from datetime import datetime
from typing import Optional
import requests

# ─── Safety sandbox: only allow file ops inside user home ────────────────────
HOME = Path.home()
SAFE_ROOTS = [HOME, HOME / "Desktop", HOME / "Downloads", HOME / "Documents", HOME / "Personal"]

def _is_safe_path(path_str: str) -> bool:
    try:
        p = Path(path_str).resolve()
        return any(str(p).startswith(str(root)) for root in SAFE_ROOTS)
    except Exception:
        return False


# ─── SYSTEM INFO ─────────────────────────────────────────────────────────────
def get_system_info() -> dict:
    """Return CPU, RAM, disk usage."""
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.5)
        ram = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        processes = [p.name() for p in psutil.process_iter(['name']) if p.info.get('name')][:20]
        return {
            "cpu_percent": cpu,
            "ram_used_gb": round(ram.used / 1e9, 2),
            "ram_total_gb": round(ram.total / 1e9, 2),
            "ram_percent": ram.percent,
            "disk_used_gb": round(disk.used / 1e9, 2),
            "disk_total_gb": round(disk.total / 1e9, 2),
            "disk_percent": disk.percent,
            "top_processes": processes,
            "platform": platform.system(),
            "machine": platform.machine()
        }
    except ImportError:
        return {"error": "psutil not installed. Run: pip install psutil"}
    except Exception as e:
        return {"error": str(e)}


# ─── APPLICATION CONTROL ─────────────────────────────────────────────────────
APP_MAP = {
    "chrome": ["chrome", "google chrome", "google-chrome"],
    "firefox": ["firefox"],
    "edge": ["msedge", "edge"],
    "notepad": ["notepad"],
    "vscode": ["code", "visual studio code"],
    "spotify": ["spotify"],
    "discord": ["discord"],
    "explorer": ["explorer"],
    "terminal": ["cmd", "powershell", "wt"],
    "calculator": ["calc"],
    "paint": ["mspaint"],
    "word": ["winword"],
    "excel": ["excel"],
}

def _resolve_app(name: str) -> str:
    """Map friendly name to executable."""
    name_lower = name.lower().strip()
    for exe, aliases in APP_MAP.items():
        if name_lower == exe or name_lower in aliases:
            return exe
    return name_lower

def open_application(app_name: str) -> dict:
    """Open an application by name."""
    exe = _resolve_app(app_name)
    try:
        if platform.system() == "Windows":
            os.startfile(exe) if exe in ("explorer",) else subprocess.Popen(
                exe, shell=True, creationflags=subprocess.CREATE_NEW_CONSOLE
            )
        else:
            subprocess.Popen([exe], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"status": "opened", "app": app_name, "executable": exe}
    except Exception as e:
        # Try via webbrowser for URLs
        if app_name.startswith("http"):
            webbrowser.open(app_name)
            return {"status": "opened_in_browser", "url": app_name}
        return {"status": "error", "app": app_name, "error": str(e)}

def open_url(url: str) -> dict:
    """Open a URL in the default browser."""
    if not url.startswith("http"):
        url = "https://" + url
    webbrowser.open(url)
    return {"status": "opened", "url": url}

def close_application(app_name: str) -> dict:
    """Close a running application by name."""
    try:
        import psutil
        exe = _resolve_app(app_name)
        killed = []
        for proc in psutil.process_iter(['name', 'pid']):
            try:
                pname = proc.info['name'].lower()
                if exe in pname or app_name.lower() in pname:
                    proc.terminate()
                    killed.append(proc.info['name'])
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        if killed:
            return {"status": "closed", "processes": killed}
        return {"status": "not_found", "app": app_name}
    except ImportError:
        return {"error": "psutil not installed"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ─── FILE SYSTEM ─────────────────────────────────────────────────────────────
def list_directory(path: str = None) -> dict:
    """List contents of a directory."""
    target = Path(path) if path else HOME
    if not _is_safe_path(str(target)):
        return {"error": f"Path not in allowed directories: {target}"}
    try:
        items = []
        for item in sorted(target.iterdir()):
            items.append({
                "name": item.name,
                "type": "directory" if item.is_dir() else "file",
                "size_bytes": item.stat().st_size if item.is_file() else None,
                "modified": datetime.fromtimestamp(item.stat().st_mtime).isoformat()
            })
        return {"path": str(target), "items": items, "count": len(items)}
    except Exception as e:
        return {"error": str(e)}

def read_file(path: str) -> dict:
    """Read a file's contents."""
    target = Path(path)
    if not _is_safe_path(str(target)):
        return {"error": "Path not in allowed directories"}
    try:
        if not target.exists():
            return {"error": f"File not found: {path}"}
        if target.stat().st_size > 1_000_000:  # 1MB limit
            return {"error": "File too large to read (>1MB)"}
        content = target.read_text(encoding="utf-8", errors="replace")
        return {
            "path": str(target),
            "content": content[:5000],  # Truncate for agent context
            "size_bytes": target.stat().st_size,
            "truncated": len(content) > 5000
        }
    except Exception as e:
        return {"error": str(e)}

def write_file(path: str, content: str) -> dict:
    """Write content to a file, creating parent dirs as needed."""
    target = Path(path)
    if not _is_safe_path(str(target)):
        return {"error": "Path not in allowed directories"}
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {"status": "written", "path": str(target), "size_bytes": target.stat().st_size}
    except Exception as e:
        return {"error": str(e)}

def create_folder(path: str) -> dict:
    """Create a new folder."""
    target = Path(path)
    if not _is_safe_path(str(target)):
        return {"error": "Path not in allowed directories"}
    try:
        target.mkdir(parents=True, exist_ok=True)
        return {"status": "created", "path": str(target)}
    except Exception as e:
        return {"error": str(e)}

def move_file(source: str, destination: str) -> dict:
    """Move a file or folder."""
    src = Path(source)
    dst = Path(destination)
    if not _is_safe_path(str(src)) or not _is_safe_path(str(dst)):
        return {"error": "Paths not in allowed directories"}
    try:
        shutil.move(str(src), str(dst))
        return {"status": "moved", "from": str(src), "to": str(dst)}
    except Exception as e:
        return {"error": str(e)}

def delete_file(path: str, confirmed: bool = False) -> dict:
    """Delete a file. Requires confirmed=True for safety."""
    if not confirmed:
        return {
            "status": "confirmation_required",
            "message": f"Are you sure you want to delete '{path}'? This cannot be undone.",
            "path": path
        }
    target = Path(path)
    if not _is_safe_path(str(target)):
        return {"error": "Path not in allowed directories"}
    try:
        if target.is_dir():
            shutil.rmtree(str(target))
        else:
            target.unlink()
        return {"status": "deleted", "path": str(target)}
    except Exception as e:
        return {"error": str(e)}

def search_files(name: str, search_path: str = None) -> dict:
    """Search for files matching a name pattern."""
    root = Path(search_path) if search_path else HOME
    if not _is_safe_path(str(root)):
        return {"error": "Path not in allowed directories"}
    try:
        matches = []
        for match in root.rglob(f"*{name}*"):
            if len(matches) >= 20:
                break
            matches.append({
                "path": str(match),
                "name": match.name,
                "type": "directory" if match.is_dir() else "file"
            })
        return {"query": name, "matches": matches, "count": len(matches)}
    except Exception as e:
        return {"error": str(e)}


# ─── WEATHER ─────────────────────────────────────────────────────────────────
def get_weather(city: str = "Hyderabad") -> dict:
    """Get current weather from Open-Meteo (free, no API key)."""
    try:
        # Geocode city name
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={requests.utils.quote(city)}&count=1"
        geo_res = requests.get(geo_url, timeout=8)
        if not geo_res.ok:
            return {"error": "Geocoding failed"}
        geo_data = geo_res.json()
        if not geo_data.get("results"):
            return {"error": f"City not found: {city}"}

        loc = geo_data["results"][0]
        lat, lon = loc["latitude"], loc["longitude"]

        # Fetch weather
        weather_url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code"
            f"&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto"
        )
        w_res = requests.get(weather_url, timeout=8)
        if not w_res.ok:
            return {"error": "Weather API failed"}
        w_data = w_res.json()
        current = w_data.get("current", {})

        # WMO weather code map (simplified)
        code = current.get("weather_code", 0)
        conditions = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Moderate drizzle",
            61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
            71: "Light snow", 73: "Moderate snow", 75: "Heavy snow",
            80: "Light showers", 81: "Moderate showers", 82: "Violent showers",
            95: "Thunderstorm", 99: "Thunderstorm with hail"
        }
        condition = conditions.get(code, f"Weather code {code}")

        return {
            "city": loc.get("name", city),
            "country": loc.get("country", ""),
            "temperature_c": current.get("temperature_2m"),
            "humidity_percent": current.get("relative_humidity_2m"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "condition": condition,
            "latitude": lat,
            "longitude": lon
        }
    except Exception as e:
        return {"error": str(e)}


# ─── WEB SEARCH ──────────────────────────────────────────────────────────────
def search_web(query: str, max_results: int = 5, search_depth: str = "basic") -> dict:
    """Search the web using Tavily (primary) with DuckDuckGo as fallback.

    Args:
        query: The search query string.
        max_results: Maximum number of results to return (default 5).
        search_depth: 'basic' (fast) or 'advanced' (deeper, slower).
    """
    results = []
    engine_used = "none"

    # ── Primary: Tavily Search API ────────────────────────────────────────────
    tavily_key = os.getenv("TAVILY_API_KEY", "")
    if tavily_key:
        try:
            tavily_url = "https://api.tavily.com/search"
            payload = {
                "api_key": tavily_key,
                "query": query,
                "max_results": max_results,
                "search_depth": search_depth,
                "include_answer": True,
                "include_raw_content": False,
            }
            res = requests.post(tavily_url, json=payload, timeout=12)
            if res.ok:
                data = res.json()
                # Tavily direct answer (synthesized)
                direct_answer = data.get("answer", "")
                if direct_answer:
                    results.append({
                        "title": "Direct Answer",
                        "snippet": direct_answer,
                        "source": "Tavily AI",
                        "url": "",
                        "score": 1.0,
                    })
                # Individual search results
                for item in data.get("results", [])[:max_results]:
                    results.append({
                        "title": item.get("title", ""),
                        "snippet": item.get("content", ""),
                        "source": item.get("url", "").split("/")[2] if item.get("url") else "Tavily",
                        "url": item.get("url", ""),
                        "score": item.get("score", 0.0),
                    })
                engine_used = "tavily"
        except Exception as e:
            print(f"[search_web] Tavily error: {e}")

    # ── Fallback: DuckDuckGo Instant Answer API ───────────────────────────────
    if not results:
        try:
            ddg_url = (
                f"https://api.duckduckgo.com/?q={requests.utils.quote(query)}"
                f"&format=json&no_html=1&skip_disambig=1"
            )
            headers = {"User-Agent": "NeuralOS/2.0"}
            res = requests.get(ddg_url, headers=headers, timeout=8)
            if res.ok:
                data = res.json()
                abstract = data.get("AbstractText", "")
                answer = data.get("Answer", "")
                related = data.get("RelatedTopics", [])

                if abstract:
                    results.append({"title": "Direct Answer", "snippet": abstract,
                                    "source": data.get("AbstractSource", "DuckDuckGo"), "url": ""})
                if answer:
                    results.append({"title": "Instant Answer", "snippet": answer,
                                    "source": "DuckDuckGo", "url": ""})
                for topic in related[:max_results]:
                    if isinstance(topic, dict) and topic.get("Text"):
                        results.append({
                            "title": topic.get("Text", "")[:80],
                            "snippet": topic.get("Text", ""),
                            "source": "DuckDuckGo",
                            "url": topic.get("FirstURL", ""),
                        })
                if results:
                    engine_used = "duckduckgo"
        except Exception:
            pass

    # ── Last resort: Google News RSS ─────────────────────────────────────────
    if not results:
        try:
            import xml.etree.ElementTree as ET
            rss_url = (
                f"https://news.google.com/rss/search?q={requests.utils.quote(query)}"
                f"&hl=en-US&gl=US&ceid=US:en"
            )
            headers = {"User-Agent": "Mozilla/5.0"}
            rss_res = requests.get(rss_url, headers=headers, timeout=8)
            if rss_res.ok:
                root = ET.fromstring(rss_res.text)
                for item in root.findall(".//item")[:max_results]:
                    title_el = item.find("title")
                    link_el = item.find("link")
                    title_text = title_el.text if title_el is not None else ""
                    if " - " in title_text:
                        title_text, source = title_text.rsplit(" - ", 1)
                    else:
                        source = "Google News"
                    results.append({
                        "title": title_text,
                        "snippet": title_text,
                        "source": source,
                        "url": link_el.text if link_el is not None else "",
                    })
                if results:
                    engine_used = "google_news_rss"
        except Exception:
            pass

    return {
        "query": query,
        "engine": engine_used,
        "results": results[:max_results],
        "count": len(results),
    }


# ─── NEWS ─────────────────────────────────────────────────────────────────────
def get_news(city: str = "Hyderabad", max_records: int = 5) -> dict:
    """Get local news headlines from GDELT/Google News RSS."""
    import xml.etree.ElementTree as ET
    headers = {"User-Agent": "Mozilla/5.0"}
    results = []

    # GDELT
    try:
        gdelt_url = "https://api.gdeltproject.org/api/v2/doc/doc"
        params = {"query": city, "mode": "artlist", "format": "json", "maxrecords": max_records}
        res = requests.get(gdelt_url, params=params, headers=headers, timeout=8)
        if res.ok:
            articles = res.json().get("articles", [])
            for art in articles:
                results.append({
                    "title": art.get("title", ""),
                    "source": art.get("domain", "GDELT"),
                    "url": art.get("url", ""),
                    "image": art.get("socialimage", "")
                })
    except Exception:
        pass

    # RSS fallback
    if not results:
        try:
            rss_url = f"https://news.google.com/rss/search?q={requests.utils.quote(city)}&hl=en-US&gl=US&ceid=US:en"
            res = requests.get(rss_url, headers=headers, timeout=8)
            if res.ok:
                root = ET.fromstring(res.text)
                for item in root.findall(".//item")[:max_records]:
                    title_el = item.find("title")
                    link_el = item.find("link")
                    title_text = title_el.text if title_el is not None else ""
                    if " - " in title_text:
                        title_text, source = title_text.rsplit(" - ", 1)
                    else:
                        source = "Google News"
                    results.append({
                        "title": title_text, "source": source,
                        "url": link_el.text if link_el is not None else "", "image": ""
                    })
        except Exception:
            pass

    return {"city": city, "articles": results, "count": len(results)}


# ─── TOOL REGISTRY ────────────────────────────────────────────────────────────
TOOL_REGISTRY = {
    "get_system_info": {"fn": get_system_info, "description": "Get current CPU, RAM, disk usage and running processes."},
    "open_application": {"fn": open_application, "description": "Open an application by name (e.g. chrome, vscode, spotify, notepad)."},
    "open_url": {"fn": open_url, "description": "Open a URL in the default web browser."},
    "close_application": {"fn": close_application, "description": "Close a running application by name."},
    "list_directory": {"fn": list_directory, "description": "List files and folders in a directory."},
    "read_file": {"fn": read_file, "description": "Read the contents of a file."},
    "write_file": {"fn": write_file, "description": "Write content to a file (creates if not exists)."},
    "create_folder": {"fn": create_folder, "description": "Create a new folder at the given path."},
    "move_file": {"fn": move_file, "description": "Move a file or folder from source to destination."},
    "delete_file": {"fn": delete_file, "description": "Delete a file. Always requires confirmed=True."},
    "search_files": {"fn": search_files, "description": "Search for files by name pattern in user directories."},
    "get_weather": {"fn": get_weather, "description": "Get current weather for a city using Open-Meteo."},
    "search_web": {"fn": search_web, "description": "Search the web for real-time information using Tavily AI Search (primary) with DuckDuckGo and Google News RSS as fallbacks."},
    "get_news": {"fn": get_news, "description": "Get local news headlines for a city."},
}

def execute_tool(tool_name: str, args: dict) -> dict:
    """Execute a registered tool by name with given args."""
    if tool_name not in TOOL_REGISTRY:
        return {"error": f"Unknown tool: {tool_name}. Available: {list(TOOL_REGISTRY.keys())}"}
    try:
        fn = TOOL_REGISTRY[tool_name]["fn"]
        result = fn(**args)
        return result
    except TypeError as e:
        return {"error": f"Invalid args for tool '{tool_name}': {e}"}
    except Exception as e:
        return {"error": f"Tool execution failed: {e}"}
