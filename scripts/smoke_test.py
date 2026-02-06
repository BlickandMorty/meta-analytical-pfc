"""
Smoke test: run a query, verify telemetry append, print PASS/FAIL.

Usage:
  python scripts/smoke_test.py
  python scripts/smoke_test.py --query "your question"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Ensure repo root on path for "src" imports
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.monitoring.concepts import ConceptRegistry
from src.monitoring.signals import compute_signals
from src.monitoring.telemetry import TelemetryLogger, build_event
from src.utils.config_loader import ConfigLoader


def count_lines(path: Path) -> int:
    if not path.exists():
        return 0
    with open(path, "r", encoding="utf-8") as f:
        return sum(1 for _ in f)


def read_last_line(path: Path) -> str | None:
    if not path.exists():
        return None
    with open(path, "rb") as f:
        f.seek(0, 2)
        size = f.tell()
        if size == 0:
            return None
        chunk = min(size, 8192)
        f.seek(-chunk, 2)
        data = f.read().decode("utf-8", errors="ignore")
    lines = [line for line in data.splitlines() if line.strip()]
    return lines[-1] if lines else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test for PFC + telemetry")
    parser.add_argument("--query", default="Smoke test: does telemetry update?")
    args = parser.parse_args()

    cfg = ConfigLoader().load_yaml("telemetry.yaml", default={})
    telemetry_cfg = cfg.get("telemetry", {})
    telemetry_path = Path(telemetry_cfg.get("jsonl_path", "data/telemetry/events.jsonl"))

    before = count_lines(telemetry_path)

    try:
        # Lightweight: emit a telemetry event without loading models
        concept_registry = ConceptRegistry()
        focus_cfg = cfg.get("focus_control", {})
        from src.control.focus_controller import FocusController
        focus_controller = FocusController(**focus_cfg)
        signals = compute_signals(
            query=args.query,
            reasoning_trace={},
            tda_result=None,
            concept_registry=concept_registry,
            focus_controller=focus_controller,
            health_floor=cfg.get("health", {}).get("health_floor", 0.2),
        )
        event = build_event(
            query_id="smoke_test",
            stage="smoke",
            mode="smoke",
            metrics={
                "entropy_score": signals.entropy_score,
                "dissonance_score": signals.dissonance_score,
                "health_score": signals.health_score,
                "harmony_key_distance": signals.harmony_key_distance,
            },
            tda={},
            chord={
                "product": signals.chord_product,
                "frequencies": signals.chord_frequencies,
                "concepts": signals.concepts,
                "dissonance_events": signals.dissonance_events,
            },
            focus={
                "depth": signals.focus_plan.depth,
                "temperature_scale": signals.focus_plan.temperature_scale,
                "max_tokens_scale": signals.focus_plan.max_tokens_scale,
                "reason": signals.focus_plan.reason,
                "valve_enabled": focus_controller.enabled,
            },
            notes="smoke_test_event",
        )
        logger = TelemetryLogger(
            path=telemetry_cfg.get("jsonl_path", "data/telemetry/events.jsonl"),
            flush_immediately=telemetry_cfg.get("flush_immediately", True),
        )
        logger.emit(event)
    except Exception as e:
        print(f"FAIL: exception during process: {e}")
        return 1

    after = count_lines(telemetry_path)
    last_line = read_last_line(telemetry_path)

    if after <= before or not last_line:
        print("FAIL: telemetry did not append")
        return 1

    try:
        json.loads(last_line)
    except Exception as e:
        print(f"FAIL: last telemetry line not valid JSON: {e}")
        return 1

    print("PASS: telemetry appended (lightweight smoke test)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
