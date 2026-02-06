"""Confidence calibration — epistemic uncertainty quantification."""

from typing import Dict, Tuple


class ConfidenceCalibrator:
    """Calibrates reported confidence against evidence quality."""

    def calibrate(self, reasoning_trace: Dict, critique: Dict) -> Tuple[float, Tuple[float, float]]:
        """Return (confidence, (lower_bound, upper_bound))."""
        confidence = 0.5
        confidence += self._statistical_boost(reasoning_trace)
        confidence += self._causal_boost(reasoning_trace)
        confidence -= self._critique_penalty(critique)
        confidence = max(0.0, min(1.0, confidence))
        bounds = self._uncertainty_bounds(confidence, reasoning_trace)
        return confidence, bounds

    @staticmethod
    def _statistical_boost(trace: Dict) -> float:
        stat = trace.get("statistical", {})
        boost = 0.0
        effect = abs(stat.get("effect_size_analysis", {}).get("value", 0))
        if effect > 0.8:
            boost += 0.2
        elif effect > 0.5:
            boost += 0.1
        power = stat.get("power_analysis", {}).get("power", 0)
        if power and power > 0.8:
            boost += 0.1
        return boost

    @staticmethod
    def _causal_boost(trace: Dict) -> float:
        causal = trace.get("causal", {})
        boost = 0.0
        if causal.get("study_design") == "randomized_controlled_trial":
            boost += 0.2
        hill = causal.get("bradford_hill_score", {}).get("total_score", 0)
        if hill > 0.7:
            boost += 0.15
        return boost

    @staticmethod
    def _critique_penalty(critique: Dict) -> float:
        penalty = 0.0
        weaknesses = critique.get("weaknesses", "")
        penalty += weaknesses.count("\n") * 0.05 if weaknesses else 0.0
        overclaiming = critique.get("overclaiming", "")
        if "unjustified" in overclaiming.lower() or "overclaim" in overclaiming.lower():
            penalty += 0.15
        return min(0.4, penalty)

    @staticmethod
    def _uncertainty_bounds(confidence: float, trace: Dict) -> Tuple[float, float]:
        uncertainty = 1.0 - confidence
        i_sq = trace.get("meta", {}).get("heterogeneity", {}).get("I_squared", 0)
        if i_sq > 75:
            uncertainty *= 1.5
        elif i_sq > 50:
            uncertainty *= 1.2
        lower = max(0.0, confidence - uncertainty)
        upper = min(1.0, confidence + uncertainty)
        return (lower, upper)
