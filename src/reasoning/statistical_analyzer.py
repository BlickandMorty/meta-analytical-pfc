"""Statistical reasoning engine — effect sizes, power, bias detection."""

import re
from typing import Dict, Optional, Tuple
from dataclasses import dataclass

import numpy as np
from scipy import stats


@dataclass
class StatisticalResult:
    """Structured statistical analysis"""
    effect_size: Optional[float]
    confidence_interval: Optional[Tuple[float, float]]
    p_value: Optional[float]
    sample_size: Optional[int]
    power: Optional[float]
    interpretation: str
    warnings: list


class StatisticalAnalyzer:
    """Effect size, power, CI, p-value contextualization, and bias detection."""
    
    def __init__(self):
        self.alpha = 0.05
        self.power_threshold = 0.8
    
    def analyze(self, query: str, context: Optional[Dict] = None) -> Dict:
        """
        Extract and analyze statistical claims
        
        Returns comprehensive statistical assessment
        """
        
        # Extract statistical information from query
        stats_info = self._extract_statistics(query)
        
        # Analyze each component
        analysis = {
            'effect_size_analysis': self._analyze_effect_size(stats_info),
            'significance_analysis': self._analyze_significance(stats_info),
            'power_analysis': self._analyze_power(stats_info),
            'bias_assessment': self._assess_bias(stats_info),
            'clinical_significance': self._assess_clinical_significance(stats_info),
            'warnings': []
        }
        
        # Add warnings for common statistical errors
        analysis['warnings'].extend(self._detect_statistical_errors(stats_info))
        
        return analysis
    
    def _extract_statistics(self, query: str) -> Dict:
        """
        Extract statistical values from query
        
        Looks for: p-values, effect sizes, CIs, sample sizes, etc.
        """
        
        stats = {
            'p_value': None,
            'effect_size': None,
            'ci_lower': None,
            'ci_upper': None,
            'sample_size': None,
            'correlation': None
        }
        
        # P-value extraction
        p_match = re.search(r'p\s*[<>=]\s*0?\.?\d+', query.lower())
        if p_match:
            p_str = p_match.group()
            p_val = float(re.search(r'0?\.?\d+', p_str).group())
            stats['p_value'] = p_val
        
        # Effect size (d, r, OR, HR)
        d_match = re.search(r'd\s*=\s*-?\d+\.?\d*', query.lower())
        if d_match:
            stats['effect_size'] = float(re.search(r'-?\d+\.?\d*', d_match.group()).group())
        
        # Sample size
        n_match = re.search(r'n\s*=\s*\d+', query.lower())
        if n_match:
            stats['sample_size'] = int(re.search(r'\d+', n_match.group()).group())
        
        # Correlation
        r_match = re.search(r'r\s*=\s*-?0?\.\d+', query.lower())
        if r_match:
            stats['correlation'] = float(re.search(r'-?0?\.\d+', r_match.group()).group())
        
        return stats
    
    def _analyze_effect_size(self, stats: Dict) -> Dict:
        """
        Interpret effect size magnitude
        
        Cohen's d interpretation:
        - 0.2: small
        - 0.5: medium
        - 0.8: large
        """
        
        d = stats.get('effect_size')
        if d is None:
            return {'magnitude': 'unknown', 'interpretation': 'No effect size reported'}
        
        abs_d = abs(d)
        
        if abs_d < 0.2:
            magnitude = 'negligible'
            interpretation = 'Practically zero effect'
        elif abs_d < 0.5:
            magnitude = 'small'
            interpretation = 'Small effect - may not be clinically meaningful'
        elif abs_d < 0.8:
            magnitude = 'medium'
            interpretation = 'Moderate effect - potentially meaningful'
        else:
            magnitude = 'large'
            interpretation = 'Large effect - likely clinically significant'
        
        return {
            'value': d,
            'magnitude': magnitude,
            'interpretation': interpretation
        }
    
    def _analyze_significance(self, stats: Dict) -> Dict:
        """
        Contextualize p-value
        
        Critical insight: p-value ≠ effect size or importance
        """
        
        p = stats.get('p_value')
        n = stats.get('sample_size')
        
        if p is None:
            return {'interpretation': 'No p-value reported'}
        
        analysis = {
            'value': p,
            'statistically_significant': p < self.alpha,
            'warnings': []
        }
        
        # Warning for small effect with large N
        if p < 0.001 and n and n > 1000:
            analysis['warnings'].append(
                "Very small p-value with large N - effect may be statistically "
                "significant but trivially small in magnitude"
            )
        
        # Warning for p-hacking zone
        if 0.04 < p < 0.05:
            analysis['warnings'].append(
                "P-value in 'p-hacking zone' (0.04-0.05) - "
                "increased risk of false positive"
            )
        
        # Interpretation
        if p < 0.001:
            analysis['interpretation'] = "Strong evidence against null hypothesis"
        elif p < 0.01:
            analysis['interpretation'] = "Moderate evidence against null hypothesis"
        elif p < 0.05:
            analysis['interpretation'] = "Weak evidence against null hypothesis"
        else:
            analysis['interpretation'] = "Insufficient evidence to reject null hypothesis"
        
        return analysis
    
    def _analyze_power(self, stats: Dict) -> Dict:
        """
        Estimate statistical power
        
        Power = 1 - β (probability of detecting true effect)
        """
        
        n = stats.get('sample_size')
        d = stats.get('effect_size')
        
        if not (n and d):
            return {'power': None, 'interpretation': 'Insufficient info for power analysis'}
        
        # Simplified power calculation
        from scipy.stats import t
        
        ncp = d * np.sqrt(n / 2)  # Non-centrality parameter
        df = 2 * n - 2
        critical_t = t.ppf(1 - self.alpha/2, df)
        power = 1 - t.cdf(critical_t, df, ncp)
        
        analysis = {
            'power': power,
            'adequate': power >= self.power_threshold,
            'interpretation': ''
        }
        
        if power < 0.5:
            analysis['interpretation'] = "Severely underpowered - high risk of missing true effect"
        elif power < 0.8:
            analysis['interpretation'] = "Underpowered - may miss meaningful effects"
        else:
            analysis['interpretation'] = "Adequately powered"
        
        return analysis
    
    def _assess_bias(self, stats: Dict) -> Dict:
        """
        Assess publication/reporting bias risk
        """
        
        bias_risk = []
        
        p = stats.get('p_value')
        
        # P-hacking indicators
        if p and 0.045 <= p <= 0.05:
            bias_risk.append("P-value clustering near 0.05 (p-hacking signal)")
        
        return {
            'risk_level': 'high' if bias_risk else 'moderate',
            'indicators': bias_risk
        }
    
    def _assess_clinical_significance(self, stats: Dict) -> Dict:
        """
        Distinguish statistical from clinical significance
        """
        
        d = stats.get('effect_size')
        
        if not d:
            return {'assessment': 'Cannot determine without effect size'}
        
        # Minimal clinically important difference (MCID)
        mcid = 0.3
        
        if abs(d) < mcid:
            return {
                'clinically_significant': False,
                'interpretation': 'Effect too small to be clinically meaningful'
            }
        else:
            return {
                'clinically_significant': True,
                'interpretation': 'Effect size suggests potential clinical value'
            }
    
    def _detect_statistical_errors(self, stats: Dict) -> list:
        """
        Flag common statistical misinterpretations
        """
        
        errors = []
        
        p = stats.get('p_value')
        d = stats.get('effect_size')
        n = stats.get('sample_size')
        
        # Error 1: P-value misinterpretation
        if p and p > 0.05:
            errors.append(
                "Remember: p > 0.05 does NOT prove null hypothesis - "
                "absence of evidence ≠ evidence of absence"
            )
        
        # Error 2: Ignoring effect size
        if p and p < 0.05 and not d:
            errors.append(
                "Statistical significance without effect size reported - "
                "cannot assess practical importance"
            )
        
        # Error 3: Small N with strong claim
        if n and n < 30:
            errors.append(
                "Very small sample size - results may not generalize"
            )
        
        return errors
