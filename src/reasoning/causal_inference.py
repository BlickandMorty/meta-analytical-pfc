"""Causal inference engine — DAGs, Bradford Hill, counterfactuals."""

from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
import networkx as nx
from enum import Enum


class StudyDesign(Enum):
    """Hierarchy of causal evidence"""
    RCT = "randomized_controlled_trial"
    COHORT = "cohort_study"
    CASE_CONTROL = "case_control"
    CROSS_SECTIONAL = "cross_sectional"
    CASE_REPORT = "case_report"


@dataclass
class CausalEstimate:
    """Causal effect estimate with uncertainty"""
    effect: float
    lower_bound: float
    upper_bound: float
    confounders_controlled: List[str]
    confounders_uncontrolled: List[str]
    causal_claim_justified: bool
    strength_of_evidence: str


class CausalInferenceEngine:
    """
    PhD-level causal reasoning
    
    Implements:
    - Directed Acyclic Graphs (DAGs)
    - Bradford Hill criteria
    - Counterfactual reasoning
    - Confounding detection
    """
    
    def __init__(self):
        self.bradford_hill_criteria = [
            'strength',
            'consistency', 
            'specificity',
            'temporality',
            'biological_gradient',
            'plausibility',
            'coherence',
            'experiment',
            'analogy'
        ]
    
    def analyze(self, query: str, statistical_analysis: Dict) -> Dict:
        """
        Full causal inference pipeline
        
        Returns causal assessment with explicit uncertainty
        """
        
        # Extract causal claim
        causal_claim = self._extract_causal_claim(query)
        
        # Identify study design
        study_design = self._identify_study_design(query)
        
        # Build causal graph (DAG)
        dag = self._construct_dag(causal_claim, query)
        
        # Identify confounders
        confounders = self._identify_confounders(dag, causal_claim)
        
        # Apply Bradford Hill criteria
        hill_score = self._apply_bradford_hill(
            query, 
            statistical_analysis,
            study_design
        )
        
        # Counterfactual reasoning
        counterfactual = self._counterfactual_analysis(
            causal_claim,
            confounders
        )
        
        # Final causal verdict
        causal_verdict = self._synthesize_causal_evidence(
            study_design,
            hill_score,
            confounders,
            statistical_analysis
        )
        
        return {
            'causal_claim': causal_claim,
            'study_design': study_design.value,
            'dag': self._dag_to_dict(dag),
            'confounders_identified': confounders,
            'bradford_hill_score': hill_score,
            'counterfactual_analysis': counterfactual,
            'causal_verdict': causal_verdict,
            'evidence_strength': self._grade_causal_evidence(study_design, hill_score)
        }
    
    def _extract_causal_claim(self, query: str) -> Dict:
        """Extract X → Y causal claim"""
        
        causal_keywords = ['causes', 'leads to', 'results in', 'increases', 'reduces', 'prevents']
        
        query_lower = query.lower()
        
        for keyword in causal_keywords:
            if keyword in query_lower:
                parts = query_lower.split(keyword)
                if len(parts) >= 2:
                    return {
                        'exposure': parts[0].strip()[-50:],
                        'outcome': parts[1].strip()[:50],
                        'direction': 'positive' if keyword in ['causes', 'increases', 'leads to'] else 'negative'
                    }
        
        return {
            'exposure': 'unknown',
            'outcome': 'unknown',
            'direction': 'unknown'
        }
    
    def _identify_study_design(self, query: str) -> StudyDesign:
        """Identify study design from query"""
        
        query_lower = query.lower()
        
        if any(word in query_lower for word in ['randomized', 'rct', 'placebo']):
            return StudyDesign.RCT
        elif any(word in query_lower for word in ['cohort', 'prospective', 'followed']):
            return StudyDesign.COHORT
        elif 'case-control' in query_lower or 'case control' in query_lower:
            return StudyDesign.CASE_CONTROL
        elif any(word in query_lower for word in ['cross-sectional', 'survey']):
            return StudyDesign.CROSS_SECTIONAL
        elif 'case report' in query_lower or 'case study' in query_lower:
            return StudyDesign.CASE_REPORT
        else:
            return StudyDesign.CROSS_SECTIONAL
    
    def _construct_dag(self, causal_claim: Dict, query: str) -> nx.DiGraph:
        """Build Directed Acyclic Graph"""
        
        dag = nx.DiGraph()
        
        exposure = causal_claim['exposure']
        outcome = causal_claim['outcome']
        
        # Add main causal path
        dag.add_edge(exposure, outcome)
        
        # Add common confounders
        confounders = self._get_domain_confounders(exposure, outcome, query)
        
        for confounder in confounders:
            dag.add_edge(confounder, exposure)
            dag.add_edge(confounder, outcome)
        
        return dag
    
    def _get_domain_confounders(
        self, 
        exposure: str, 
        outcome: str, 
        query: str
    ) -> List[str]:
        """Identify plausible confounders based on domain knowledge"""
        
        confounders = []
        
        # Example: Acetaminophen-Autism
        if 'acetaminophen' in exposure.lower() and 'autism' in outcome.lower():
            confounders = [
                'maternal_fever',
                'maternal_infection', 
                'prenatal_inflammation',
                'socioeconomic_status'
            ]
        
        # Example: Psilocybin-Depression
        elif 'psilocybin' in exposure.lower() and 'depression' in outcome.lower():
            confounders = [
                'expectancy_effects',
                'therapeutic_support',
                'baseline_severity',
                'concurrent_therapy'
            ]
        
        # Generic confounders
        else:
            confounders = [
                'age',
                'sex',
                'socioeconomic_status',
                'comorbidities'
            ]
        
        return confounders
    
    def _identify_confounders(
        self, 
        dag: nx.DiGraph, 
        causal_claim: Dict
    ) -> Dict:
        """Identify confounders, mediators, colliders"""
        
        exposure = causal_claim['exposure']
        outcome = causal_claim['outcome']
        
        confounders = []
        mediators = []
        colliders = []
        
        for node in dag.nodes():
            if node in [exposure, outcome]:
                continue
            
            # Check if confounder
            if (dag.has_edge(node, exposure) and dag.has_edge(node, outcome)):
                confounders.append(node)
            
            # Check if mediator
            elif (dag.has_edge(exposure, node) and dag.has_edge(node, outcome)):
                mediators.append(node)
            
            # Check if collider
            elif (dag.has_edge(exposure, node) and dag.has_edge(outcome, node)):
                colliders.append(node)
        
        return {
            'confounders': confounders,
            'mediators': mediators,
            'colliders': colliders,
            'warning': 'Conditioning on colliders induces spurious correlation!' if colliders else None
        }
    
    def _apply_bradford_hill(
        self, 
        query: str,
        statistical_analysis: Dict,
        study_design: StudyDesign
    ) -> Dict:
        """Apply Bradford Hill criteria for causation"""
        
        scores = {}
        
        # 1. Strength
        effect_size = statistical_analysis.get('effect_size_analysis', {}).get('value', 0)
        scores['strength'] = 1.0 if abs(effect_size) > 0.8 else 0.5 if abs(effect_size) > 0.3 else 0.0
        
        # 2. Consistency
        scores['consistency'] = 0.5
        
        # 3. Specificity
        scores['specificity'] = 0.5
        
        # 4. Temporality (CRITICAL)
        if study_design in [StudyDesign.RCT, StudyDesign.COHORT]:
            scores['temporality'] = 1.0
        else:
            scores['temporality'] = 0.0
        
        # 5. Biological gradient
        scores['biological_gradient'] = 1.0 if 'dose' in query.lower() else 0.0
        
        # 6. Plausibility
        scores['plausibility'] = self._check_biological_plausibility(query)
        
        # 7. Coherence
        scores['coherence'] = 0.5
        
        # 8. Experiment
        scores['experiment'] = 1.0 if study_design == StudyDesign.RCT else 0.0
        
        # 9. Analogy
        scores['analogy'] = 0.5
        
        # Calculate total score
        total_score = sum(scores.values()) / len(scores)
        
        return {
            'criteria_scores': scores,
            'total_score': total_score,
            'interpretation': self._interpret_hill_score(total_score)
        }
    
    def _check_biological_plausibility(self, query: str) -> float:
        """Check if proposed mechanism is biologically plausible"""
        
        mechanism_keywords = [
            'mechanism', 'pathway', 'receptor', 'neurotransmitter',
            'inflammation', 'oxidative', 'immune', 'genetic'
        ]
        
        query_lower = query.lower()
        mentions = sum(1 for keyword in mechanism_keywords if keyword in query_lower)
        
        return min(1.0, mentions * 0.3)
    
    def _interpret_hill_score(self, score: float) -> str:
        """Interpret Bradford Hill total score"""
        
        if score >= 0.7:
            return "Strong evidence for causation"
        elif score >= 0.5:
            return "Moderate evidence for causation"
        elif score >= 0.3:
            return "Weak evidence for causation"
        else:
            return "Insufficient evidence for causation"
    
    def _counterfactual_analysis(
        self, 
        causal_claim: Dict,
        confounders: Dict
    ) -> Dict:
        """Counterfactual reasoning: What if intervention didn't occur?"""
        
        exposure = causal_claim['exposure']
        outcome = causal_claim['outcome']
        
        analysis = {
            'counterfactual_question': f"What would happen to {outcome} if we removed {exposure}?",
            'confounding_adjustment': f"Must control for: {', '.join(confounders.get('confounders', []))}",
            'alternative_explanations': self._generate_alternatives(exposure, outcome, confounders)
        }
        
        return analysis
    
    def _generate_alternatives(
        self, 
        exposure: str, 
        outcome: str,
        confounders: Dict
    ) -> List[str]:
        """Generate alternative causal explanations"""
        
        alternatives = []
        
        if confounders.get('confounders'):
            alternatives.append(
                f"Confounding by {confounders['confounders'][0]}"
            )
        
        alternatives.append(f"Reverse causation: {outcome} → {exposure}")
        alternatives.append("Selection bias in who receives treatment")
        alternatives.append("Measurement error in exposure or outcome")
        
        return alternatives
    
    def _synthesize_causal_evidence(
        self,
        study_design: StudyDesign,
        hill_score: Dict,
        confounders: Dict,
        statistical_analysis: Dict
    ) -> Dict:
        """Final causal verdict"""
        
        design_weights = {
            StudyDesign.RCT: 1.0,
            StudyDesign.COHORT: 0.7,
            StudyDesign.CASE_CONTROL: 0.5,
            StudyDesign.CROSS_SECTIONAL: 0.3,
            StudyDesign.CASE_REPORT: 0.1
        }
        
        design_weight = design_weights[study_design]
        hill_total = hill_score['total_score']
        
        confounder_penalty = len(confounders.get('confounders', [])) * 0.1
        
        causal_confidence = design_weight * hill_total - confounder_penalty
        causal_confidence = max(0.0, min(1.0, causal_confidence))
        
        if causal_confidence >= 0.7:
            verdict = "Probable causal relationship"
        elif causal_confidence >= 0.5:
            verdict = "Possible causal relationship"
        elif causal_confidence >= 0.3:
            verdict = "Weak evidence for causation - likely correlation"
        else:
            verdict = "Insufficient evidence for causation - spurious correlation likely"
        
        return {
            'confidence': causal_confidence,
            'verdict': verdict,
            'reasoning': f"Study design: {study_design.value}, Hill score: {hill_total:.2f}"
        }
    
    def _grade_causal_evidence(
        self, 
        study_design: StudyDesign,
        hill_score: Dict
    ) -> str:
        """Grade strength of causal evidence (A-F)"""
        
        design_points = {
            StudyDesign.RCT: 4,
            StudyDesign.COHORT: 3,
            StudyDesign.CASE_CONTROL: 2,
            StudyDesign.CROSS_SECTIONAL: 1,
            StudyDesign.CASE_REPORT: 0
        }
        
        hill_points = int(hill_score['total_score'] * 4)
        
        total_points = design_points[study_design] + hill_points
        
        if total_points >= 7:
            return "A (Strong causal evidence)"
        elif total_points >= 5:
            return "B (Moderate causal evidence)"
        elif total_points >= 3:
            return "C (Weak causal evidence)"
        elif total_points >= 1:
            return "D (Very weak evidence)"
        else:
            return "F (No causal evidence)"
    
    def _dag_to_dict(self, dag: nx.DiGraph) -> Dict:
        """Convert DAG to serializable format"""
        
        return {
            'nodes': list(dag.nodes()),
            'edges': list(dag.edges()),
            'description': 'Causal directed acyclic graph'
        }
