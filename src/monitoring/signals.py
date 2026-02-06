"""Signal computation for chords, entropy, and health."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional
from src.monitoring.concepts import ConceptRegistry
from src.control.focus_controller import FocusController, FocusPlan
from src.tda.tda_pipeline import TDAResult


@dataclass
class SignalBundle:
    concepts: List[str]
    chord_product: int
    chord_frequencies: List[float]
    dissonance_score: float
    dissonance_events: List[str]
    entropy_score: float
    health_score: float
    focus_plan: FocusPlan
    harmony_key_distance: float


def _normalize_entropy(entropy: float, max_entropy: float = 3.0) -> float:
    if entropy <= 0:
        return 0.0
    return min(1.0, entropy / max_entropy)


def _compute_health(dissonance: float, entropy: float, floor: float = 0.2) -> float:
    raw = 1.0 - (0.6 * entropy + 0.4 * dissonance)
    return max(floor, min(1.0, raw))


def compute_signals(
    query: str,
    reasoning_trace: Dict,
    tda_result: Optional[TDAResult],
    concept_registry: ConceptRegistry,
    focus_controller: FocusController,
    health_floor: float = 0.2,
) -> SignalBundle:
    concepts = sorted(set(
        concept_registry.detect_concepts(query)
        + concept_registry.detect_concepts_from_trace(reasoning_trace)
    ))

    chord_product = concept_registry.chord_product(concepts)
    chord_frequencies = concept_registry.chord_frequencies(concepts)
    dissonance_score, dissonance_events = concept_registry.evaluate_dissonance(concepts)

    if tda_result:
        entropy_score = _normalize_entropy(tda_result.persistence_entropy)
    else:
        entropy_score = 0.0

    harmony_key_distance = concept_registry.harmony_key_distance(chord_frequencies)
    dissonance_score = min(1.0, dissonance_score + harmony_key_distance * 0.5)

    health_score = _compute_health(dissonance_score, entropy_score, floor=health_floor)

    focus_plan = focus_controller.plan({
        "entropy_score": entropy_score,
        "dissonance_score": dissonance_score,
        "health_score": health_score,
    })

    return SignalBundle(
        concepts=concepts,
        chord_product=chord_product,
        chord_frequencies=chord_frequencies,
        dissonance_score=dissonance_score,
        dissonance_events=[e.detail for e in dissonance_events],
        entropy_score=entropy_score,
        health_score=health_score,
        focus_plan=focus_plan,
        harmony_key_distance=harmony_key_distance,
    )
