"""Feedback loop scaffolding.

This module defines:
- how to decide if an output should be used for learning
- how to build training examples from telemetry signals
- where a future fine-tuning step will plug in
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional
import json


@dataclass
class FeedbackSample:
    query: str
    response: str
    signals: Dict
    reward: float
    penalty: float


class FeedbackBuffer:
    def __init__(self, path: str = "data/feedback/buffer.jsonl", max_buffer: int = 5000):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.max_buffer = max_buffer

    def append(self, sample: FeedbackSample):
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(sample.__dict__, ensure_ascii=True) + "\n")
        self._truncate()

    def _truncate(self):
        if not self.path.exists():
            return
        lines = self.path.read_text(encoding="utf-8").splitlines()
        if len(lines) <= self.max_buffer:
            return
        lines = lines[-self.max_buffer:]
        self.path.write_text("\n".join(lines) + "\n", encoding="utf-8")


class FeedbackLoop:
    def __init__(self, config: Dict):
        cfg = config.get("feedback", {})
        self.enabled = bool(cfg.get("enabled", False))
        self.buffer = FeedbackBuffer(
            path=cfg.get("buffer_path", "data/feedback/buffer.jsonl"),
            max_buffer=int(cfg.get("max_buffer", 5000)),
        )
        self.critique_threshold = float(cfg.get("critique_threshold", 0.5))
        self.dissonance_threshold = float(cfg.get("dissonance_threshold", 0.4))
        self.entropy_threshold = float(cfg.get("entropy_threshold", 0.6))
        self.reward_weight = float(cfg.get("reward_weight", 1.0))
        self.penalty_weight = float(cfg.get("penalty_weight", 1.0))

    def evaluate(self, query: str, response: str, signals: Dict) -> Optional[FeedbackSample]:
        """Decide whether to collect a sample and compute reward/penalty.

        This does NOT train. It only stores samples for future fine-tuning.
        """
        if not self.enabled:
            return None

        critique = float(signals.get("critique_severity", 0.0))
        dissonance = float(signals.get("dissonance_score", 0.0))
        entropy = float(signals.get("entropy_score", 0.0))

        penalty = 0.0
        reward = 0.0

        if critique >= self.critique_threshold:
            penalty += self.penalty_weight
        if dissonance >= self.dissonance_threshold:
            penalty += self.penalty_weight * 0.5
        if entropy >= self.entropy_threshold:
            penalty += self.penalty_weight * 0.5

        if critique < self.critique_threshold and dissonance < self.dissonance_threshold:
            reward += self.reward_weight

        if reward == 0.0 and penalty == 0.0:
            return None

        sample = FeedbackSample(
            query=query,
            response=response,
            signals=signals,
            reward=reward,
            penalty=penalty,
        )
        self.buffer.append(sample)
        return sample

    def build_training_examples(self) -> None:
        """Placeholder for constructing a fine-tuning dataset.

        Expected future behavior:
        - read buffer.jsonl
        - convert reward/penalty into preference pairs
        - write a dataset for LoRA/finetune
        """
        raise NotImplementedError("Training dataset builder not implemented yet")

    def finetune_model(self) -> None:
        """Placeholder for fine-tuning step.

        Expected future behavior:
        - load model
        - run LoRA/finetune on built dataset
        - save updated weights
        """
        raise NotImplementedError("Fine-tuning not implemented yet")
