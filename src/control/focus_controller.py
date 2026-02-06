"""Continued-fraction focus controller and entropy valve."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass
class FocusPlan:
    depth: int
    temperature_scale: float
    max_tokens_scale: float
    reason: str


class FocusController:
    def __init__(
        self,
        enabled: bool = True,
        min_depth: int = 2,
        max_depth: int = 10,
        base_depth: int = 3,
        entropy_weight: float = 0.6,
        dissonance_weight: float = 0.4,
        throttle_temperature_min: float = 0.1,
        throttle_temperature_max: float = 0.6,
        max_tokens_scale_min: float = 1.0,
        max_tokens_scale_max: float = 1.8,
    ):
        self.min_depth = min_depth
        self.max_depth = max_depth
        self.base_depth = base_depth
        self.entropy_weight = entropy_weight
        self.dissonance_weight = dissonance_weight
        self.throttle_temperature_min = throttle_temperature_min
        self.throttle_temperature_max = throttle_temperature_max
        self.max_tokens_scale_min = max_tokens_scale_min
        self.max_tokens_scale_max = max_tokens_scale_max
        self.enabled = enabled

    def plan(self, metrics: Dict) -> FocusPlan:
        if not self.enabled:
            return FocusPlan(
                depth=self.base_depth,
                temperature_scale=1.0,
                max_tokens_scale=1.0,
                reason="entropy_valve_disabled",
            )
        entropy = float(metrics.get("entropy_score", 0.0))
        dissonance = float(metrics.get("dissonance_score", 0.0))

        difficulty = (
            self.entropy_weight * entropy
            + self.dissonance_weight * dissonance
        )
        depth = int(self.min_depth + difficulty * (self.max_depth - self.min_depth))
        depth = max(self.min_depth, min(self.max_depth, depth))

        # Continued fraction scaling (adds a gentle nonlinear bias)
        cf_value = self._continued_fraction(depth)
        cf_scaled = min(1.0, cf_value / (depth + 1))

        temperature_scale = self._lerp(
            self.throttle_temperature_max,
            self.throttle_temperature_min,
            cf_scaled,
        )
        max_tokens_scale = self._lerp(
            self.max_tokens_scale_min,
            self.max_tokens_scale_max,
            cf_scaled,
        )

        reason = f"entropy={entropy:.2f}, dissonance={dissonance:.2f}, depth={depth}"
        return FocusPlan(
            depth=depth,
            temperature_scale=temperature_scale,
            max_tokens_scale=max_tokens_scale,
            reason=reason,
        )

    def _continued_fraction(self, depth: int) -> float:
        # Simple continued fraction: x = 1 + 1/(1 + 1/(2 + 1/(3 + ...)))
        x = 1.0
        for n in range(depth, 0, -1):
            x = 1.0 + 1.0 / (n + x)
        return x

    @staticmethod
    def _lerp(a: float, b: float, t: float) -> float:
        return a + (b - a) * t
