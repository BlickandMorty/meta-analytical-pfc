# Meta-Analytical PFC

A biomimetic cognitive architecture that wraps large language models in an executive reasoning system modeled on the human prefrontal cortex.

---

## What This Is

Modern LLMs are powerful pattern matchers trained on everything ever written. They can retrieve, they can generate, they can mimic expertise. What they cannot do is *reason about reasoning*. They don't know when they're uncertain. They don't know when two concepts they're combining are contradictory. They don't adjust how deeply they think based on how hard a problem is. They don't attack their own conclusions before presenting them.

The human prefrontal cortex does all of this. It triages complexity, modulates attention, detects dissonance, runs counterfactual simulations, and calibrates its confidence against the actual strength of its evidence. These aren't philosophical luxuries — they're the computational operations that separate a PubMed search from a differential diagnosis.

This project implements those operations as an explicit, inspectable orchestration layer around any LLM. Not trained into weights where they're opaque and unverifiable, but instrumented as mathematical modules that *govern* inference the way the PFC governs the neocortex.

The body is mechanistically perfect — a creation refined over 500 million years of optimization under the hardest loss function in existence: survival. The thesis here is simple: use that as the blueprint.

---

## Who This Is For

- **AI researchers** building systems that need to reason under uncertainty rather than hallucinate through it
- **Medical and clinical researchers** who need meta-analytical rigor — DerSimonian-Laird pooling, Bradford Hill scoring, publication bias detection — applied automatically
- **Neuroscience-minded engineers** interested in biomimetic cognitive architectures
- **Anyone tired of LLMs that express 0.95 confidence on claims they can't ground**

This is a research-grade tool. It's built for people who understand that the interesting problem in AI isn't making models bigger — it's making them *think better*.

---

## What It Does

A query enters the system and passes through a **ten-stage executive pipeline**:

1. **Triage** — scores complexity, routes to the right depth of analysis
2. **Memory** — retrieves semantically relevant context from a persistent ChromaDB store
3. **Pathway Routing** — simple, moderate, or full executive processing
4. **Statistical Analysis** — effect sizes (Cohen's d), power analysis, bias detection, MCID thresholds
5. **Causal Inference** — DAG construction, Bradford Hill criteria scoring, confounder identification
6. **Meta-Analysis** — DerSimonian-Laird random-effects pooling with heterogeneity quantification
7. **Bayesian Updating** — conjugate normal prior-to-posterior computation with prior sensitivity analysis
8. **Synthesis** — full evidential response generation
9. **Adversarial Review** — structured five-point red-team self-critique
10. **Confidence Calibration** — final uncertainty quantification starting from maximum ignorance

Running beneath the pipeline are three continuous monitoring systems:

- **Leibnizian Concept Harmonics** — prime-number encoding of concepts with dissonance detection (Fundamental Theorem of Arithmetic guarantees unique factorization of any concept combination)
- **Continued-Fraction Focus Controller** — an entropy valve that modulates temperature and depth in real time based on the complexity of the model's internal state
- **Contextual Allostasis Engine** — embedding-based threat detection with exponential smoothing and graded safety response (GREEN/YELLOW/RED), inspired by biological allostasis

Above the pipeline sits a **meta-learning loop**: executive traces are recorded, clustered via TF-IDF/DBSCAN, analyzed for skill gaps, and converted into training examples. The system teaches itself from its own reasoning history.

---

## The Mathematics

This isn't a wrapper with vibes. Every subsystem is formally defined:

| Component | Framework |
|---|---|
| Meta-Analysis | DerSimonian-Laird random-effects model with Egger's publication bias test |
| Bayesian Reasoning | Precision-weighted conjugate normal updating with Bayes factor interpretation |
| Causal Inference | DAGs (NetworkX) + Bradford Hill criteria composite scoring |
| Topological Analysis | Persistent homology via Ripser — Betti numbers, persistence entropy on activation manifolds |
| Focus Control | Continued fractions as nonlinear scaling functions for temperature and token depth |
| Concept Encoding | Leibnizian prime products with harmonic frequency dissonance rules |
| Safety | Cosine similarity threat anchors with exponential moving average smoothing |
| Confidence | Evidence-based calibration starting from 0.5 base, adjusted by statistical power, causal strength, and self-critique severity |
| Pattern Detection | TF-IDF vectorization + DBSCAN clustering for skill gap identification |
| Health Scoring | Weighted fusion of normalized entropy and combined dissonance |

Full mathematical treatment available in [`paper.md`](paper.md).

---

## Run

```sh
pip install -r requirements.txt
export ANTHROPIC_API_KEY="your-key"
python run_pfc.py
```

Windows quickstart:

```powershell
.\run_pfc.ps1
```

### Local-Only Mode

No API key? Run entirely on local models:

```yaml
# config/runtime.yaml
runtime:
  inference_mode: "local"
```

### Hybrid Mode

Use Anthropic for synthesis, local models for activation capture and TDA:

```yaml
runtime:
  inference_mode: "hybrid"
```

---

## Project Structure

```
src/
├── core/           # Executive orchestration (AdaptivePFC, PFC Engine, Memory)
├── reasoning/      # Statistical, causal, meta-analytical, Bayesian engines
├── control/        # Focus controller (continued fractions), CAE (safety)
├── monitoring/     # Telemetry, concept harmonics, signal computation
├── validation/     # Adversarial review, confidence calibration
├── learning/       # Executive traces, pattern detection, training generation
├── tda/            # Persistent homology pipeline, activation capture
├── models/         # Model orchestration (API + local with 4-bit quantization)
└── utils/          # Config loader, logging

config/             # All YAML configs (runtime, CAE thresholds, local model settings)
evaluation/         # Correlation analysis, ablation studies, benchmarks
data/               # Telemetry logs, memory, traces, training data
```

---

## Telemetry and Dashboard

Every inference is logged as structured JSONL telemetry — entropy, dissonance, Betti numbers, focus plans, safety states. A live FastAPI + WebSocket dashboard renders it in real time.

```sh
python run_dashboard.py
```

---

## Evaluation

```sh
python evaluation/tda_metrics.py --path data/telemetry/events.jsonl
python evaluation/correlation_bootstrap.py
python evaluation/predictive_model.py
python evaluation/report_summary.py
```

---

## Docs

- [`paper.md`](paper.md) — full academic paper on the architecture, mathematics, and implications
- [`PROJECT_SUMMARY.md`](PROJECT_SUMMARY.md) — architectural summary
- [`USER_GUIDE.md`](USER_GUIDE.md) — usage guide and commands
- [`RESEARCH_OVERVIEW.md`](RESEARCH_OVERVIEW.md) — research-grade explanation of signals and dashboard
- [`FEEDBACK_LOOP.md`](FEEDBACK_LOOP.md) — planned self-improvement loop

---

## The Point

We've been building AI wrong. Not in degree — not too few parameters, not too little data — but in *kind*. We've been building powerful engines without governors. The transformer is the neocortex. This project gives it a prefrontal cortex.

The art is in the complexity. And the complexity is already there — in the architecture that evolution spent 3.8 billion years refining. We just have to be willing to learn from it.

---

*Built by Jojo.*
*Paper and full mathematical treatment: [`paper.md`](paper.md)*
