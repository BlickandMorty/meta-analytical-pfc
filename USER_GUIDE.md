# Meta-Analytical PFC — User Guide

This is the practical, low-friction guide for running and using the system.

## Run (one command)
```powershell
.\run_pfc.ps1
```
This launches the dashboard, opens your browser, and starts the assistant prompt in the same terminal.

## Where to type questions
In the terminal that shows:
```
Meta-Analytical PFC ready. Type 'exit' to quit.

QUERY:
```

## Interactive commands (terminal)
- `:learn`  
  Forces a learning cycle from existing executive traces (no waiting on thresholds).

- `:skills`  
  Lists learned skills stored in `data/learned_knowledge/knowledge_base.json`.

- `exit` / `quit` / `q`  
  Stops the assistant.

## Smoke test (non-interactive)
```powershell
python scripts\smoke_test.py
```
This runs a single query, verifies telemetry append, and prints PASS/FAIL.

## Full end-to-end test (slow)
```powershell
python scripts\full_test.py
```
This runs a real query through the model, verifies telemetry, and prints PASS/FAIL.

## Dashboard
Open `http://localhost:8000` (opened automatically by `run_pfc.ps1`).

If the dashboard looks stale, you can also open:
```
http://localhost:8000/replay
```
This shows the raw telemetry stream.

## Learning (optional)
To inject learned skills into prompts, enable this in `config/model_config.yaml`:
```yaml
learning:
  use_retrieval: true
```
When enabled, the top 1–3 learned skills are prepended to prompts.

## Feature toggles (short)
- `config/telemetry.yaml`  
  `telemetry.enabled` and `focus_control.enabled` control logging and the focus controller.
- `config/local_model.yaml`  
  `activation_capture.enabled` and `skip_for_simple` control TDA activation capture.
- `config/runtime.yaml`  
  `inference_mode` selects `local` vs `hybrid`, and `local_generation.*` controls the local model.
- `config/model_config.yaml`  
  `triage.concept_depth.*` and `triage.meta_analyzer.*` control concept‑driven complexity and the extra meta‑analyzer pass.

## Key config files (short)
- `config/runtime.yaml`  
  Local vs hybrid inference and local model settings.
- `config/model_config.yaml`  
  High-level behavior, learning settings, thresholds, and paths.
- `config/local_model.yaml`  
  Activation capture settings (TDA, skip for simple queries, etc.).
- `config/telemetry.yaml`  
  Telemetry logging and focus controller parameters.
- `config/concepts.yaml`  
  Concept chords, dissonance rules, harmonic base.
- `config/cae.yaml`  
  Safety state machine configuration (CAE).

## Files you may care about
- `data/telemetry/events.jsonl` — live telemetry stream
- `data/learned_knowledge/knowledge_base.json` — learned skills store

## Reset State (dashboard)
The “Reset State” button only resets the visual history in the dashboard.
It does NOT delete learned skills, memory, or telemetry logs.
