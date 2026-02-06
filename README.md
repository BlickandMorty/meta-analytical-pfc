# meta-analytical pfc

this is a research assistant that mixes stats, causal reasoning, meta-analysis, and bayesian updating. it takes a question, runs multiple reasoning engines, and returns a structured answer.

## run

```sh
pip install -r requirements.txt
export ANTHROPIC_API_KEY="your-key"
python run_pfc.py
```

Windows one-command run (asks local vs hybrid, opens dashboard):

```powershell
.\run_pfc.ps1
```

## layout (short)

- `src/core/` = orchestration
- `src/reasoning/` = reasoning engines
- `src/learning/` = self-improvement
- `src/validation/` = QA checks

## notes

full logic in `PROJECT_SUMMARY.md`.

## telemetry + dashboard

- `run_pfc.py` = run the PFC with telemetry logging
- `run_dashboard.py` = live dashboard (websocket + replay)
- telemetry JSONL: `data/telemetry/events.jsonl`
- CAE safety state machine: `config/cae.yaml` + `src/control/cae_engine.py`

## local model (real TDA)

Set up a local open-weight model to capture activations and compute real TDA:

1. Install dependencies: `pip install -r requirements.txt`
2. Edit `config/local_model.yaml` (model name, 4-bit, layers)
3. Run the PFC + dashboard: `.\run_pfc.ps1`

Hybrid mode uses Anthropic for final answers and local activations for TDA.

## config system

All configs live in `config/` and are loaded via `src/utils/config_loader.py`.

## Feedback loop (scaffold)

See `FEEDBACK_LOOP.md` for the planned self‑improvement loop.

## Windows (RTX 4060) quickstart

```powershell
scripts\\setup_windows.ps1
python scripts\\download_model.py
.\run_pfc.ps1
```

## Docs

- `USER_GUIDE.md` — how to run, commands, and key configs
- `RESEARCH_OVERVIEW.md` — research‑grade explanation of the signals + dashboard
- `PROJECT_SUMMARY.md` — architectural summary

## Local‑only mode

If you don’t have an API key, switch to local‑only mode in `config/runtime.yaml`:

```yaml
runtime:
  inference_mode: "local"
```

Or just choose `local` when running `.\run_pfc.ps1`.

## Quick run

- `run_pfc.ps1` (prompts for mode, starts dashboard, opens browser, runs PFC)

## Methods (short)

This system instruments LLM inference and logs structured telemetry. The workflow is:

1. Capture local model activations for each prompt.
2. Compute TDA metrics on activation point clouds (Betti‑1, persistence entropy).
3. Compute Leibnizian chord signals from concept primes and evaluate dissonance.
4. Apply the continued‑fraction focus controller (entropy valve) to modulate compute.
5. Stream telemetry to JSONL and render live dashboard visuals.
6. Evaluate correlations and predictive baselines on logged telemetry.

## Results (snapshot)

<!-- RESULTS_TABLE_START -->
| Metric | Description | Value |
| --- | --- | --- |
| `entropy vs critique` | Correlation between TDA entropy and critique severity | -- |
| `betti‑1 vs critique` | Topology complexity vs critique severity | -- |
| `AUROC (real TDA)` | Predictive baseline using TDA + chord features | -- |
<!-- RESULTS_TABLE_END -->

Run `python evaluation/report_summary.py` to auto‑update the values.

## automation scripts

- `scripts/setup_windows.ps1` = create venv + install deps on Windows
- `scripts/download_model.py` = pre-download local model weights
- `run_pfc.ps1` = one-command launcher (local or hybrid)

## evaluation

Run the correlation analysis:

```sh
python evaluation/tda_metrics.py --path data/telemetry/events.jsonl
```

Additional experiments:

```sh
python evaluation/correlation_bootstrap.py
python evaluation/ablation_proxy_vs_real.py
python evaluation/predictive_model.py
python evaluation/intervention_entropy_valve.py
python evaluation/ablation_focus_valve.py
python evaluation/report_summary.py
python evaluation/model_baselines.py
python evaluation/pythia_topology_drift.py
python evaluation/inference_benchmark.py
python evaluation/regression_analysis.py
```

## CI + Docker

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Dockerfile: `Dockerfile`

Basic Docker run:

```sh
docker build -t pfc .
docker run --rm -p 8000:8000 pfc
```

Note: For GPU/local model inference, run on Windows with CUDA PyTorch and update `config/local_model.yaml`.
