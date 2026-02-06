"""Adversarial review system — red-team self-validation."""

from typing import Dict
from src.models.base_model import ModelOrchestrator

_SECTION_MARKERS = [
    "WEAKEST POINTS",
    "ALTERNATIVE EXPLANATIONS",
    "OVERCLAIMING",
    "MISSING CONTEXT",
    "UNKNOWN UNKNOWNS",
]

_CRITIQUE_PROMPT = """You are a RED TEAM REVIEWER — criticize the following analysis.

ORIGINAL QUERY:
{query}

ANALYSIS PROVIDED:
{response}

REASONING TRACE:
Statistical Analysis: {statistical}
Causal Analysis: {causal}

YOUR TASK: Play devil's advocate with brutal honesty.

1. WEAKEST POINTS — 3 weakest parts and what was overlooked.
2. ALTERNATIVE EXPLANATIONS — other data interpretations, missed confounders.
3. OVERCLAIMING CHECK — is the conclusion stronger than the evidence warrants?
4. MISSING CONTEXT — critical missing information and hidden assumptions.
5. UNKNOWN UNKNOWNS — what could invalidate this entire analysis?

Be harsh. Be specific. Be useful."""


class AdversarialReviewer:
    """Red-team critique engine for adversarial self-validation."""

    def __init__(self, models: ModelOrchestrator):
        self.models = models

    def review(self, query: str, initial_response: str, reasoning_trace: Dict) -> Dict:
        prompt = _CRITIQUE_PROMPT.format(
            query=query,
            response=initial_response,
            statistical=reasoning_trace.get("statistical", "N/A"),
            causal=reasoning_trace.get("causal", "N/A"),
        )
        critique_text = self.models.generate(prompt, model_type="executive", temperature=0.6)
        return self._parse_critique(critique_text)

    def _parse_critique(self, text: str) -> Dict:
        return {
            "full_critique": text,
            "weaknesses": self._extract_section(text, "WEAKEST POINTS"),
            "alternatives": self._extract_section(text, "ALTERNATIVE EXPLANATIONS"),
            "overclaiming": self._extract_section(text, "OVERCLAIMING"),
            "missing_context": self._extract_section(text, "MISSING CONTEXT"),
            "unknown_unknowns": self._extract_section(text, "UNKNOWN UNKNOWNS"),
        }

    @staticmethod
    def _extract_section(text: str, section_name: str) -> str:
        if section_name not in text:
            return ""
        start = text.find(section_name)
        end = len(text)
        for marker in _SECTION_MARKERS:
            if marker != section_name:
                idx = text.find(marker, start + len(section_name))
                if idx != -1:
                    end = min(end, idx)
        return text[start:end].strip()
