# Feedback Loop (Scaffold)

This document defines the feedback loop that can make a model improve itself using the signals already computed in this project (TDA, chord dissonance, entropy valve, CAE).

## Goal
Convert telemetry signals into a training signal so a future model can *learn* to reduce instability and dissonance.

## What exists now
- `src/learning/feedback_loop.py` collects and stores samples in `data/feedback/buffer.jsonl`.
- It computes reward/penalty based on:
  - critique severity
  - dissonance score
  - entropy score

## What still needs to be implemented
1. **Dataset builder**
   - Read `buffer.jsonl`
   - Convert reward/penalty into training pairs (e.g., preference format)
   - Save dataset to `data/feedback/dataset.jsonl`

2. **Fine‑tuning step**
   - Load model core (Beaba or a baseline)
   - Apply LoRA or full finetune
   - Save updated weights

3. **Scheduler**
   - Decide when to finetune (every N samples, or when penalty rate rises)

4. **Integration point**
   - After a response is generated, call `FeedbackLoop.evaluate()`
   - Store samples for later fine‑tuning

## Proposed flow
1. Run model inference
2. Compute signals (entropy, dissonance, critique)
3. If high penalty or good reward → store sample
4. Periodically build dataset and finetune

## Config
- `config/feedback.yaml` controls thresholds and storage

## Why this is useful
- Turns telemetry into *learning*
- Enables self‑improving models using your supervision stack

