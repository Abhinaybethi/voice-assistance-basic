"""
task_planner.py — Neural OS Multi-Step Task Planner

Generates structured execution plans from high-level goals using Gemini.
Plans are broken into typed steps with tool assignments and status tracking.
Supports SSE streaming of plan progress.
"""

import os
import json
import re
from typing import Optional
from google import genai

PLAN_SYSTEM_PROMPT = """You are a task planning AI for Neural OS. 
When given a user goal, output a JSON array of steps to accomplish it.

Each step must have:
- step_number: integer
- description: brief human-readable action (max 60 chars)
- tool: one of [search_web, open_application, open_url, close_application, 
         list_directory, read_file, write_file, create_folder, search_files, 
         get_weather, get_news, get_system_info, synthesize]
- args_hint: brief hint about what args the tool needs

Output ONLY valid JSON array. No markdown, no explanation. Example:
[
  {"step_number": 1, "description": "Search for Java Full Stack roadmap PDF", "tool": "search_web", "args_hint": "query='Java Full Stack roadmap PDF site:github.com OR site:roadmap.sh'"},
  {"step_number": 2, "description": "Download and save to Desktop/Roadmaps", "tool": "write_file", "args_hint": "path=Desktop/Roadmaps/java_roadmap.txt"},
  {"step_number": 3, "description": "Confirm file saved and notify user", "tool": "synthesize", "args_hint": "confirmation message"}
]"""


def generate_plan(goal: str, city: str = "Hyderabad") -> list[dict]:
    """
    Use Gemini to generate a step-by-step plan for a goal.
    Returns a list of step dicts with status='pending'.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        # Fallback: simple single-step plan
        return [{
            "step_number": 1,
            "description": f"Process: {goal[:60]}",
            "tool": "search_web",
            "args_hint": f"query='{goal}'",
            "status": "pending",
            "result": None
        }]

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config={"system_instruction": PLAN_SYSTEM_PROMPT}
        )
        text = response.text.strip()

        # Extract JSON array from response
        json_match = re.search(r'\[.*\]', text, re.DOTALL)
        if json_match:
            steps = json.loads(json_match.group())
            # Add status tracking fields
            for step in steps:
                step.setdefault("status", "pending")
                step.setdefault("result", None)
            return steps
    except Exception as e:
        print(f"[TaskPlanner] Plan generation failed: {e}")

    return [{
        "step_number": 1,
        "description": f"Execute: {goal[:60]}",
        "tool": "search_web",
        "args_hint": goal,
        "status": "pending",
        "result": None
    }]


def update_step_status(plan: list[dict], step_number: int, status: str, result=None) -> list[dict]:
    """Update the status and result of a specific step in a plan."""
    for step in plan:
        if step.get("step_number") == step_number:
            step["status"] = status
            if result is not None:
                step["result"] = result
            break
    return plan


def get_step_icon(tool: str) -> str:
    """Return an emoji icon for a given tool name."""
    icons = {
        "search_web": "🌐",
        "open_application": "🖥️",
        "open_url": "🔗",
        "close_application": "❌",
        "list_directory": "📁",
        "read_file": "📄",
        "write_file": "✏️",
        "create_folder": "📂",
        "search_files": "🔍",
        "get_weather": "🌤️",
        "get_news": "📰",
        "get_system_info": "⚙️",
        "synthesize": "💬",
        "move_file": "📦",
        "delete_file": "🗑️",
    }
    return icons.get(tool, "🔧")


def summarize_plan(plan: list[dict]) -> str:
    """Generate a brief human-readable summary of a plan."""
    if not plan:
        return "No steps planned."
    steps = [f"Step {s['step_number']}: {s['description']}" for s in plan]
    return "\n".join(steps)
