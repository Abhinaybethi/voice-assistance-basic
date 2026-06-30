"""
memory_manager.py — Neural OS Persistent Memory Layer

Stores agent memory in a JSON file. Auto-learns from frequent tool calls.
Provides structured recall for apps, folders, sites, and commands.
"""

import json
import os
from datetime import datetime
from pathlib import Path

MEMORY_FILE = Path(__file__).parent / "neural_memory.json"

DEFAULT_MEMORY = {
    "apps": {
        "chrome": "chrome",
        "vscode": "code",
        "notepad": "notepad",
        "spotify": "spotify",
        "terminal": "cmd",
        "explorer": "explorer"
    },
    "folders": {
        "desktop": str(Path.home() / "Desktop"),
        "downloads": str(Path.home() / "Downloads"),
        "documents": str(Path.home() / "Documents"),
        "projects": str(Path.home() / "Personal")
    },
    "sites": {
        "youtube": "https://youtube.com",
        "github": "https://github.com",
        "google": "https://google.com",
        "stackoverflow": "https://stackoverflow.com"
    },
    "commands": [],
    "projects": {},
    "preferences": {
        "default_city": "Hyderabad",
        "voice_speed": 1.0,
        "theme": "dark_orange"
    },
    "usage_counts": {},
    "last_updated": None
}


def _load() -> dict:
    if MEMORY_FILE.exists():
        try:
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Merge with defaults to handle missing keys
                for key in DEFAULT_MEMORY:
                    if key not in data:
                        data[key] = DEFAULT_MEMORY[key]
                return data
        except Exception:
            pass
    return dict(DEFAULT_MEMORY)


def _save(data: dict):
    data["last_updated"] = datetime.now().isoformat()
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_all() -> dict:
    """Return the full memory store."""
    return _load()


def remember(category: str, key: str, value: str) -> dict:
    """Store a value in a named category."""
    data = _load()
    if category not in data:
        data[category] = {}
    if isinstance(data[category], dict):
        data[category][key] = value
    elif isinstance(data[category], list):
        data[category].append({"key": key, "value": value})
    _save(data)
    return {"status": "remembered", "category": category, "key": key, "value": value}


def recall(category: str, key: str = None):
    """Recall a value. If key is None, returns the whole category."""
    data = _load()
    if category not in data:
        return None
    if key is None:
        return data[category]
    cat = data[category]
    if isinstance(cat, dict):
        return cat.get(key)
    return None


def forget(category: str, key: str) -> dict:
    """Remove a key from memory."""
    data = _load()
    if category in data and isinstance(data[category], dict):
        data[category].pop(key, None)
        _save(data)
        return {"status": "forgotten", "category": category, "key": key}
    return {"status": "not_found"}


def log_command(command: str, tool_used: str = None):
    """Log a command to history and track usage counts."""
    data = _load()
    entry = {
        "command": command,
        "tool": tool_used,
        "timestamp": datetime.now().isoformat()
    }
    data["commands"] = [entry] + data["commands"][:49]  # Keep last 50

    # Track usage counts per tool
    if tool_used:
        counts = data.get("usage_counts", {})
        counts[tool_used] = counts.get(tool_used, 0) + 1
        data["usage_counts"] = counts

    _save(data)


def get_app_path(app_name: str) -> str:
    """Look up remembered app launch command."""
    data = _load()
    apps = data.get("apps", {})
    return apps.get(app_name.lower(), app_name)


def get_folder_path(folder_name: str) -> str:
    """Look up a remembered folder path."""
    data = _load()
    folders = data.get("folders", {})
    return folders.get(folder_name.lower(), folder_name)
