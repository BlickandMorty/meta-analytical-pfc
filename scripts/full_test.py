"""
Full end-to-end test: run a real query through AdaptivePFC,
verify telemetry append, print PASS/FAIL.

Usage:
  python scripts/full_test.py
  python scripts/full_test.py --query "your question"
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

from src.core.adaptive_pfc import AdaptivePFC
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
    parser = argparse.ArgumentParser(description="Full end-to-end PFC test")
    parser.add_argument("--query", default="Full test: does the PFC answer and log telemetry?")
    args = parser.parse_args()

    # Force local mode unless explicitly overridden
    os.environ.setdefault("PFC_INFERENCE_MODE", "local")

    cfg = ConfigLoader().load_yaml("telemetry.yaml", default={})
    telemetry_cfg = cfg.get("telemetry", {})
    telemetry_path = Path(telemetry_cfg.get("jsonl_path", "data/telemetry/events.jsonl"))

    before = count_lines(telemetry_path)

    try:
        pfc = AdaptivePFC()
        result = pfc.process(args.query)
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

    print("PASS: full end-to-end test completed")
    print(f"Confidence: {getattr(result, 'confidence', None)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
