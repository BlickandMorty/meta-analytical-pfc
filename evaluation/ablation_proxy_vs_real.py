"""Ablation study: proxy features vs real TDA features."""

import argparse
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from evaluation._metrics_utils import load_events


def build_features(events, use_tda: bool):
    X = []
    y = []
    for event in events:
        metrics = event.get("metrics", {})
        tda = event.get("tda", {})
        features = [
            metrics.get("entropy_score", 0.0),
            metrics.get("dissonance_score", 0.0),
            metrics.get("harmony_key_distance", 0.0),
        ]
        if use_tda:
            features.extend([
                tda.get("betti_1", 0.0),
                tda.get("persistence_entropy", 0.0),
                tda.get("max_persistence", 0.0),
            ])
        X.append(features)
        # target: high critique severity
        y.append(1 if metrics.get("critique_severity", 0.0) >= 0.5 else 0)

    return np.array(X), np.array(y)


def train_eval(X, y):
    if len(y) < 5 or len(set(y)) < 2:
        return 0.0
    model = LogisticRegression(max_iter=200)
    model.fit(X, y)
    probs = model.predict_proba(X)[:, 1]
    return roc_auc_score(y, probs)


def main():
    parser = argparse.ArgumentParser(description="Ablation: proxy vs real TDA")
    parser.add_argument("--path", default="data/telemetry/events.jsonl")
    parser.add_argument("--stage", default="final")
    args = parser.parse_args()

    events = load_events(args.path, stage=args.stage)
    if not events:
        print("No telemetry events found")
        return

    X_proxy, y = build_features(events, use_tda=False)
    X_real, _ = build_features(events, use_tda=True)

    auc_proxy = train_eval(X_proxy, y)
    auc_real = train_eval(X_real, y)

    print("Ablation results")
    print(f"Proxy features AUROC: {auc_proxy:.3f}")
    print(f"Real TDA features AUROC: {auc_real:.3f}")
    print(f"Delta AUROC (real - proxy): {auc_real - auc_proxy:.3f}")


if __name__ == "__main__":
    main()
