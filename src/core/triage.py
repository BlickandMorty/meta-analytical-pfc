"""Query complexity triage — routes queries to appropriate reasoning pathway."""

from typing import Tuple, Dict, Optional
from enum import Enum
from src.core.types import ReasoningMode
from src.monitoring.concepts import ConceptRegistry


class ComplexityTriage:
    """
    Triage system for query complexity detection
    
    Routes queries to appropriate reasoning pathway
    """
    
    def __init__(self, config: Dict, concept_registry: Optional[ConceptRegistry] = None):
        self.config = config
        self.concept_registry = concept_registry
        self.thresholds = self._build_thresholds(config)
        
        # Keywords for different complexity levels
        default_scientific = [
            'study', 'research', 'p-value', 'correlation', 'causation',
            'effect size', 'meta-analysis', 'rct', 'trial', 'systematic review',
            'confounding', 'bias', 'statistical', 'hypothesis'
        ]
        triage_cfg = config.get("triage", {}) if isinstance(config, dict) else {}
        extra_keywords = triage_cfg.get("research_keywords", []) or []
        self.scientific_keywords = sorted(set(default_scientific + list(extra_keywords)))
        
        self.meta_analytical_keywords = [
            'meta-analysis', 'systematic review', 'synthesize studies',
            'multiple papers', 'literature review', 'evidence synthesis'
        ]

        self._last_concept_stats = {}

    def _build_thresholds(self, config: Dict) -> Dict:
        """Build complexity thresholds from config with safe defaults."""
        if isinstance(config, dict):
            thresholds = (config.get("thresholds") or {}).get("complexity")
            if isinstance(thresholds, dict):
                return thresholds

            triage_cfg = config.get("triage", {}) or {}
            if isinstance(triage_cfg, dict):
                simple = float(triage_cfg.get("simple_threshold", 0.3))
                moderate = float(triage_cfg.get("moderate_threshold", 0.6))
                complex_ = float(triage_cfg.get("complex_threshold", 0.8))
                meta = float(triage_cfg.get("meta_analytical_threshold", 0.95))

                # Ensure monotonic ordering
                if complex_ <= moderate:
                    complex_ = min(1.0, moderate + 0.2)
                if meta <= complex_:
                    meta = min(1.0, complex_ + 0.15)

                return {
                    "simple": simple,
                    "moderate": moderate,
                    "complex": complex_,
                    "meta_analytical": meta,
                }

        # Fallback defaults
        return {
            "simple": 0.3,
            "moderate": 0.6,
            "complex": 0.8,
            "meta_analytical": 0.95,
        }
    
    def analyze(self, query: str) -> Tuple[float, ReasoningMode]:
        """
        Analyze query and return (complexity_score, mode)
        """
        
        query_lower = query.lower()
        
        # Count scientific keywords
        scientific_count = sum(
            1 for keyword in self.scientific_keywords
            if keyword in query_lower
        )
        
        # Check for meta-analytical triggers
        meta_triggered = any(
            keyword in query_lower 
            for keyword in self.meta_analytical_keywords
        )
        
        # Calculate complexity score
        complexity_score = 0.0
        
        # Baseline from length
        complexity_score += min(0.3, len(query.split()) / 100)
        
        # Scientific keywords
        complexity_score += scientific_count * 0.1

        # Concept depth + count (optional)
        complexity_score += self._concept_complexity(query)
        
        # Meta-analytical boost
        if meta_triggered:
            complexity_score += 0.4
        
        # Clamp to [0, 1]
        complexity_score = min(1.0, complexity_score)
        
        # Map to mode
        if complexity_score >= self.thresholds['meta_analytical']:
            mode = ReasoningMode.META_ANALYTICAL
        elif complexity_score >= self.thresholds['complex']:
            mode = ReasoningMode.COMPLEX
        elif complexity_score >= self.thresholds['moderate']:
            mode = ReasoningMode.MODERATE
        else:
            mode = ReasoningMode.SIMPLE
        
        return complexity_score, mode

    def _concept_complexity(self, query: str) -> float:
        if not self.concept_registry:
            return 0.0

        triage_cfg = self.config.get("triage", {}) if isinstance(self.config, dict) else {}
        concept_cfg = triage_cfg.get("concept_depth", {}) if isinstance(triage_cfg, dict) else {}
        if not concept_cfg.get("enabled", False):
            return 0.0

        concepts = self.concept_registry.detect_concepts(query)
        count = len(concepts)
        if count == 0:
            self._last_concept_stats = {"count": 0, "avg_depth": 0.0}
            return 0.0

        depths = self.concept_registry.concept_depths(concepts)
        avg_depth = sum(depths) / len(depths) if depths else 0.0

        count_weight = float(concept_cfg.get("count_weight", 0.08))
        depth_weight = float(concept_cfg.get("depth_weight", 0.12))
        count_cap = float(concept_cfg.get("count_cap", 8))
        max_depth = float(concept_cfg.get("max_depth", max(depths) if depths else 1))
        if max_depth <= 0:
            max_depth = 1.0

        count_score = min(count, count_cap) * count_weight
        depth_score = min(1.0, avg_depth / max_depth) * depth_weight

        self._last_concept_stats = {
            "count": count,
            "avg_depth": avg_depth,
            "count_score": count_score,
            "depth_score": depth_score,
        }

        return count_score + depth_score
