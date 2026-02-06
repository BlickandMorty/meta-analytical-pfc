"""Run TDA across Pythia checkpoints to study topology drift."""

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
    parser = argparse.ArgumentParser(description="Pythia topology drift")
    parser.add_argument("--config", default="pythia_checkpoints.yaml")
    parser.add_argument("--out", default="reports/pythia_drift.csv")
    parser.add_argument("--plot", default="reports/plots/pythia_drift.png")
    args = parser.parse_args()

    loader = ConfigLoader()
    cfg = loader.load_yaml(args.config, default={})
    checkpoints = cfg.get("checkpoints", [])
    prompts_path = cfg.get("study", {}).get("prompts_path", "data/prompts.txt")

    prompts = load_prompts(prompts_path)
    if not prompts:
        print("No prompts found")
        return

    rows = []
    for group in checkpoints:
        model_name = group.get("model_name")
        revisions = group.get("revisions", [])
        if not revisions:
            print(f"No revisions for {model_name}, skipping")
            continue

        for rev in revisions:
            cap_cfg = ActivationCaptureConfig(
                model_name=model_name,
                revision=rev.get("name"),
                device=group.get("device", "cuda"),
                dtype=group.get("dtype", "float16"),
                load_in_4bit=bool(group.get("load_in_4bit", False)),
                max_new_tokens=16,
                max_input_tokens=256,
                capture_layers=[-1, -2],
                capture_tokens=16,
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
                "model": model_name,
                "revision": rev.get("name"),
                "step": rev.get("step", 0),
                "avg_entropy": float(np.mean(entropies)) if entropies else 0.0,
                "avg_betti1": float(np.mean(betti1)) if betti1 else 0.0,
            }
            rows.append(row)
            print(row)

    if not rows:
        print("No drift rows produced")
        return

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["model", "revision", "step", "avg_entropy", "avg_betti1"])
        writer.writeheader()
        writer.writerows(rows)

    # Plot entropy over steps
    rows_sorted = sorted(rows, key=lambda r: r["step"])
    steps = [r["step"] for r in rows_sorted]
    entropies = [r["avg_entropy"] for r in rows_sorted]

    plot_path = Path(args.plot)
    plot_path.parent.mkdir(parents=True, exist_ok=True)
    plt.figure(figsize=(6, 4))
    plt.plot(steps, entropies, marker="o")
    plt.title("Pythia Topology Drift (Avg Persistence Entropy)")
    plt.xlabel("Step")
    plt.ylabel("Avg Persistence Entropy")
    plt.tight_layout()
    plt.savefig(plot_path, dpi=150)
    plt.close()

    print(f"Wrote {out_path} and {plot_path}")


if __name__ == "__main__":
    main()
