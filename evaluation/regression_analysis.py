"""OLS + gradient descent regression on telemetry signals.

This script:
- fits OLS (closed form)
- fits GD (for educational parity)
- reports coefficients + bootstrap CIs
- suggests entropy valve weights from coefficients
"""

import argparse
import json
from pathlib import Path
import numpy as np
from evaluation._metrics_utils import load_events


def build_matrix(events):
    X = []
    y_crit = []
    y_health = []
    for event in events:
        metrics = event.get("metrics", {})
        tda = event.get("tda", {})
        features = [
            metrics.get("entropy_score", 0.0),
            metrics.get("dissonance_score", 0.0),
            metrics.get("harmony_key_distance", 0.0),
            tda.get("betti_1", 0.0),
            tda.get("persistence_entropy", 0.0),
        ]
        X.append([1.0] + features)  # intercept
        y_crit.append(metrics.get("critique_severity", 0.0))
        y_health.append(metrics.get("health_score", 0.0))
    return np.array(X), np.array(y_crit), np.array(y_health)


def ols_closed_form(X, y):
    # beta = (X^T X)^-1 X^T y
    xtx = X.T @ X
    xtx_inv = np.linalg.pinv(xtx)
    beta = xtx_inv @ X.T @ y
    return beta


def gd_fit(X, y, lr=0.05, steps=2000):
    beta = np.zeros(X.shape[1])
    n = len(y)
    for _ in range(steps):
        preds = X @ beta
        grad = (2 / n) * (X.T @ (preds - y))
        beta -= lr * grad
    return beta


def bootstrap_coefs(X, y, n_boot=500):
    rng = np.random.default_rng(42)
    coefs = []
    for _ in range(n_boot):
        idx = rng.choice(len(y), size=len(y), replace=True)
        beta = ols_closed_form(X[idx], y[idx])
        coefs.append(beta)
    coefs = np.array(coefs)
    return coefs


def summarize_coefs(names, beta, boot=None):
    rows = []
    for i, name in enumerate(names):
        if boot is None:
            rows.append((name, beta[i], None, None))
        else:
            lower = np.percentile(boot[:, i], 2.5)
            upper = np.percentile(boot[:, i], 97.5)
            rows.append((name, beta[i], lower, upper))
    return rows


def suggest_valve_weights(beta):
    # Use entropy + dissonance coefficients only
    # beta indices: 0 intercept, 1 entropy, 2 dissonance, ...
    ent = abs(beta[1])
    dis = abs(beta[2])
    total = ent + dis
    if total == 0:
        return 0.6, 0.4
    return ent / total, dis / total


def main():
    parser = argparse.ArgumentParser(description="OLS + GD regression analysis")
    parser.add_argument("--path", default="data/telemetry/events.jsonl")
    parser.add_argument("--stage", default="final")
    parser.add_argument("--out", default="reports/regression_report.json")
    args = parser.parse_args()

    events = load_events(args.path, stage=args.stage)
    if not events:
        print("No telemetry events found")
        return

    X, y_crit, y_health = build_matrix(events)
    names = ["intercept", "entropy", "dissonance", "harmony_distance", "betti1", "persistence_entropy"]

    beta_crit = ols_closed_form(X, y_crit)
    beta_health = ols_closed_form(X, y_health)

    beta_crit_gd = gd_fit(X, y_crit)
    beta_health_gd = gd_fit(X, y_health)

    boot_crit = bootstrap_coefs(X, y_crit)
    boot_health = bootstrap_coefs(X, y_health)

    valve_entropy, valve_dissonance = suggest_valve_weights(beta_crit)

    report = {
        "n_samples": len(events),
        "ols": {
            "critique": {"coefs": beta_crit.tolist()},
            "health": {"coefs": beta_health.tolist()},
        },
        "gd": {
            "critique": {"coefs": beta_crit_gd.tolist()},
            "health": {"coefs": beta_health_gd.tolist()},
        },
        "bootstrap_ci": {
            "critique": summarize_coefs(names, beta_crit, boot_crit),
            "health": summarize_coefs(names, beta_health, boot_health),
        },
        "valve_suggestion": {
            "entropy_weight": valve_entropy,
            "dissonance_weight": valve_dissonance,
        }
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
