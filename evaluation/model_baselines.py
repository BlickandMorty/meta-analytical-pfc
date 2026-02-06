"""Compare TDA metrics across multiple baseline models."""

import argparse
from pathlib import Path
import csv
import numpy as np
import matplotlib.pyplot as plt
from src.utils.config_loader import ConfigLoader
from src.tda.activation_capture import ActivationCapture, ActivationCaptureConfig
from src.tda.tda_pipeline import compute_tda


def load_prompts(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def main():
    parser = argparse.ArgumentParser(description="Baseline model comparison")
    parser.add_argument("--config", default="baselines.yaml")
    parser.add_argument("--prompts", default="data/prompts.txt")
    parser.add_argument("--out", default="reports/model_baselines.csv")
    parser.add_argument("--plot", default="reports/plots/model_baselines.png")
    args = parser.parse_args()

    loader = ConfigLoader()
    cfg = loader.load_yaml(args.config, default={})
    baselines = cfg.get("baselines", [])
    if not baselines:
        print("No baselines configured")
        return

    prompts = load_prompts(args.prompts)
    if not prompts:
        print("No prompts found")
        return

    rows = []
    for base in baselines:
        cap_cfg = ActivationCaptureConfig(
            model_name=base.get("model_name"),
            revision=base.get("revision", "main"),
            device=base.get("device", "cuda"),
            dtype=base.get("dtype", "float16"),
            load_in_4bit=bool(base.get("load_in_4bit", True)),
            max_new_tokens=32,
            max_input_tokens=256,
            capture_layers=[-1, -2, -3, -4],
            capture_tokens=32,
        )
        cap = ActivationCapture(cap_cfg)

        entropies = []
        betti1 = []
        for prompt in prompts:
            trace = cap.capture(prompt)
            if not trace:
                continue
            tda = compute_tda({k: v.numpy() for k, v in trace.activations.items()})
            if not tda:
                continue
            entropies.append(tda.persistence_entropy)
            betti1.append(tda.betti_1)

        row = {
            "name": base.get("name"),
            "model": base.get("model_name"),
            "avg_entropy": float(np.mean(entropies)) if entropies else 0.0,
            "avg_betti1": float(np.mean(betti1)) if betti1 else 0.0,
        }
        rows.append(row)
        print(row)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "model", "avg_entropy", "avg_betti1"])
        writer.writeheader()
        writer.writerows(rows)

    # Plot
    plot_path = Path(args.plot)
    plot_path.parent.mkdir(parents=True, exist_ok=True)
    labels = [r["name"] for r in rows]
    values = [r["avg_entropy"] for r in rows]
    plt.figure(figsize=(6, 4))
    plt.bar(labels, values, color="#64ffda")
    plt.title("Baseline Comparison: Avg Persistence Entropy")
    plt.ylabel("Avg Persistence Entropy")
    plt.tight_layout()
    plt.savefig(plot_path, dpi=150)
    plt.close()

    print(f"Wrote {out_path} and {plot_path}")


if __name__ == "__main__":
    main()
