"""
FastAPI dashboard server for live and replay telemetry.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from src.utils.config_loader import ConfigLoader

cfg = ConfigLoader().load_yaml("telemetry.yaml", default={})
telemetry_cfg = cfg.get("telemetry", {})
TELEMETRY_PATH = Path(telemetry_cfg.get("jsonl_path", "data/telemetry/events.jsonl"))
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI()
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class ConnectionManager:
    def __init__(self):
        self.active = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, message: str):
        for ws in list(self.active):
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/replay")
async def replay():
    if TELEMETRY_PATH.exists():
        return FileResponse(TELEMETRY_PATH)
    return HTMLResponse("No telemetry yet", status_code=404)


@app.get("/latest")
async def latest():
    if not TELEMETRY_PATH.exists():
        return HTMLResponse("No telemetry yet", status_code=404)
    try:
        with open(TELEMETRY_PATH, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            if size <= 0:
                return HTMLResponse("No telemetry yet", status_code=404)
            chunk_size = min(8192, size)
            f.seek(-chunk_size, 2)
            chunk = f.read().decode("utf-8", errors="ignore")
        lines = [line for line in chunk.splitlines() if line.strip()]
        if not lines:
            return HTMLResponse("No telemetry yet", status_code=404)
        return Response(content=lines[-1], media_type="application/json")
    except Exception:
        return HTMLResponse("No telemetry yet", status_code=404)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def tail_telemetry():
    TELEMETRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    TELEMETRY_PATH.touch(exist_ok=True)
    with open(TELEMETRY_PATH, "r", encoding="utf-8") as f:
        f.seek(0, 2)
        while True:
            line = f.readline()
            if not line:
                await asyncio.sleep(0.2)
                continue
            await manager.broadcast(line)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(tail_telemetry())
