"""Run PFC for a set of prompts, then generate report + registry."""

import argparse
import json
import hashlib
from pathlib import Path
from datetime import datetime

from src.utils.config_loader import ConfigLoader
from src.core.adaptive_pfc import AdaptivePFC


def hash_configs(config_paths):
    sha = hashlib.sha256()
    for path in config_paths:
        p = Path(path)
        if not p.exists():
            continue
        sha.update(p.read_bytes())
    return sha.hexdigest()[:12]


def load_prompts(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def main():
    parser = argparse.ArgumentParser(description="Run experiment pipeline")
    parser.add_argument("--prompts", default="data/prompts.txt")
    parser.add_argument("--user-id", default="experiment")
    args = parser.parse_args()

    prompts_path = Path(args.prompts)
    if not prompts_path.exists():
        raise FileNotFoundError(f"Prompts not found: {prompts_path}")

    loader = ConfigLoader()
    local_cfg = loader.load_yaml("local_model.yaml", default={}).get("local_model", {})
    telemetry_cfg = loader.load_yaml("telemetry.yaml", default={})

    # Reset telemetry file
    telemetry_path = Path(telemetry_cfg.get("telemetry", {}).get("jsonl_path", "data/telemetry/events.jsonl"))
    telemetry_path.parent.mkdir(parents=True, exist_ok=True)
    telemetry_path.write_text("", encoding="utf-8")

    pfc = AdaptivePFC()
    prompts = load_prompts(args.prompts)

    for prompt in prompts:
        pfc.process(prompt, user_id=args.user_id)

    # Generate summary report
    from evaluation.report_summary import main as report_main
    report_main()

    # Registry entry
    registry_path = Path("reports/experiment_registry.jsonl")
    registry_path.parent.mkdir(parents=True, exist_ok=True)

    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "model": local_cfg.get("model_name"),
        "revision": local_cfg.get("revision"),
        "seed": local_cfg.get("seed"),
        "valve_enabled": telemetry_cfg.get("focus_control", {}).get("enabled", True),
        "telemetry_path": str(telemetry_path),
        "config_hash": hash_configs([
            "config/model_config.yaml",
            "config/local_model.yaml",
            "config/telemetry.yaml",
            "config/concepts.yaml",
            "config/cae.yaml",
        ]),
    }

    with open(registry_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

    print("Experiment complete. Summary + registry updated.")


if __name__ == "__main__":
    main()
