"""Concept registry and Leibnizian chord computation."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple
import re
import yaml


@dataclass
class Concept:
    name: str
    prime: int
    frequency_hz: float
    keywords: List[str]
    depth: int = 1


@dataclass
class DissonanceEvent:
    rule: str
    detail: str


class ConceptRegistry:
    def __init__(self, config_path: str = "config/concepts.yaml"):
        config_file = Path(config_path)
        if not config_file.exists():
            raise FileNotFoundError(f"Concept config not found: {config_path}")
        with open(config_file, "r") as f:
            raw = yaml.safe_load(f)

        self.concepts: Dict[str, Concept] = {}
        for name, data in raw.get("concepts", {}).items():
            self.concepts[name] = Concept(
                name=name,
                prime=int(data["prime"]),
                frequency_hz=float(data["frequency_hz"]),
                keywords=list(data.get("keywords", [])),
                depth=int(data.get("depth", 1)),
            )

        self.rules = raw.get("rules", {})
        self.harmony_key = raw.get("harmony_key", {})

        # Build keyword map for fast detection
        self._keyword_map: Dict[str, str] = {}
        for concept in self.concepts.values():
            for kw in concept.keywords:
                self._keyword_map[kw.lower()] = concept.name

    def detect_concepts(self, text: str) -> List[str]:
        if not text:
            return []

        text_lower = text.lower()
        detected = set()

        for kw, concept_name in self._keyword_map.items():
            if re.search(rf"\b{re.escape(kw)}\b", text_lower):
                detected.add(concept_name)

        return sorted(detected)

    def detect_concepts_from_trace(self, reasoning_trace: Dict) -> List[str]:
        if not reasoning_trace:
            return []
        text_parts = []
        for value in reasoning_trace.values():
            if isinstance(value, dict):
                text_parts.append(" ".join(str(v) for v in value.values()))
            else:
                text_parts.append(str(value))
        return self.detect_concepts(" ".join(text_parts))

    def chord_product(self, concepts: List[str]) -> int:
        product = 1
        for name in concepts:
            concept = self.concepts.get(name)
            if concept:
                product *= concept.prime
        return product

    def chord_frequencies(self, concepts: List[str]) -> List[float]:
        freqs = []
        for name in concepts:
            concept = self.concepts.get(name)
            if concept:
                freqs.append(concept.frequency_hz)
        return freqs

    def concept_depths(self, concepts: List[str]) -> List[int]:
        depths = []
        for name in concepts:
            concept = self.concepts.get(name)
            if concept:
                depths.append(int(concept.depth))
        return depths

    def evaluate_dissonance(self, concepts: List[str]) -> Tuple[float, List[DissonanceEvent]]:
        concepts_set = set(concepts)
        events: List[DissonanceEvent] = []

        # Requires rules
        for concept, required_list in self.rules.get("requires", {}).items():
            if concept in concepts_set:
                missing = [req for req in required_list if req not in concepts_set]
                if missing:
                    events.append(DissonanceEvent(
                        rule="requires",
                        detail=f"{concept} missing {', '.join(missing)}",
                    ))

        # Forbids rules
        for pair in self.rules.get("forbids", []):
            if len(pair) != 2:
                continue
            a, b = pair
            if a in concepts_set and b in concepts_set:
                events.append(DissonanceEvent(
                    rule="forbids",
                    detail=f"{a} conflicts with {b}",
                ))

        # Harmony sets
        harmony_sets = [set(s) for s in self.rules.get("harmony_sets", [])]
        harmony_hits = sum(1 for s in harmony_sets if s.issubset(concepts_set))

        # Simple dissonance score
        if not concepts:
            dissonance_score = 0.0
        else:
            base = min(1.0, len(events) / max(1, len(concepts)))
            harmony_bonus = min(0.3, harmony_hits * 0.1)
            dissonance_score = max(0.0, base - harmony_bonus)

        return dissonance_score, events

    def harmony_key_distance(self, frequencies: List[float]) -> float:
        if not frequencies:
            return 0.0
        base_freq = float(self.harmony_key.get("base_frequency_hz", 261.63))
        tolerance = float(self.harmony_key.get("tolerance_hz", 8.0))
        distances = [abs(f - base_freq) for f in frequencies]
        avg_dist = sum(distances) / len(distances)
        return min(1.0, avg_dist / max(1e-6, tolerance))
