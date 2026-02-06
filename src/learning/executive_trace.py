"""Executive trace memory — logs PFC activations for meta-learning."""

from typing import Dict, List, Optional
from datetime import datetime
import json
from pathlib import Path
from dataclasses import dataclass, asdict


@dataclass
class ExecutiveTrace:
    """Record of one executive-mode reasoning episode."""
    timestamp: str
    query: str
    domain: str
    confidence: float
    reasoning_trace: Dict
    user_id: Optional[str] = None
    archived: bool = False

    def to_dict(self):
        return asdict(self)


class ExecutiveTraceMemory:
    """Persistent store of executive reasoning episodes for pattern detection."""

    def __init__(self, storage_path: str = "data/executive_traces"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.traces_file = self.storage_path / "traces.json"
        self.traces: List[ExecutiveTrace] = self._load()

    def log(
        self,
        query: str,
        domain: str,
        confidence: float,
        reasoning_trace: Dict,
        user_id: Optional[str] = None,
    ):
        trace = ExecutiveTrace(
            timestamp=datetime.now().isoformat(),
            query=query,
            domain=domain,
            confidence=confidence,
            reasoning_trace=reasoning_trace,
            user_id=user_id,
        )
        self.traces.append(trace)
        self._save()

    def get_recent(self, n: int = 50) -> List[ExecutiveTrace]:
        return [t for t in self.traces if not t.archived][-n:]

    def get_all(self) -> List[ExecutiveTrace]:
        return [t for t in self.traces if not t.archived]

    def archive_pattern(self, skill_name: str):
        skill_lower = skill_name.lower()
        for trace in self.traces:
            if skill_lower in trace.query.lower():
                trace.archived = True
        self._save()

    def _load(self) -> List[ExecutiveTrace]:
        # Try JSON first, fall back to legacy pickle
        if self.traces_file.exists():
            try:
                with open(self.traces_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return [ExecutiveTrace(**d) for d in data]
            except Exception:
                return []

        # Legacy pickle migration
        pkl_file = self.storage_path / "traces.pkl"
        if pkl_file.exists():
            try:
                import pickle
                with open(pkl_file, "rb") as f:
                    traces = pickle.load(f)
                # Migrate to JSON
                self.traces = traces
                self._save()
                return traces
            except Exception:
                return []
        return []

    def _save(self):
        data = [t.to_dict() for t in self.traces]
        with open(self.traces_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
