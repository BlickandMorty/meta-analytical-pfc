"""Meta-analytical PFC engine — orchestrates reasoning, TDA, and telemetry."""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import uuid
import json
import re
from loguru import logger

from src.core.triage import ComplexityTriage
from src.core.types import ReasoningMode
from src.core.memory import CrossChatMemory
from src.reasoning.statistical_analyzer import StatisticalAnalyzer
from src.reasoning.causal_inference import CausalInferenceEngine
from src.reasoning.meta_analysis import MetaAnalysisEngine
from src.reasoning.bayesian_reasoner import BayesianReasoner
from src.validation.adversarial_review import AdversarialReviewer
from src.validation.confidence_calibration import ConfidenceCalibrator
from src.models.base_model import ModelOrchestrator
from src.monitoring.concepts import ConceptRegistry
from src.control.focus_controller import FocusController
from src.monitoring.signals import compute_signals, SignalBundle
from src.monitoring.telemetry import TelemetryLogger, build_event
from src.tda.activation_capture import ActivationCapture, ActivationCaptureConfig
from src.tda.tda_pipeline import compute_tda, TDAResult
from src.utils.config_loader import ConfigLoader


@dataclass
class AnalysisResult:
    """Structured output from PFC"""
    response: str
    mode: ReasoningMode
    confidence: float
    evidence_quality: str  # A/B/C/D/F
    limitations: List[str]
    executive_activated: bool
    reasoning_trace: Dict
    citations: List[str]
    uncertainty_bounds: Tuple[float, float]


