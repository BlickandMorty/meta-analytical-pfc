"""Training generator — creates teaching examples from executive traces."""

from typing import Dict, List
from dataclasses import dataclass, asdict
import json

from src.learning.executive_trace import ExecutiveTrace


@dataclass
class TrainingExample:
    """One training pair: query + solution with metadata."""
    query: str
    solution: str
    domain: str
    difficulty: str
    skill_name: str

    def to_dict(self) -> Dict:
        return asdict(self)


class TrainingGenerator:
    """Converts executive reasoning traces into structured training examples."""

    def generate_training_examples(
        self,
        traces: List[ExecutiveTrace],
        skill_name: str,
        sample_size: int = 10,
    ) -> List[TrainingExample]:
        relevant = [t for t in traces if skill_name.lower() in t.query.lower()]
        sample_size = min(sample_size, len(relevant))
        if sample_size == 0:
            return []

        step = max(1, len(relevant) // sample_size)
        selected = relevant[::step][:sample_size]

        examples = []
        for trace in selected:
            steps = self._extract_reasoning_steps(trace.reasoning_trace)
            examples.append(TrainingExample(
                query=trace.query,
                solution="\n\n".join(steps),
                domain=trace.domain,
                difficulty=self._estimate_difficulty(trace),
                skill_name=skill_name,
            ))

        difficulty_order = {"easy": 0, "medium": 1, "hard": 2}
        examples.sort(key=lambda x: difficulty_order.get(x.difficulty, 1))
        return examples

    def create_augmented_examples(
        self,
        base_examples: List[TrainingExample],
        variations_per_example: int = 2,
    ) -> List[TrainingExample]:
        augmented = list(base_examples)
        for ex in base_examples:
            for i in range(variations_per_example):
                augmented.append(TrainingExample(
                    query=f"{ex.query} (Variation {i + 1})",
                    solution=ex.solution,
                    domain=ex.domain,
                    difficulty=ex.difficulty,
                    skill_name=ex.skill_name,
                ))
        return augmented

    def save_examples(self, examples: List[TrainingExample], filepath: str):
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump([e.to_dict() for e in examples], f, indent=2)

    def load_examples(self, filepath: str) -> List[TrainingExample]:
        with open(filepath, "r", encoding="utf-8") as f:
            return [TrainingExample(**d) for d in json.load(f)]

    @staticmethod
    def _extract_reasoning_steps(trace: Dict) -> List[str]:
        if "steps" in trace:
            steps = []
            for s in trace["steps"]:
                if isinstance(s, dict) and "description" in s:
                    steps.append(s["description"])
                elif isinstance(s, str):
                    steps.append(s)
            if steps:
                return steps
        if "summary" in trace:
            return [trace["summary"]]
        return ["Solved using multi-engine reasoning pipeline."]

    @staticmethod
    def _estimate_difficulty(trace: ExecutiveTrace) -> str:
        steps = trace.reasoning_trace.get("steps", [])
        n_steps = len(steps) if isinstance(steps, list) else 1
        if trace.confidence >= 0.9 and n_steps <= 3:
            return "easy"
        elif trace.confidence >= 0.75 and n_steps <= 5:
            return "medium"
        return "hard"
