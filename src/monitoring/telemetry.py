"""Telemetry logging to JSONL for live + replay dashboards."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime, timezone
import json


@dataclass
class TelemetryEvent:
    timestamp: str
    query_id: str
    stage: str
    mode: str
    metrics: Dict
    tda: Dict
    chord: Dict
    focus: Dict
    notes: Optional[str] = None

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=True)


class TelemetryLogger:
    def __init__(self, path: str = "data/telemetry/events.jsonl", flush_immediately: bool = True):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.flush_immediately = flush_immediately

    def emit(self, event: TelemetryEvent):
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(event.to_json() + "\n")
            if self.flush_immediately:
                f.flush()


def build_event(
    query_id: str,
    stage: str,
    mode: str,
    metrics: Dict,
    tda: Dict,
    chord: Dict,
    focus: Dict,
    notes: Optional[str] = None,
) -> TelemetryEvent:
    return TelemetryEvent(
        timestamp=datetime.now(timezone.utc).isoformat(),
        query_id=query_id,
        stage=stage,
        mode=mode,
        metrics=metrics,
        tda=tda,
        chord=chord,
        focus=focus,
        notes=notes,
    )
