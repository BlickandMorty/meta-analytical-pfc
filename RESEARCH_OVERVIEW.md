# Meta-Analytical PFC — Research Overview

This system is a research-oriented orchestration layer that instruments model behavior, computes structured signals, and logs telemetry for analysis. It is not a standalone LLM; it is a control and analysis framework around local or hybrid inference.

## What It Does
1. Routes queries by complexity and domain.
2. Runs specialized reasoning engines (statistical, causal, Bayesian, meta-analysis).
3. Captures activation geometry (TDA) for local models when enabled.
4. Computes concept-chord signals, dissonance, entropy, and a focus plan.
5. Logs telemetry to JSONL and renders a live dashboard.
6. Optionally runs a meta-analyzer pass that surfaces blind spots and missing checks.

## Why It Matters (Research Use)
The system turns normally opaque model behavior into analyzable signals. This enables:
- Correlating internal signals with answer quality or critique severity.
- Studying stability/entropy in activations across prompts.
- Testing intervention mechanisms (focus controller) under controlled metrics.
- Building reproducible datasets of reasoning traces + telemetry for later modeling.

## Dashboard Panels (What You’re Seeing)

**Learned Skills**  
Shows which learned skills were injected into the current prompt (if enabled).  
Research value: makes retrieval augmentation explicit and auditable.

**Homeostasis Meter**  
Visualizes a “health” score derived from entropy + dissonance.  
Research value: acts as a proxy for internal coherence vs instability.

**Master Chord**  
Displays concept frequencies derived from a Leibnizian chord model.  
Research value: shows which conceptual harmonics are activated by a query.

**Entropy Oscilloscope**  
Animated noise signal proportional to entropy score.  
Research value: quick visual cue of activation complexity / chaos.

**Meta-Analyzer Pass (behind the scenes)**  
Triggered for high-complexity queries (configurable threshold).  
Research value: forces explicit checks for confounds, heterogeneity, priors, and risk mitigation.

**Continued Fraction Spiral**  
Represents the focus controller’s planned depth (entropy valve).  
Research value: reveals how the controller modulates compute based on signals.

**Topological Mapper**  
Renders point clouds + topology edges from activation TDA.  
Research value: interpretable view of activation manifold structure.

**Leibnizian Spectrogram**  
Time‑stacked view of concept chord activity.  
Research value: shows how conceptual harmonics shift across queries.

## Reset State (What It Does)
The “Reset State” button clears the visualization’s local history buffers only.
It does NOT delete telemetry logs or learned knowledge.

## Telemetry Outputs
- JSONL stream: `data/telemetry/events.jsonl`
- Used for correlation, drift, and predictive baselines in `evaluation/`.

## Future‑Proofing
The framework is modular. You can replace the LLM with your own model later, and keep:
- Telemetry, signal pipeline, and dashboard
- Reasoning orchestration and evaluation scripts
- Learned-knowledge retrieval as a switchable layer
- Concept-depth triage + meta-analyzer for research-grade auditability
