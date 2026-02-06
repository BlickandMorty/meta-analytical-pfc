"""Adaptive PFC — query routing, expert coordination, and recursive learning."""

from typing import Dict, Optional
from src.core.pfc_engine import MetaAnalyticalPFC
from src.control.cae_engine import ContextualAllostasisEngine
from src.utils.config_loader import ConfigLoader
from src.learning.pattern_detector import PatternDetector
from src.learning.training_generator import TrainingGenerator
from src.learning.model_updater import ModelUpdater
from src.learning.executive_trace import ExecutiveTraceMemory
from loguru import logger


class AdaptivePFC:
    """
    PREFRONTAL CORTEX SYSTEM
    
    Executive oversight with:
    - Specialized expert modules
    - Recursive self-improvement
    - Meta-learning from experience
    """
    
    def __init__(self):
        logger.info("Initializing Adaptive PFC...")
        
        # Specialized expert modules
        self.research_expert = MetaAnalyticalPFC()
        
        # Placeholders for future modules
        self.legal_expert = None  # TODO: Implement
        self.strategy_expert = None  # TODO: Implement
        self.creative_expert = None  # TODO: Implement
        
        self.available_experts = {
            'research': self.research_expert,
            'legal': self.legal_expert,
            'strategy': self.strategy_expert,
            'creative': self.creative_expert
        }
        
        # Learning components (THE RECURSIVE LEARNING SYSTEM)
        self.pattern_detector = PatternDetector()
        self.training_generator = TrainingGenerator()
        self.model_updater = ModelUpdater()
        self.executive_trace = ExecutiveTraceMemory()

        # Contextual Allostasis Engine (CAE)
        config_loader = ConfigLoader()
        cae_config = config_loader.load_yaml("cae.yaml", default={})
        self.cae = ContextualAllostasisEngine(cae_config)
        
        # Learning config
        self.learning_threshold = 10  # Trigger learning after N similar activations
        self.min_confidence_gap = 0.3  # Minimum gap to consider it a skill gap
        
        logger.success("Adaptive PFC initialized")

    def trigger_learning_now(self) -> Dict:
        """
        Manually trigger a learning cycle regardless of thresholds.
        """
        all_traces = self.executive_trace.get_all()
        if not all_traces:
            return {
                "status": "no_traces",
                "message": "No executive traces yet. Ask a few complex queries first.",
            }

        self._trigger_learning_cycle()
        return {
            "status": "ok",
            "message": "Learning cycle triggered. Check logs for details.",
        }

    def list_learned_skills(self) -> Dict:
        """
        List learned skills from the knowledge base.
        """
        try:
            skills = self.model_updater.knowledge_base.list_skills()
            details = {}
            for name in skills:
                info = self.model_updater.knowledge_base.get_skill(name) or {}
                details[name] = {
                    "description": info.get("description", ""),
                    "mastery_level": info.get("mastery_level", 0.0),
                }
            return {
                "status": "ok",
                "count": len(skills),
                "skills": skills,
                "details": details,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to read learned skills: {e}",
                "count": 0,
                "skills": [],
                "details": {},
            }
    
    def process(
        self, 
        query: str, 
        domain: str = 'auto',
        user_id: Optional[str] = None
    ) -> Dict:
        """
        Main PFC processing with meta-learning
        
        Flow:
        1. Auto-detect domain
        2. Route to expert
        3. Log executive trace
        4. Check if learning should trigger
        5. Return result
        """
        
        # Auto-detect domain if not specified
        if domain == 'auto':
            domain = self._detect_domain(query)
        
        logger.info(f"Domain detected: {domain}")
        
        # Route to appropriate expert
        expert = self.available_experts.get(domain)
        
        if expert is None:
            return {
                'error': f"Expert module '{domain}' not yet implemented",
                'available_modules': [k for k, v in self.available_experts.items() if v is not None],
                'suggestion': 'Use domain="research" for now'
            }
        
        # CAE safety context
        cae_output = self.cae.evaluate(query)
        context = {
            "cae": {
                "state": cae_output.state.value,
                "risk_score": cae_output.risk_score,
                "raw_score": cae_output.raw_score,
                "avg_score": cae_output.avg_score,
                "system_prompt": cae_output.system_prompt,
                "temperature_scale": cae_output.temperature_scale,
            }
        }

        # Execute expert reasoning
        result = expert.process(query, user_id=user_id, context=context)
        
        # Log executive trace (for meta-learning)
        if result.executive_activated:
            logger.info("📝 Logging executive trace for meta-learning")
            self.executive_trace.log(
                query=query,
                domain=domain,
                confidence=result.confidence,
                reasoning_trace=result.reasoning_trace,
                user_id=user_id
            )
            
            # Check if we should trigger learning
            if self._should_trigger_learning():
                logger.warning("🔄 Learning threshold reached - triggering recursive improvement")
                self._trigger_learning_cycle()
        
        return result
    
    def _detect_domain(self, query: str) -> str:
        """Auto-detect which expert to activate"""
        
        query_lower = query.lower()
        
        # Research keywords
        research_keywords = [
            'study', 'research', 'p-value', 'correlation', 'meta-analysis',
            'effect size', 'statistical', 'hypothesis', 'paper', 'journal'
        ]
        if any(kw in query_lower for kw in research_keywords):
            return 'research'
        
        # Legal keywords
        legal_keywords = ['contract', 'legal', 'law', 'precedent', 'statute', 'court']
        if any(kw in query_lower for kw in legal_keywords):
            return 'legal'
        
        # Strategy keywords
        strategy_keywords = ['strategy', 'investment', 'business', 'decision', 'planning', 'market']
        if any(kw in query_lower for kw in strategy_keywords):
            return 'strategy'
        
        # Default to research (since it's implemented)
        return 'research'
    
    def _should_trigger_learning(self) -> bool:
        """
        Decide if it's time to update base models
        
        Triggers when:
        - Executive activated N times on similar queries
        - Consistent pattern of skill gaps detected
        """
        
        recent_traces = self.executive_trace.get_recent(n=50)
        
        if len(recent_traces) < self.learning_threshold:
            return False
        
        # Detect patterns
        patterns_result = self.pattern_detector.detect_patterns(recent_traces)
        patterns = patterns_result.get("patterns", [])
        
        # If we see recurring skill gap, trigger learning
        for pattern in patterns:
            if (pattern.get('size', 0) >= self.learning_threshold and
                pattern.get('avg_confidence', 0) > 0.7):
                logger.info(f"🔍 Detected learnable pattern: {pattern.get('skill_name', 'unknown')}")
                return True
        
        return False
    
    def _trigger_learning_cycle(self):
        """
        Execute recursive self-improvement
        
        This is where PFC teaches the subconscious
        """
        
        logger.warning("="*60)
        logger.warning("RECURSIVE LEARNING CYCLE INITIATED")
        logger.warning("="*60)
        
        # Get all executive traces
        all_traces = self.executive_trace.get_all()
        
        # Identify skill gaps
        patterns_result = self.pattern_detector.detect_patterns(all_traces)
        skill_gaps = patterns_result.get("skill_gaps", [])
        
        if not skill_gaps:
            logger.info("No significant skill gaps detected")
            return
        
        logger.info(f"Found {len(skill_gaps)} skill gaps to learn")
        
        # Learn each skill
        for gap in skill_gaps:
            skill_name = gap.get("skill_name") or gap.get("pattern") or "general_reasoning"
            logger.info(f"🎓 Learning skill: {skill_name}")
            
            # Generate training data from executive traces
            base_examples = self.training_generator.generate_training_examples(
                traces=all_traces,
                skill_name=skill_name,
                sample_size=10
            )
            augmented = self.training_generator.create_augmented_examples(
                base_examples,
                variations_per_example=2
            )
            training_data = [ex.to_dict() for ex in augmented]
            logger.info(f"Generated {len(training_data)} training examples")
            
            # Fine-tune base model
            # (In production, this would actually fine-tune)
            # (For now, we store in RAG knowledge base)
            self.model_updater.teach_skill(
                skill_name=skill_name,
                skill_description=f"Handle queries related to {skill_name.replace('_', ' ')}",
                training_examples=training_data
            )
            
            logger.success(f"✅ Skill '{skill_name}' learned and stored")
            
            # Archive these traces (already learned)
            self.executive_trace.archive_pattern(skill_name)
        
        logger.success("Recursive learning cycle complete")
