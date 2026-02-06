"""Bayesian reasoning engine — prior updating, credible intervals, Bayes factors."""

from typing import Dict, List, Optional
import numpy as np
from scipy import stats


class BayesianReasoner:
    """
    PhD-level Bayesian inference
    
    Implements:
    - Prior probability assignment
    - Likelihood calculation
    - Posterior updating (Bayes' theorem)
    - Credible intervals
    - Bayes factors
    """
    
    def __init__(self):
        self.default_prior_mean = 0.0
        self.default_prior_sd = 0.5
    
    def update_beliefs(
        self,
        query: str,
        reasoning_trace: Dict,
        prior_knowledge: Optional[List[Dict]] = None
    ) -> Dict:
        """
        Bayesian belief updating
        
        P(Hypothesis | Data) ∝ P(Data | Hypothesis) × P(Hypothesis)
        """
        
        hypothesis = self._extract_hypothesis(query)
        
        prior = self._set_prior(hypothesis, prior_knowledge)
        
        likelihood = self._calculate_likelihood(reasoning_trace)
        
        posterior = self._bayesian_update(prior, likelihood)
        
        bayes_factor = self._calculate_bayes_factor(likelihood, prior)
        
        sensitivity = self._prior_sensitivity(likelihood, prior)
        
        return {
            'hypothesis': hypothesis,
            'prior': prior,
            'likelihood': likelihood,
            'posterior': posterior,
            'bayes_factor': bayes_factor,
            'sensitivity': sensitivity,
            'interpretation': self._interpret_bayesian(posterior, bayes_factor)
        }
    
    def _extract_hypothesis(self, query: str) -> str:
        """Extract testable hypothesis from query"""
        return query[:100]
    
    def _set_prior(
        self, 
        hypothesis: str, 
        prior_knowledge: Optional[List[Dict]]
    ) -> Dict:
        """Set prior probability"""
        
        if prior_knowledge:
            relevant_priors = [
                pk for pk in prior_knowledge 
                if self._is_relevant(pk['query'], hypothesis)
            ]
            
            if relevant_priors:
                prior_mean = np.mean([
                    self._extract_effect_estimate(pk) 
                    for pk in relevant_priors
                ])
                prior_sd = 0.3
                
                return {
                    'distribution': 'normal',
                    'mean': prior_mean,
                    'sd': prior_sd,
                    'source': 'informed_prior_from_history'
                }
        
        return {
            'distribution': 'normal',
            'mean': self.default_prior_mean,
            'sd': self.default_prior_sd,
            'source': 'default_skeptical_prior'
        }
    
    def _is_relevant(self, past_query: str, current_hypothesis: str) -> bool:
        """Check if past query is relevant to current hypothesis"""
        
        common_words = set(past_query.lower().split()) & set(current_hypothesis.lower().split())
        return len(common_words) >= 2
    
    def _extract_effect_estimate(self, prior_knowledge: Dict) -> float:
        """Extract effect size estimate from prior knowledge"""
        return 0.3  # Placeholder
    
    def _calculate_likelihood(self, reasoning_trace: Dict) -> Dict:
        """Calculate likelihood of data given hypothesis"""
        
        stat_analysis = reasoning_trace.get('statistical', {})
        
        effect_size = stat_analysis.get('effect_size_analysis', {}).get('value', 0)
        
        standard_error = 0.2
        
        return {
            'distribution': 'normal',
            'mean': effect_size,
            'sd': standard_error,
            'source': 'observed_data'
        }
    
    def _bayesian_update(self, prior: Dict, likelihood: Dict) -> Dict:
        """Bayesian updating: combine prior and likelihood"""
        
        mu_p = prior['mean']
        sigma_p = prior['sd']
        
        mu_l = likelihood['mean']
        sigma_l = likelihood['sd']
        
        precision_p = 1 / sigma_p**2
        precision_l = 1 / sigma_l**2
        
        precision_post = precision_p + precision_l
        sigma_post = np.sqrt(1 / precision_post)
        
        mu_post = (precision_p * mu_p + precision_l * mu_l) / precision_post
        
        ci_lower = mu_post - 1.96 * sigma_post
        ci_upper = mu_post + 1.96 * sigma_post
        
        prob_positive = 1 - stats.norm.cdf(0, mu_post, sigma_post)
        
        return {
            'distribution': 'normal',
            'mean': mu_post,
            'sd': sigma_post,
            'credible_interval': (ci_lower, ci_upper),
            'prob_effect_positive': prob_positive,
            'prob_effect_negative': 1 - prob_positive
        }
    
    def _calculate_bayes_factor(self, likelihood: Dict, prior: Dict) -> Dict:
        """Calculate Bayes Factor"""
        
        observed_effect = likelihood['mean']
        se = likelihood['sd']
        
        likelihood_h1 = stats.norm.pdf(observed_effect, observed_effect, se)
        
        likelihood_h0 = stats.norm.pdf(observed_effect, 0, se)
        
        bf = likelihood_h1 / likelihood_h0 if likelihood_h0 > 0 else float('inf')
        
        if bf > 10:
            interpretation = "Strong evidence FOR hypothesis"
        elif bf > 3:
            interpretation = "Moderate evidence FOR hypothesis"
        elif bf > 1:
            interpretation = "Weak evidence FOR hypothesis"
        elif bf > 0.33:
            interpretation = "Weak evidence AGAINST hypothesis"
        elif bf > 0.1:
            interpretation = "Moderate evidence AGAINST hypothesis"
        else:
            interpretation = "Strong evidence AGAINST hypothesis"
        
        return {
            'bayes_factor': bf,
            'log_bf': np.log(bf) if bf > 0 else -np.inf,
            'interpretation': interpretation
        }
    
    def _prior_sensitivity(self, likelihood: Dict, prior: Dict) -> Dict:
        """Test sensitivity to prior choice"""
        
        skeptical_prior = {'mean': 0.0, 'sd': 0.5, 'distribution': 'normal'}
        skeptical_posterior = self._bayesian_update(skeptical_prior, likelihood)
        
        optimistic_prior = {'mean': 0.5, 'sd': 0.3, 'distribution': 'normal'}
        optimistic_posterior = self._bayesian_update(optimistic_prior, likelihood)
        
        posterior_range = abs(
            skeptical_posterior['mean'] - optimistic_posterior['mean']
        )
        
        if posterior_range < 0.1:
            sensitivity_interpretation = "Robust - conclusion not sensitive to prior choice"
        elif posterior_range < 0.3:
            sensitivity_interpretation = "Moderately robust"
        else:
            sensitivity_interpretation = "Sensitive to prior - weak data relative to prior"
        
        return {
            'skeptical_posterior': skeptical_posterior['mean'],
            'optimistic_posterior': optimistic_posterior['mean'],
            'posterior_range': posterior_range,
            'interpretation': sensitivity_interpretation
        }
    
    def _interpret_bayesian(self, posterior: Dict, bayes_factor: Dict) -> str:
        """Generate human-readable Bayesian interpretation"""
        
        return f"""
Posterior Mean: {posterior['mean']:.3f}
95% Credible Interval: ({posterior['credible_interval'][0]:.3f}, {posterior['credible_interval'][1]:.3f})
P(Effect > 0): {posterior['prob_effect_positive']:.1%}

Bayes Factor: {bayes_factor['bayes_factor']:.2f}
{bayes_factor['interpretation']}
"""
