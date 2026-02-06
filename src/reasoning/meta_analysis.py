"""Meta-analysis engine — publication bias, heterogeneity, evidence synthesis."""

from typing import Dict, List, Optional
import numpy as np
from scipy import stats
from dataclasses import dataclass


@dataclass
class Study:
    """Individual study in meta-analysis"""
    name: str
    effect_size: float
    standard_error: float
    sample_size: int
    year: int
    funding_source: str


class MetaAnalysisEngine:
    """
    PhD-level meta-analytical reasoning
    
    Implements:
    - Random effects meta-analysis
    - Funnel plot asymmetry detection
    - Egger's test for publication bias
    - Heterogeneity analysis (I², τ²)
    """
    
    def __init__(self):
        self.alpha = 0.05
    
    def synthesize(
        self, 
        query: str,
        statistical_analysis: Dict,
        causal_analysis: Dict
    ) -> Dict:
        """
        Meta-analytical synthesis of multiple studies
        
        Returns pooled estimate with publication bias assessment
        """
        
        # Extract studies from query
        studies = self._extract_studies(query)
        
        if len(studies) < 2:
            return {
                'pooled_estimate': None,
                'message': 'Insufficient studies for meta-analysis (need ≥2)'
            }
        
        # Calculate pooled effect size
        pooled = self._random_effects_meta_analysis(studies)
        
        # Assess heterogeneity
        heterogeneity = self._assess_heterogeneity(studies, pooled)
        
        # Publication bias
        pub_bias = self._assess_publication_bias(studies)
        
        # Sensitivity analysis
        sensitivity = self._sensitivity_analysis(studies)
        
        # Final interpretation
        interpretation = self._interpret_meta_analysis(
            pooled,
            heterogeneity,
            pub_bias,
            sensitivity
        )
        
        return {
            'pooled_estimate': pooled,
            'heterogeneity': heterogeneity,
            'publication_bias': pub_bias,
            'sensitivity_analysis': sensitivity,
            'interpretation': interpretation,
            'quality_grade': self._grade_meta_analysis(heterogeneity, pub_bias)
        }
    
    def _extract_studies(self, query: str) -> List[Study]:
        """Extract study information from query"""
        
        # Placeholder: return mock studies
        return [
            Study("Smith 2020", 0.5, 0.15, 200, 2020, "NIH"),
            Study("Jones 2021", 0.3, 0.12, 300, 2021, "Industry"),
            Study("Brown 2022", 0.7, 0.20, 150, 2022, "University")
        ]
    
    def _random_effects_meta_analysis(self, studies: List[Study]) -> Dict:
        """Random effects meta-analysis (DerSimonian-Laird)"""
        
        effects = np.array([s.effect_size for s in studies])
        variances = np.array([s.standard_error**2 for s in studies])
        
        weights = 1 / variances
        
        pooled_fixed = np.sum(weights * effects) / np.sum(weights)
        
        Q = np.sum(weights * (effects - pooled_fixed)**2)
        df = len(studies) - 1
        C = np.sum(weights) - np.sum(weights**2) / np.sum(weights)
        tau_squared = max(0, (Q - df) / C)
        
        re_weights = 1 / (variances + tau_squared)
        
        pooled_random = np.sum(re_weights * effects) / np.sum(re_weights)
        
        pooled_se = np.sqrt(1 / np.sum(re_weights))
        
        ci_lower = pooled_random - 1.96 * pooled_se
        ci_upper = pooled_random + 1.96 * pooled_se
        
        z = pooled_random / pooled_se
        p_value = 2 * (1 - stats.norm.cdf(abs(z)))
        
        return {
            'effect_size': pooled_random,
            'standard_error': pooled_se,
            'ci_lower': ci_lower,
            'ci_upper': ci_upper,
            'p_value': p_value,
            'tau_squared': tau_squared,
            'n_studies': len(studies)
        }
    
    def _assess_heterogeneity(self, studies: List[Study], pooled: Dict) -> Dict:
        """Assess between-study heterogeneity"""
        
        effects = np.array([s.effect_size for s in studies])
        variances = np.array([s.standard_error**2 for s in studies])
        weights = 1 / variances
        
        Q = np.sum(weights * (effects - pooled['effect_size'])**2)
        df = len(studies) - 1
        Q_p_value = 1 - stats.chi2.cdf(Q, df) if df > 0 else 1.0
        
        I_squared = max(0, 100 * (Q - df) / Q) if Q > 0 else 0
        
        if I_squared < 25:
            interpretation = "Low heterogeneity - studies are consistent"
        elif I_squared < 50:
            interpretation = "Moderate heterogeneity - some between-study variation"
        elif I_squared < 75:
            interpretation = "Substantial heterogeneity - results vary considerably"
        else:
            interpretation = "Very high heterogeneity - pooled estimate may be misleading"
        
        return {
            'Q': Q,
            'Q_p_value': Q_p_value,
            'I_squared': I_squared,
            'tau_squared': pooled['tau_squared'],
            'interpretation': interpretation,
            'warning': "High heterogeneity suggests different populations/interventions" if I_squared > 75 else None
        }
    
    def _assess_publication_bias(self, studies: List[Study]) -> Dict:
        """Assess publication bias"""
        
        if len(studies) < 10:
            return {
                'eggers_test': None,
                'warning': 'Need ≥10 studies for reliable publication bias assessment',
                'risk': 'moderate'
            }
        
        effects = np.array([s.effect_size for s in studies])
        se = np.array([s.standard_error for s in studies])
        precision = 1 / se
        
        from scipy.stats import linregress
        
        standardized_effects = effects / se
        slope, intercept, r_value, p_value, std_err = linregress(precision, standardized_effects)
        
        if p_value < 0.05:
            bias_interpretation = "Significant funnel plot asymmetry - publication bias likely"
            risk = 'high'
        else:
            bias_interpretation = "No significant funnel plot asymmetry detected"
            risk = 'low'
        
        industry_funded = sum(1 for s in studies if 'industry' in s.funding_source.lower())
        if industry_funded / len(studies) > 0.5:
            bias_interpretation += " | Warning: >50% industry-funded studies"
            risk = 'high'
        
        return {
            'eggers_test': {
                'intercept': intercept,
                'p_value': p_value
            },
            'interpretation': bias_interpretation,
            'risk': risk,
            'industry_funding_proportion': industry_funded / len(studies)
        }
    
    def _sensitivity_analysis(self, studies: List[Study]) -> Dict:
        """Sensitivity analysis - robustness of pooled estimate"""
        
        effects = [s.effect_size for s in studies]
        
        loo_estimates = []
        for i in range(len(studies)):
            remaining = studies[:i] + studies[i+1:]
            if len(remaining) >= 2:
                pooled_loo = self._random_effects_meta_analysis(remaining)
                loo_estimates.append(pooled_loo['effect_size'])
        
        loo_range = max(loo_estimates) - min(loo_estimates) if loo_estimates else 0
        
        years = [s.year for s in studies]
        from scipy.stats import pearsonr
        time_correlation, time_p = pearsonr(years, effects) if len(years) > 2 else (0, 1)
        
        if loo_range < 0.2:
            robustness = "Robust - estimate stable across sensitivity analyses"
        elif loo_range < 0.5:
            robustness = "Moderately robust - some sensitivity to individual studies"
        else:
            robustness = "Fragile - pooled estimate highly dependent on specific studies"
        
        return {
            'leave_one_out_range': loo_range,
            'time_trend_correlation': time_correlation,
            'time_trend_p_value': time_p,
            'robustness': robustness
        }
    
    def _interpret_meta_analysis(
        self,
        pooled: Dict,
        heterogeneity: Dict,
        pub_bias: Dict,
        sensitivity: Dict
    ) -> str:
        """Generate comprehensive interpretation"""
        
        interpretation = f"""
META-ANALYSIS RESULTS:

Pooled Effect Size: {pooled['effect_size']:.3f} (95% CI: {pooled['ci_lower']:.3f} to {pooled['ci_upper']:.3f})
Statistical Significance: p = {pooled['p_value']:.4f}
Number of Studies: {pooled['n_studies']}

HETEROGENEITY:
I² = {heterogeneity['I_squared']:.1f}%
{heterogeneity['interpretation']}

PUBLICATION BIAS:
Risk Level: {pub_bias['risk'].upper()}
{pub_bias['interpretation']}

ROBUSTNESS:
{sensitivity['robustness']}

OVERALL QUALITY:
{self._grade_meta_analysis(heterogeneity, pub_bias)}
"""
        
        return interpretation.strip()
    
    def _grade_meta_analysis(self, heterogeneity: Dict, pub_bias: Dict) -> str:
        """Grade meta-analysis quality"""
        
        points = 0
        
        if heterogeneity['I_squared'] < 50:
            points += 2
        
        if pub_bias['risk'] == 'low':
            points += 2
        elif pub_bias['risk'] == 'moderate':
            points += 1
        
        if points >= 4:
            return "A (High-quality meta-analysis)"
        elif points >= 3:
            return "B (Good-quality meta-analysis)"
        elif points >= 2:
            return "C (Moderate-quality meta-analysis)"
        else:
            return "D (Low-quality meta-analysis - interpret with caution)"
