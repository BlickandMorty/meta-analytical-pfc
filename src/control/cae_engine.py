"""Contextual Allostasis Engine (CAE) for safety state modulation."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None


class SafetyState(str, Enum):
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"


@dataclass
class CAEOutput:
    state: SafetyState
    risk_score: float
    raw_score: float
    avg_score: float
    system_prompt: str
    temperature_scale: float


class ContextualAllostasisEngine:
    def __init__(self, config: Dict):
        model_name = config.get("model", {}).get("embedding_model", "all-MiniLM-L6-v2")
        self.anchors: List[str] = config.get("threat_anchors", [])
        self.anchor_embeddings = None
        self.embedder = None
        if self.anchors and SentenceTransformer is not None:
            self.embedder = SentenceTransformer(model_name)
            self.anchor_embeddings = self.embedder.encode(
                self.anchors,
                normalize_embeddings=True,
            )

        self.yellow_threshold = float(config.get("thresholds", {}).get("yellow", 0.35))
        self.red_threshold = float(config.get("thresholds", {}).get("red", 0.55))

        self.window = int(config.get("smoothing", {}).get("window", 6))
        self.decay = float(config.get("smoothing", {}).get("decay", 0.85))

        self.state_prompts = config.get("state_prompts", {})
        self.state = SafetyState.GREEN
        self.smoothed_risk = 0.0
        self.history: List[float] = []

    def evaluate(self, text: str) -> CAEOutput:
        if not text or self.anchor_embeddings is None:
            return CAEOutput(
                state=SafetyState.GREEN,
                risk_score=0.0,
                raw_score=0.0,
                avg_score=0.0,
                system_prompt=self.state_prompts.get("GREEN", "You are a helpful research assistant."),
                temperature_scale=1.0,
            )

        vec = self.embedder.encode([text], normalize_embeddings=True)[0]
        sims = np.dot(self.anchor_embeddings, vec)
        raw = float(np.max(sims))

        self.history.append(raw)
        if len(self.history) > self.window:
            self.history = self.history[-self.window:]
        avg = float(np.mean(self.history))

        risk = max(raw, avg)
        self.smoothed_risk = self.decay * self.smoothed_risk + (1.0 - self.decay) * risk

        if self.smoothed_risk >= self.red_threshold:
            self.state = SafetyState.RED
        elif self.smoothed_risk >= self.yellow_threshold:
            self.state = SafetyState.YELLOW
        else:
            self.state = SafetyState.GREEN

        system_prompt = self.state_prompts.get(self.state.value, "You are a helpful research assistant.")
        temperature_scale = 0.7 if self.state == SafetyState.YELLOW else 0.5 if self.state == SafetyState.RED else 1.0

        return CAEOutput(
            state=self.state,
            risk_score=float(self.smoothed_risk),
            raw_score=raw,
            avg_score=avg,
            system_prompt=system_prompt,
            temperature_scale=temperature_scale,
        )