class MetaAnalyticalPFC:
    """
    The Research Expert Module
    
    Capabilities:
    1. PhD-level statistical reasoning
    2. Causal inference under uncertainty
    3. Meta-analytical synthesis
    4. Adversarial self-validation
    5. Bayesian belief updating
    6. Cross-chat learning
    """
    
    def __init__(self, config_path: str = "config/model_config.yaml"):
        # Load configuration
        self.config_loader = ConfigLoader()
        config_file = Path(config_path)
        if config_file.exists():
            self.config = self.config_loader.load_yaml(config_path, default={})
        else:
            # Default config if file doesn't exist
            self.config = {
                'models': {
                    'fast': {'name': 'claude-3-5-haiku-20241022', 'max_tokens': 1024, 'temperature': 0.7},
                    'thinking': {'name': 'claude-3-7-sonnet-20250219', 'max_tokens': 4096, 'temperature': 0.5},
                    'executive': {'name': 'claude-3-7-sonnet-20250219', 'max_tokens': 8192, 'temperature': 0.3}
                },
                'thresholds': {'complexity': {'simple': 0.3, 'moderate': 0.6, 'complex': 0.8, 'meta_analytical': 0.95}},
                'memory': {'embedding_model': 'all-MiniLM-L6-v2', 'similarity_threshold': 0.75, 'max_context_length': 10}
            }

        # Backward-compatible config normalization
        if "models" not in self.config:
            anthropic_cfg = self.config.get("anthropic", {})
            model_map = anthropic_cfg.get("models", {})
            def _convert(entry):
                return {
                    "name": entry.get("model"),
                    "max_tokens": entry.get("max_tokens", 1024),
                    "temperature": entry.get("temperature", 0.5),
                }
            self.config["models"] = {
                "fast": _convert(model_map.get("simple", {})),
                "thinking": _convert(model_map.get("moderate", {})),
                "executive": _convert(model_map.get("complex", {})),
            }

        # Telemetry and control configs
        self.telemetry_config = self.config_loader.load_yaml("telemetry.yaml", default={})
        self.local_model_config = self.config_loader.load_yaml("local_model.yaml", default={})
        
        logger.info("Initializing Research Expert (Meta-Analytical PFC)...")
        
        # Monitoring + control
        self.concept_registry = ConceptRegistry()

        # Core components
        self.triage = ComplexityTriage(self.config, concept_registry=self.concept_registry)
        memory_cfg = self.config.get("memory", {})
        if "embedding_model" not in memory_cfg and isinstance(memory_cfg.get("vector_db"), dict):
            memory_cfg = {**memory_cfg, **memory_cfg["vector_db"]}
        self.memory = CrossChatMemory(memory_cfg)
        self.models = ModelOrchestrator(self.config['models'])
        
        # Reasoning engines (PhD-level expertise)
        self.statistical = StatisticalAnalyzer()
        self.causal = CausalInferenceEngine()
        self.meta_analysis = MetaAnalysisEngine()
        self.bayesian = BayesianReasoner()
        
        # Validation systems
        self.adversarial = AdversarialReviewer(self.models)
        self.calibrator = ConfidenceCalibrator()

        focus_cfg = self.telemetry_config.get("focus_control", {})
        self.focus_controller = FocusController(**focus_cfg)

        telemetry_cfg = self.telemetry_config.get("telemetry", {})
        self.telemetry_logger = TelemetryLogger(
            path=telemetry_cfg.get("jsonl_path", "data/telemetry/events.jsonl"),
            flush_immediately=telemetry_cfg.get("flush_immediately", True),
        )

        self.activation_capture = self._init_activation_capture()

        paths_cfg = self.config.get("paths", {}) if isinstance(self.config, dict) else {}
        learned_dir = paths_cfg.get("learned_knowledge", "data/learned_knowledge")
        self.learned_knowledge_path = Path(learned_dir) / "knowledge_base.json"
        self._active_learned_context: Optional[str] = None
        self._active_learned_skills: List[str] = []
        
        logger.success("Research Expert initialized")
    
    def process(
        self, 
        query: str,
        user_id: Optional[str] = None,
        context: Optional[Dict] = None
    ) -> AnalysisResult:
        """
        Main reasoning pipeline
        
        Steps:
        1. Triage complexity
        2. Retrieve relevant memory
        3. Route to appropriate reasoning pathway
        4. Execute multi-stage analysis
        5. Adversarial validation
        6. Confidence calibration
        7. Response synthesis
        """
        
        logger.info(f"Processing query: {query[:100]}...")
        
        query_id = str(uuid.uuid4())
        cae_context = (context or {}).get("cae", {})
        self._active_learned_context, self._active_learned_skills = self._prepare_learned_context(query)

        # Step 1: Triage (fast)
        complexity_score, mode = self.triage.analyze(query)
        logger.info(f"Complexity: {complexity_score:.2f} → Mode: {mode.value}")

        # Step 0: Optional local activation probe (for real TDA)
        activation_cfg = (self.local_model_config.get("activation_capture", {})
                          if isinstance(self.local_model_config, dict) else {})
        activation_enabled = bool(activation_cfg.get("enabled", True))
        skip_for_simple = bool(activation_cfg.get("skip_for_simple", True))
        skip_for_moderate = bool(activation_cfg.get("skip_for_moderate", False))

        run_activation = activation_enabled
        if mode == ReasoningMode.SIMPLE and skip_for_simple:
            run_activation = False
        if mode == ReasoningMode.MODERATE and skip_for_moderate:
            run_activation = False

        # Emit a fast preflight event so the dashboard updates immediately
        if run_activation:
            fast_signals = compute_signals(
                query=query,
                reasoning_trace={},
                tda_result=None,
                concept_registry=self.concept_registry,
                focus_controller=self.focus_controller,
                health_floor=self.telemetry_config.get("health", {}).get("health_floor", 0.2),
            )
            self._emit_telemetry(
                query_id=query_id,
                stage="preflight_fast",
                mode=mode.value,
                signals=fast_signals,
                tda_result=None,
                notes="preflight_fast",
                extra_metrics={
                    "safety_state": cae_context.get("state"),
                    "safety_risk": cae_context.get("risk_score"),
                },
            )

        tda_result = self._run_activation_probe(query) if run_activation else None

        # Step 2: Memory retrieval
        memory_context = self.memory.retrieve_relevant(
            query, 
            user_id=user_id,
            k=5
        )

        # Preflight telemetry (with TDA if available)
        preflight_signals = compute_signals(
            query=query,
            reasoning_trace={},
            tda_result=tda_result,
            concept_registry=self.concept_registry,
            focus_controller=self.focus_controller,
            health_floor=self.telemetry_config.get("health", {}).get("health_floor", 0.2),
        )
        self._emit_telemetry(
            query_id=query_id,
            stage="preflight",
            mode=mode.value,
            signals=preflight_signals,
            tda_result=tda_result,
            notes="preflight_probe",
            extra_metrics={
                "safety_state": cae_context.get("state"),
                "safety_risk": cae_context.get("risk_score"),
                "learned_skills": self._active_learned_skills,
            },
        )
        
        # Optional meta-analyzer (extra scrutiny)
        meta_cfg = (self.config.get("triage", {}).get("meta_analyzer", {})
                    if isinstance(self.config, dict) else {})
        meta_enabled = bool(meta_cfg.get("enabled", False))
        meta_threshold = float(meta_cfg.get("threshold", 0.6))
        meta_findings = None
        if meta_enabled and complexity_score >= meta_threshold:
            meta_findings = self._meta_analyzer_pass(
                query=query,
                preflight_signals=preflight_signals,
                tda_result=tda_result,
            )

        # Step 3: Route to reasoning pathway
        if mode in [ReasoningMode.SIMPLE, ReasoningMode.MODERATE]:
            result = self._standard_response(
                query,
                mode,
                memory_context,
                system_prompt=cae_context.get("system_prompt"),
                meta_findings=meta_findings,
            )
            self._emit_telemetry(
                query_id=query_id,
                stage="final",
                mode=mode.value,
                signals=preflight_signals,
                tda_result=tda_result,
                notes="simple_or_moderate",
                extra_metrics={
                    "safety_state": cae_context.get("state"),
                    "safety_risk": cae_context.get("risk_score"),
                    "learned_skills": self._active_learned_skills,
                },
            )
            return result
        
        # Step 4-7: Executive mode
        logger.warning("🧠 EXECUTIVE MODE ACTIVATED")
        return self._executive_reasoning(
            query, 
            mode, 
            memory_context,
            context,
            query_id=query_id,
            tda_result=tda_result,
            preflight_signals=preflight_signals,
            meta_findings=meta_findings,
        )
    
    def _standard_response(
        self, 
        query: str, 
        mode: ReasoningMode,
        memory: List[Dict],
        system_prompt: Optional[str] = None,
        meta_findings: Optional[Dict] = None,
    ) -> AnalysisResult:
        """Handle simple/moderate queries without executive"""

        prompt = self._augment_prompt_with_learned(query)
        prompt = self._augment_prompt_with_meta(prompt, meta_findings)
        response = self.models.generate(
            prompt,
            model_type="thinking",
            context=memory,
            system=system_prompt,
        )
        
        return AnalysisResult(
            response=response,
            mode=mode,
            confidence=0.8,
            evidence_quality="N/A",
            limitations=[],
            executive_activated=False,
            reasoning_trace={},
            citations=[],
            uncertainty_bounds=(0.7, 0.9)
        )
    
    def _executive_reasoning(
        self,
        query: str,
        mode: ReasoningMode,
        memory: List[Dict],
        context: Optional[Dict],
        query_id: str,
        tda_result: Optional[TDAResult],
        preflight_signals: SignalBundle,
        meta_findings: Optional[Dict] = None,
    ) -> AnalysisResult:
        """
        Full executive analysis pipeline
        
        This is where PhD-level expertise activates
        """
        
        reasoning_trace = {}
        if meta_findings:
            reasoning_trace["meta_analyzer"] = meta_findings
        cae_context = (context or {}).get("cae", {})
        focus_plan = preflight_signals.focus_plan
        exec_cfg = self.models.config.get("executive", {})
        base_temp = exec_cfg.get("temperature", 0.3)
        base_tokens = exec_cfg.get("max_tokens", 2048)
        safety_scale = float(cae_context.get("temperature_scale", 1.0) or 1.0)
        temp = max(0.05, base_temp * focus_plan.temperature_scale * safety_scale)
        max_tokens = int(base_tokens * focus_plan.max_tokens_scale)
        system_prompt = cae_context.get("system_prompt")

        self._emit_telemetry(
            query_id=query_id,
            stage="analysis",
            mode=mode.value,
            signals=preflight_signals,
            tda_result=tda_result,
            notes=f"focus_plan={focus_plan.depth}",
            extra_metrics={
                "learned_skills": self._active_learned_skills,
            },
        )
        
        # Stage 1: Statistical Analysis
        logger.info("📊 Running statistical analysis...")
        stat_analysis = self.statistical.analyze(query, context)
        reasoning_trace['statistical'] = stat_analysis
        
        # Stage 2: Causal Inference
        logger.info("🔗 Running causal inference...")
        causal_analysis = self.causal.analyze(query, stat_analysis)
        reasoning_trace['causal'] = causal_analysis
        
        # Stage 3: Meta-Analysis (if multiple studies)
        if self._detect_multiple_studies(query):
            logger.info("📚 Running meta-analysis...")
            meta_result = self.meta_analysis.synthesize(
                query,
                stat_analysis,
                causal_analysis
            )
            reasoning_trace['meta'] = meta_result
        
        # Stage 4: Bayesian Reasoning
        logger.info("🎲 Updating priors with Bayesian reasoning...")
        bayesian_update = self.bayesian.update_beliefs(
            query,
            reasoning_trace,
            prior_knowledge=memory
        )
        reasoning_trace['bayesian'] = bayesian_update
        
        # Stage 5: Synthesis
        logger.info("🎯 Synthesizing executive conclusion...")
        initial_response = self._synthesize_analysis(
            query,
            reasoning_trace,
            memory,
            temperature=temp,
            max_tokens=max_tokens,
            system=system_prompt,
        )
        
        # Stage 6: Adversarial Validation
        logger.info("🔴 Running adversarial review...")
        critique = self.adversarial.review(
            query,
            initial_response,
            reasoning_trace
        )
        reasoning_trace['adversarial'] = critique
        
        # Iterative focus passes (continued-fraction depth)
        current_response = initial_response
        current_critique = critique
        for i in range(1, focus_plan.depth):
            logger.info(f"🌀 Focus refinement pass {i}/{focus_plan.depth - 1}")
            current_response = self._integrate_critique(
                current_response,
                current_critique,
                confidence=0.5,
                temperature=temp,
                max_tokens=max_tokens,
                system=system_prompt,
            )
            current_critique = self.adversarial.review(
                query,
                current_response,
                reasoning_trace
            )
            reasoning_trace[f"refine_{i}"] = {
                "response": current_response,
                "critique": current_critique,
            }

        # Stage 7: Confidence Calibration
        logger.info("📏 Calibrating confidence...")
        confidence, uncertainty_bounds = self.calibrator.calibrate(
            reasoning_trace,
            current_critique
        )

        # Stage 8: Final Response
        final_response = self._integrate_critique(
            current_response,
            current_critique,
            confidence,
            temperature=temp,
            max_tokens=max_tokens,
            system=system_prompt,
        )
        
        # Stage 9: Evidence grading
        evidence_grade = self._grade_evidence(reasoning_trace)
        
        # Stage 10: Extract limitations
        limitations = self._extract_limitations(
            reasoning_trace,
            current_critique
        )

        # Final telemetry
        final_signals = compute_signals(
            query=query,
            reasoning_trace=reasoning_trace,
            tda_result=tda_result,
            concept_registry=self.concept_registry,
            focus_controller=self.focus_controller,
            health_floor=self.telemetry_config.get("health", {}).get("health_floor", 0.2),
        )
        self._emit_telemetry(
            query_id=query_id,
            stage="self_check",
            mode=mode.value,
            signals=final_signals,
            tda_result=tda_result,
            notes="self_check",
            extra_metrics={
                "safety_state": cae_context.get("state"),
                "safety_risk": cae_context.get("risk_score"),
                "critique_severity": self._estimate_critique_severity(current_critique),
                "learned_skills": self._active_learned_skills,
            },
        )
        self._emit_telemetry(
            query_id=query_id,
            stage="final",
            mode=mode.value,
            signals=final_signals,
            tda_result=tda_result,
            notes="executive_final",
            extra_metrics={
                "safety_state": cae_context.get("state"),
                "safety_risk": cae_context.get("risk_score"),
                "critique_severity": self._estimate_critique_severity(current_critique),
                "learned_skills": self._active_learned_skills,
            },
        )
        
        # Update memory
        self.memory.store(
            query=query,
            response=final_response,
            reasoning_trace=reasoning_trace,
            mode=mode.value
        )
        
        return AnalysisResult(
            response=final_response,
            mode=mode,
            confidence=confidence,
            evidence_quality=evidence_grade,
            limitations=limitations,
            executive_activated=True,
            reasoning_trace=reasoning_trace,
            citations=self._extract_citations(reasoning_trace),
            uncertainty_bounds=uncertainty_bounds
        )
    
    def _detect_multiple_studies(self, query: str) -> bool:
        """Detect if query involves multiple research papers"""
        indicators = [
            "studies show", "research suggests", "meta-analysis",
            "systematic review", "multiple papers", "literature"
        ]
        return any(ind in query.lower() for ind in indicators)
    
    def _synthesize_analysis(
        self,
        query: str,
        reasoning_trace: Dict,
        memory: List[Dict],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        system: Optional[str] = None,
    ) -> str:
        """Synthesize all analyses into coherent response"""
        
        synthesis_prompt = self._build_synthesis_prompt(
            query,
            reasoning_trace,
            memory
        )
        
        return self.models.generate(
            synthesis_prompt,
            model_type="executive",
            temperature=temperature,
            max_tokens=max_tokens,
            system=system,
        )
    
    def _build_synthesis_prompt(
        self,
        query: str,
        reasoning_trace: Dict,
        memory: List[Dict]
    ) -> str:
        """Construct PhD-level synthesis prompt"""

        learned = self._build_learned_context(query)
        learned_block = f"{learned}\n\n" if learned else ""

        return f"""{learned_block}You are synthesizing PhD-level meta-analytical reasoning.

ORIGINAL QUERY:
{query}

STATISTICAL ANALYSIS:
{reasoning_trace.get('statistical', 'N/A')}

CAUSAL INFERENCE:
{reasoning_trace.get('causal', 'N/A')}

META-ANALYSIS (if applicable):
{reasoning_trace.get('meta', 'N/A')}

BAYESIAN UPDATE:
{reasoning_trace.get('bayesian', 'N/A')}

META-ANALYZER FINDINGS:
{reasoning_trace.get('meta_analyzer', 'N/A')}

PRIOR CONTEXT:
{self._format_memory(memory)}

YOUR TASK: Provide executive-level conclusion following this structure:

## Executive Summary
[2-3 sentences: clear, actionable answer]

## Evidence Quality Assessment
[Grade: A/B/C/D/F with justification]

## Statistical Interpretation
- Effect size (clinical significance)
- Confidence intervals
- P-value interpretation (if relevant)

## Causal Inference
- Can we infer causation?
- Confounding variables
- Alternative explanations

## Key Limitations
- What we DON'T know
- Methodological weaknesses

## Confidence Level
[High/Medium/Low with explicit uncertainty bounds]

## Recommended Action
[What should a reasonable person do with this information?]

CRITICAL: Be intellectually honest. Flag uncertainty. Avoid overclaiming."""

    def _build_learned_context(self, query: str) -> Optional[str]:
        if self._active_learned_context is not None:
            return self._active_learned_context

        ctx, skills = self._prepare_learned_context(query)
        self._active_learned_context = ctx
        self._active_learned_skills = skills
        return ctx

    def _prepare_learned_context(self, query: str) -> Tuple[Optional[str], List[str]]:
        learning_cfg = self.config.get("learning", {}) if isinstance(self.config, dict) else {}
        if not learning_cfg.get("use_retrieval", False):
            return None, []

        kb = self._load_learned_knowledge()
        if not kb:
            return None, []

        selected = self._select_learned_skills(query, kb, top_k=3)
        if not selected:
            return None, []

        lines = ["LEARNED KNOWLEDGE (from prior sessions):"]
        skills = []
        for skill_name, data in selected:
            skills.append(skill_name)
            description = (data.get("description") or "").strip()
            if description:
                lines.append(f"- {skill_name}: {description}")
            examples = data.get("examples") or []
            if examples:
                ex = examples[0] if isinstance(examples, list) else None
                if isinstance(ex, dict):
                    q = (ex.get("query") or "").strip()
                    a = (ex.get("solution") or "").strip()
                    if q or a:
                        if q:
                            q = (q[:160] + "...") if len(q) > 160 else q
                        if a:
                            a = (a[:160] + "...") if len(a) > 160 else a
                        lines.append(f"  Example: Q: {q} A: {a}".strip())

        lines.append("Use this knowledge when relevant, but do not over-apply it.")
        return "\n".join(lines), skills

    def _load_learned_knowledge(self) -> Dict:
        path = self.learned_knowledge_path
        if not path.exists():
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f) or {}
        except Exception as e:
            logger.warning(f"Failed to load learned knowledge: {e}")
            return {}

    def _select_learned_skills(self, query: str, kb: Dict, top_k: int = 3) -> List[Tuple[str, Dict]]:
        if not kb:
            return []

        tokens = set(re.findall(r"[a-zA-Z0-9_]+", query.lower()))
        scored = []
        for skill_name, data in kb.items():
            description = (data.get("description") or "").lower()
            mastery = float(data.get("mastery_level", 0.5) or 0.5)
            text = f"{skill_name} {description}"
            matches = sum(1 for t in tokens if t and t in text)
            score = matches + mastery
            scored.append((score, skill_name, data))

        scored.sort(key=lambda x: x[0], reverse=True)
        selected = [(name, data) for _, name, data in scored[:top_k]]
        return selected

    def _augment_prompt_with_learned(self, query: str) -> str:
        learned = self._build_learned_context(query)
        if not learned:
            return query
        return f"{learned}\n\nQUERY:\n{query}"

    def _augment_prompt_with_meta(self, prompt: str, meta_findings: Optional[Dict]) -> str:
        if not meta_findings:
            return prompt
        return (
            f"{prompt}\n\nMETA-ANALYZER FINDINGS:\n{meta_findings}\n\n"
            "Use these findings to stress-test your answer and surface blind spots."
        )

    def _meta_analyzer_pass(
        self,
        query: str,
        preflight_signals: SignalBundle,
        tda_result: Optional[TDAResult],
    ) -> Dict:
        concepts = self.concept_registry.detect_concepts(query)
        depths = self.concept_registry.concept_depths(concepts)
        avg_depth = sum(depths) / len(depths) if depths else 0.0
        dissonance_score, dissonance_events = self.concept_registry.evaluate_dissonance(concepts)
        chord_freqs = self.concept_registry.chord_frequencies(concepts)
        harmony_distance = self.concept_registry.harmony_key_distance(chord_freqs)

        blind_spots = self._heuristic_blind_spots(query)

        return {
            "concepts": concepts,
            "concept_count": len(concepts),
            "avg_concept_depth": round(avg_depth, 3),
            "dissonance_score": round(dissonance_score, 3),
            "dissonance_events": [e.detail for e in dissonance_events],
            "harmony_key_distance": round(harmony_distance, 3),
            "entropy_score": round(preflight_signals.entropy_score, 3),
            "tda_available": bool(tda_result),
            "blind_spots": blind_spots,
            "notes": "meta-analyzer pass to surface hidden confounds and missing checks",
        }

    def _heuristic_blind_spots(self, query: str) -> List[str]:
        q = query.lower()
        spots: List[str] = []

        if ("cause" in q or "causal" in q) and not any(w in q for w in ["confound", "bias", "control"]):
            spots.append("Causal framing without explicit confounder/bias controls.")

        if any(w in q for w in ["meta-analysis", "systematic review", "synthesize"]) and not any(
            w in q for w in ["heterogeneity", "publication bias", "funnel"]
        ):
            spots.append("Meta-analysis request without heterogeneity or publication-bias checks.")

        if any(w in q for w in ["p-value", "significance", "statistical"]) and "effect size" not in q:
            spots.append("Statistical claims without effect-size interpretation.")

        if "bayesian" in q and "prior" not in q:
            spots.append("Bayesian framing without explicit prior assumptions.")

        if any(w in q for w in ["risk", "harm"]) and not any(w in q for w in ["mitigation", "safety", "guardrail"]):
            spots.append("Risk framing without mitigation or safety plan.")

        return spots
    
    def _integrate_critique(
        self,
        initial_response: str,
        critique: Dict,
        confidence: float,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        system: Optional[str] = None,
    ) -> str:
        """Integrate adversarial critique into final response"""
        
        integration_prompt = f"""INITIAL ANALYSIS:
{initial_response}

ADVERSARIAL CRITIQUE:
{critique.get('weaknesses', 'N/A')}

CALIBRATED CONFIDENCE: {confidence:.2f}

Revise the analysis to address critique while maintaining intellectual honesty.
Strengthen weak points. Acknowledge irreducible uncertainty."""

        return self.models.generate(
            integration_prompt,
            model_type="executive",
            temperature=temperature,
            max_tokens=max_tokens,
            system=system,
        )
    
    def _grade_evidence(self, reasoning_trace: Dict) -> str:
        """PhD-level evidence grading"""
        
        stat = reasoning_trace.get('statistical', {})
        causal = reasoning_trace.get('causal', {})
        
        score = 0
        
        # Sample size
        if stat.get('sample_size', 0) > 1000:
            score += 2
        elif stat.get('sample_size', 0) > 100:
            score += 1
        
        # Study design
        if causal.get('rct', False):
            score += 3
        elif causal.get('cohort', False):
            score += 2
        
        # Effect size
        if stat.get('effect_size', 0) > 0.8:
            score += 2
        elif stat.get('effect_size', 0) > 0.5:
            score += 1
        
        # Map to grade
        if score >= 7: return "A"
        if score >= 5: return "B"
        if score >= 3: return "C"
        if score >= 1: return "D"
        return "F"
    
    def _extract_limitations(
        self,
        reasoning_trace: Dict,
        critique: Dict
    ) -> List[str]:
        """Extract key limitations"""
        
        limitations = []
        
        # From statistical analysis
        if reasoning_trace.get('statistical'):
            stat = reasoning_trace['statistical']
            if stat.get('small_sample'):
                limitations.append("Small sample size limits generalizability")
            if stat.get('wide_ci'):
                limitations.append("Wide confidence intervals indicate high uncertainty")
        
        # From causal inference
        if reasoning_trace.get('causal'):
            causal = reasoning_trace['causal']
            if causal.get('confounding_risk'):
                limitations.append("Potential uncontrolled confounding")
            if not causal.get('mechanism'):
                limitations.append("No established biological mechanism")
        
        # From adversarial review
        if critique.get('missed_factors'):
            limitations.extend(critique['missed_factors'])
        
        return limitations[:5]  # Top 5
    
    def _extract_citations(self, reasoning_trace: Dict) -> List[str]:
        """Extract cited sources"""
        return []
    
    def _format_memory(self, memory: List[Dict]) -> str:
        """Format memory context for prompts"""
        if not memory:
            return "No prior context"
        
        return "\n".join([
            f"- {m['query'][:100]}: {m['response'][:200]}..."
            for m in memory[:3]
        ])
    
    def _estimate_critique_severity(self, critique: Dict) -> float:
        if not critique:
            return 0.0
        text = critique.get("full_critique") or critique.get("weaknesses") or ""
        if not text:
            return 0.0
        length = min(1.0, len(text) / 1500)
        flags = 0
        for key in ["overclaiming", "missing_context", "unknown_unknowns"]:
            if critique.get(key):
                flags += 1
        return min(1.0, 0.5 * length + 0.15 * flags)

    def _init_activation_capture(self) -> Optional[ActivationCapture]:
        local_cfg = self.local_model_config.get("local_model", {})
        if not local_cfg:
            logger.warning("Local model config missing; activation capture disabled")
            return None
        try:
            config = ActivationCaptureConfig(
                model_name=local_cfg.get("model_name", "Qwen/Qwen2.5-7B-Instruct"),
                revision=local_cfg.get("revision", "main"),
                device=local_cfg.get("device", "cuda"),
                dtype=local_cfg.get("dtype", "float16"),
                load_in_4bit=bool(local_cfg.get("load_in_4bit", True)),
                max_new_tokens=int(local_cfg.get("max_new_tokens", 32)),
                max_input_tokens=int(local_cfg.get("max_input_tokens", 512)),
                capture_layers=list(local_cfg.get("capture_layers", [-1, -2, -3, -4])),
                capture_tokens=int(local_cfg.get("capture_tokens", 32)),
                token_stride=int(local_cfg.get("token_stride", 1)),
                seed=int(local_cfg.get("seed", 42)),
            )
            return ActivationCapture(config)
        except Exception as e:
            logger.warning(f"Activation capture init failed: {e}")
            return None

    def _run_activation_probe(self, query: str) -> Optional[TDAResult]:
        if not self.activation_capture:
            return None
        try:
            trace = self.activation_capture.capture(query)
            if not trace or not trace.activations:
                return None
            activations_np = {k: v.numpy() for k, v in trace.activations.items()}
            max_points = int(self.local_model_config.get("local_model", {}).get("max_points", 512))
            return compute_tda(activations_np, max_points=max_points)
        except Exception as e:
            logger.warning(f"Activation probe failed: {e}")
            return None

    def _emit_telemetry(
        self,
        query_id: str,
        stage: str,
        mode: str,
        signals: SignalBundle,
        tda_result: Optional[TDAResult],
        notes: Optional[str] = None,
        extra_metrics: Optional[Dict] = None,
    ):
        metrics = {
            "entropy_score": signals.entropy_score,
            "dissonance_score": signals.dissonance_score,
            "health_score": signals.health_score,
            "harmony_key_distance": signals.harmony_key_distance,
        }
        if extra_metrics:
            metrics.update(extra_metrics)
        if "learned_skills" not in metrics:
            metrics["learned_skills"] = self._active_learned_skills or []
        chord = {
            "product": signals.chord_product,
            "frequencies": signals.chord_frequencies,
            "concepts": signals.concepts,
            "dissonance_events": signals.dissonance_events,
        }
        focus = {
            "depth": signals.focus_plan.depth,
            "temperature_scale": signals.focus_plan.temperature_scale,
            "max_tokens_scale": signals.focus_plan.max_tokens_scale,
            "reason": signals.focus_plan.reason,
            "valve_enabled": self.focus_controller.enabled,
        }
        tda = {}
        if tda_result:
            tda = {
                "betti_0": tda_result.betti_0,
                "betti_1": tda_result.betti_1,
                "persistence_entropy": tda_result.persistence_entropy,
                "max_persistence": tda_result.max_persistence,
                "point_cloud": tda_result.point_cloud,
                "topology_graph": tda_result.topology_graph,
            }
        event = build_event(
            query_id=query_id,
            stage=stage,
            mode=mode,
            metrics=metrics,
            tda=tda,
            chord=chord,
            focus=focus,
            notes=notes,
        )
        self.telemetry_logger.emit(event)
