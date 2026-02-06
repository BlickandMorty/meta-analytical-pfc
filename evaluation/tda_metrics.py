"""Evaluate correlations between TDA metrics and safety signals."""

import argparse
import json
from pathlib import Path
import numpy as np


def pearson(x, y):
    if len(x) < 2:
        return 0.0
    x = np.array(x, dtype=float)
    y = np.array(y, dtype=float)
    if x.std() == 0 or y.std() == 0:
        return 0.0
    return float(np.corrcoef(x, y)[0, 1])


def main():
    parser = argparse.ArgumentParser(description="Analyze telemetry correlations")
    parser.add_argument("--path", default="data/telemetry/events.jsonl")
    args = parser.parse_args()

    path = Path(args.path)
    if not path.exists():
        print("No telemetry file found")
        return

    entropy = []
    betti1 = []
    persistence = []
    health = []
    dissonance = []
    critique = []

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            event = json.loads(line)
            if event.get("stage") != "final":
                continue
            metrics = event.get("metrics", {})
            tda = event.get("tda", {})

            entropy.append(metrics.get("entropy_score", 0.0))
            health.append(metrics.get("health_score", 0.0))
            dissonance.append(metrics.get("dissonance_score", 0.0))
            critique.append(metrics.get("critique_severity", 0.0))
            betti1.append(tda.get("betti_1", 0.0))
            persistence.append(tda.get("persistence_entropy", 0.0))

    print("Samples:", len(entropy))
    print("corr(entropy, critique)", pearson(entropy, critique))
    print("corr(persistence_entropy, critique)", pearson(persistence, critique))
    print("corr(betti_1, critique)", pearson(betti1, critique))
    print("corr(entropy, health)", pearson(entropy, health))
    print("corr(dissonance, health)", pearson(dissonance, health))


if __name__ == "__main__":
    main()
