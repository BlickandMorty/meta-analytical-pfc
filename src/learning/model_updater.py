"""Model updater — teaches the base model learned skills via knowledge base."""

from typing import Dict, List, Optional
from datetime import datetime
import json
from pathlib import Path


class KnowledgeBase:
    """Persistent skill store (JSON) for learned reasoning patterns."""

    def __init__(self, storage_path: str = "data/learned_knowledge"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.kb_file = self.storage_path / "knowledge_base.json"
        self.knowledge: Dict = self._load()

    def add_skill(self, skill_name: str, skill_description: str, examples: List[Dict]):
        self.knowledge[skill_name] = {
            "description": skill_description,
            "examples": examples,
            "added_date": datetime.now().isoformat(),
            "mastery_level": 0.5,
        }
        self._save()

    def get_skill(self, skill_name: str) -> Optional[Dict]:
        return self.knowledge.get(skill_name)

    def update_mastery(self, skill_name: str, improvement: float):
        if skill_name in self.knowledge:
            current = self.knowledge[skill_name].get("mastery_level", 0.5)
            self.knowledge[skill_name]["mastery_level"] = min(1.0, current + improvement)
            self._save()

    def list_skills(self) -> List[str]:
        return list(self.knowledge.keys())

    def _load(self) -> Dict:
        if not self.kb_file.exists():
            return {}
        try:
            with open(self.kb_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save(self):
        with open(self.kb_file, "w", encoding="utf-8") as f:
            json.dump(self.knowledge, f, indent=2)


class ModelUpdater:
    """Coordinates skill teaching: stores skills and builds teaching prompts."""

    def __init__(self, storage_path: str = "data/learned_knowledge"):
        self.knowledge_base = KnowledgeBase(storage_path)

    def teach_skill(
        self,
        skill_name: str,
        skill_description: str,
        training_examples: List[Dict],
        context_for_base_model: Optional[str] = None,
    ) -> Dict:
        self.knowledge_base.add_skill(skill_name, skill_description, training_examples)
        prompt = self._build_teaching_prompt(
            skill_name, skill_description, training_examples, context_for_base_model
        )
        return {
            "status": "success",
            "skill_name": skill_name,
            "num_examples": len(training_examples),
            "teaching_prompt": prompt,
        }

    def update_base_model_prompt(self, skill_name: str, success: bool, feedback: Optional[str] = None) -> Dict:
        if success:
            self.knowledge_base.update_mastery(skill_name, improvement=0.1)
        return {
            "skill": skill_name,
            "status": "Skill reinforced" if success else "Needs more practice",
            "feedback": feedback,
        }

    def get_retrieval_augmented_prompt(self, query: str, relevant_skills: List[str]) -> str:
        parts = [f"QUERY: {query}\n\nRELEVANT KNOWLEDGE:"]
        for skill in relevant_skills:
            info = self.knowledge_base.get_skill(skill)
            if info:
                parts.append(f"\nSKILL: {skill}\nDESCRIPTION: {info['description']}")
                examples = info.get("examples", [])
                if examples and isinstance(examples[0], dict):
                    parts.append(f"EXAMPLE: {examples[0]}")
        parts.append("\nUse this knowledge to answer the query.")
        return "\n".join(parts)

    @staticmethod
    def _build_teaching_prompt(
        skill_name: str,
        description: str,
        examples: List[Dict],
        context: Optional[str] = None,
    ) -> str:
        lines = [f"LEARNING NEW SKILL: {skill_name}", f"\nWHAT YOU'RE LEARNING:\n{description}", "\nEXAMPLES:"]
        for i, ex in enumerate(examples[:3], 1):
            if isinstance(ex, dict) and "query" in ex and "solution" in ex:
                lines.append(f"\nExample {i}:\nQuestion: {ex['query']}\nAnswer: {ex['solution']}")
        if context:
            lines.append(f"\nADDITIONAL CONTEXT:\n{context}")
        lines.append("\nNow apply this knowledge to solve similar problems.")
        return "\n".join(lines)
