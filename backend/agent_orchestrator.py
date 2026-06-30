"""
agent_orchestrator.py — Neural OS Gemini Function-Calling Agent

Uses Google Gemini's native function-calling to create an autonomous
agentic loop that plans, executes tools, and synthesizes final answers.
"""

import os
import json
import time
from typing import Optional, Callable
from google import genai
from google.genai import types
from tool_manager import execute_tool, TOOL_REGISTRY, get_system_info

# ─── Gemini Tool Schema (function declarations) ───────────────────────────────
GEMINI_TOOLS = [
    types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="get_system_info",
            description="Get the current system CPU, RAM, and disk usage and list of running processes.",
            parameters=types.Schema(type="OBJECT", properties={})
        ),
        types.FunctionDeclaration(
            name="open_application",
            description="Open an application on the computer by name. Examples: chrome, vscode, spotify, notepad, terminal, calculator, paint.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"app_name": types.Schema(type="STRING", description="The application name to open")},
                required=["app_name"]
            )
        ),
        types.FunctionDeclaration(
            name="open_url",
            description="Open a URL in the web browser.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"url": types.Schema(type="STRING", description="The URL to open")},
                required=["url"]
            )
        ),
        types.FunctionDeclaration(
            name="close_application",
            description="Close/terminate a running application by name.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"app_name": types.Schema(type="STRING", description="The application name to close")},
                required=["app_name"]
            )
        ),
        types.FunctionDeclaration(
            name="list_directory",
            description="List files and folders inside a directory path.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"path": types.Schema(type="STRING", description="Absolute path to the directory (optional, defaults to home)")},
            )
        ),
        types.FunctionDeclaration(
            name="read_file",
            description="Read the text contents of a file.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"path": types.Schema(type="STRING", description="Absolute path to the file")},
                required=["path"]
            )
        ),
        types.FunctionDeclaration(
            name="write_file",
            description="Write or create a file with the given text content.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "path": types.Schema(type="STRING", description="Absolute path to the file"),
                    "content": types.Schema(type="STRING", description="Text content to write")
                },
                required=["path", "content"]
            )
        ),
        types.FunctionDeclaration(
            name="create_folder",
            description="Create a new folder/directory at the specified path.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"path": types.Schema(type="STRING", description="Absolute path for the new folder")},
                required=["path"]
            )
        ),
        types.FunctionDeclaration(
            name="search_files",
            description="Search for files by name pattern in user directories.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "name": types.Schema(type="STRING", description="File name pattern to search"),
                    "search_path": types.Schema(type="STRING", description="Root directory to search in (optional)")
                },
                required=["name"]
            )
        ),
        types.FunctionDeclaration(
            name="get_weather",
            description="Get current weather for a city. Returns temperature, humidity, wind speed, and conditions.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"city": types.Schema(type="STRING", description="City name to get weather for")},
                required=["city"]
            )
        ),
        types.FunctionDeclaration(
            name="search_web",
            description=(
                "Search the internet for real-time information using Tavily AI Search. "
                "Returns a direct synthesized answer plus individual source results with titles, "
                "URLs, and content snippets. Use search_depth='advanced' for complex research "
                "questions; use 'basic' (default) for quick lookups."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "query": types.Schema(type="STRING", description="Search query"),
                    "max_results": types.Schema(type="INTEGER", description="Maximum number of results (default 5)"),
                    "search_depth": types.Schema(type="STRING", description="Search depth: 'basic' (fast) or 'advanced' (thorough). Default: 'basic'"),
                },
                required=["query"]
            )
        ),
        types.FunctionDeclaration(
            name="get_news",
            description="Get the latest local news headlines for a city.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"city": types.Schema(type="STRING", description="City name")},
                required=["city"]
            )
        ),
    ])
]

SYSTEM_PROMPT = """You are Neural OS — an autonomous AI agent integrated into a futuristic desktop assistant system.

Your personality: Fast, concise, action-oriented, professional. You are proactive.

You have access to powerful tools:
- System control: open/close apps, get system info
- File system: create, read, write, list, search files
- Web: search the internet, get news
- Weather: get real-time weather
- Browser: open URLs

When given a goal:
1. Break it into steps
2. Use tools strategically to gather information or execute actions
3. Synthesize a clear, concise spoken response

Safety rules:
- NEVER delete files without explicit user confirmation
- Always confirm before destructive actions
- Stay within sandboxed user directories

Speak like a futuristic AI assistant: brief, confident, direct. No unnecessary padding."""

MODEL_NAME = "gemini-1.5-flash"
GEN_CONFIG = types.GenerateContentConfig(
    system_instruction=SYSTEM_PROMPT,
    tools=GEMINI_TOOLS,
)


class AgentOrchestrator:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    def execute(self, goal: str, city: str = "Hyderabad", progress_callback: Optional[Callable] = None) -> dict:
        """
        Run the agentic loop for a goal using manually managed history
        to avoid SDK part-merging issues with mixed function_call/text content.
        Returns: { steps, final_answer, spoken_summary, tool_calls }
        """
        steps = []
        tool_calls_made = []
        max_iterations = 8
        iteration = 0

        if progress_callback:
            progress_callback({"type": "start", "goal": goal})

        # Manually tracked conversation history
        history: list[types.Content] = [
            types.Content(
                role="user",
                parts=[types.Part(text=f"User location: {city}. Current goal: {goal}")]
            )
        ]

        while iteration < max_iterations:
            iteration += 1

            # Call Gemini with full history
            response = self.client.models.generate_content(
                model=MODEL_NAME,
                contents=history,
                config=GEN_CONFIG,
            )

            candidate = response.candidates[0]
            model_content = candidate.content  # The model's reply Content object

            # Append model turn to history
            history.append(model_content)

            # Parse function calls and text parts from model reply
            function_calls = []
            text_parts = []
            for part in model_content.parts:
                if part.function_call and part.function_call.name:
                    function_calls.append(part.function_call)
                elif part.text:
                    text_parts.append(part.text)

            # No function calls → final answer
            if not function_calls:
                final_text = " ".join(text_parts).strip()
                if progress_callback:
                    progress_callback({"type": "complete", "answer": final_text})
                return {
                    "goal": goal,
                    "steps": steps,
                    "final_answer": final_text,
                    "spoken_summary": self._clean_for_speech(final_text),
                    "tool_calls": tool_calls_made,
                    "iterations": iteration,
                    "success": True
                }

            # Execute each function call and collect responses
            function_response_parts = []
            for fc in function_calls:
                tool_name = fc.name
                args = dict(fc.args) if fc.args else {}

                step = {
                    "step": len(steps) + 1,
                    "tool": tool_name,
                    "args": args,
                    "status": "running",
                    "result": None
                }
                steps.append(step)

                if progress_callback:
                    progress_callback({"type": "tool_call", "tool": tool_name, "args": args, "step": step["step"]})

                # Execute the tool
                result = execute_tool(tool_name, args)
                step["result"] = result
                step["status"] = "error" if "error" in result else "done"
                tool_calls_made.append({"tool": tool_name, "args": args, "result": result})

                if progress_callback:
                    progress_callback({"type": "tool_result", "tool": tool_name, "result": result, "step": step["step"]})

                function_response_parts.append(
                    types.Part(
                        function_response=types.FunctionResponse(
                            name=tool_name,
                            response={"result": json.dumps(result, default=str)}
                        )
                    )
                )

            # Append tool results as a single "user" turn (required by Gemini protocol)
            history.append(
                types.Content(role="user", parts=function_response_parts)
            )

        # Max iterations reached — synthesize from what we have
        final_text = "Neural OS has completed the analysis. Here is what I found: " + " ".join([
            str(s.get("result", "")) for s in steps if s.get("result")
        ])[:1000]

        return {
            "goal": goal,
            "steps": steps,
            "final_answer": final_text,
            "spoken_summary": self._clean_for_speech(final_text),
            "tool_calls": tool_calls_made,
            "iterations": iteration,
            "success": True
        }

    def _clean_for_speech(self, text: str) -> str:
        """Strip markdown and formatting for clean TTS output."""
        import re
        text = re.sub(r'[*#`_~]', '', text)
        text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)  # Links
        text = re.sub(r'\n+', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()


def create_orchestrator() -> Optional[AgentOrchestrator]:
    """Factory — returns None if no API key configured."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        return AgentOrchestrator(api_key)
    except Exception as e:
        print(f"[Agent] Failed to initialize orchestrator: {e}")
        return None
