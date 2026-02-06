"""Generate a summary report with plots in reports/."""

import argparse
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import roc_curve, roc_auc_score
from sklearn.linear_model import LogisticRegression

from evaluation._metrics_utils import load_events, pearson, spearman


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def scatter_plot(x, y, title, xlabel, ylabel, out_path: Path):
    plt.figure(figsize=(5, 4))
    plt.scatter(x, y, s=14, alpha=0.7)
    if len(x) > 1:
        coeffs = np.polyfit(x, y, 1)
        xs = np.linspace(min(x), max(x), 100)
        ys = coeffs[0] * xs + coeffs[1]
        plt.plot(xs, ys, color="#ff6b6b", linewidth=1.5)
    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel(ylabel)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()


def bar_plot(labels, values, title, ylabel, out_path: Path):
    plt.figure(figsize=(5, 4))
    plt.bar(labels, values, color=["#64ffda", "#ff6b6b"])
    plt.title(title)
    plt.ylabel(ylabel)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()


def build_features(events, use_tda=True):
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
        y.append(1 if metrics.get("critique_severity", 0.0) >= 0.5 else 0)
    return np.array(X), np.array(y)


def update_readme_results(metrics: dict):
    readme = Path("README.md")
    if not readme.exists():
        return
    content = readme.read_text(encoding="utf-8")

    start = "<!-- RESULTS_TABLE_START -->"
    end = "<!-- RESULTS_TABLE_END -->"
    if start not in content or end not in content:
        return

    table = (
        "| Metric | Description | Value |\n"
        "| --- | --- | --- |\n"
        f"| `entropy vs critique` | Correlation between TDA entropy and critique severity | {metrics['entropy_vs_critique']:.3f} |\n"
        f"| `betti‑1 vs critique` | Topology complexity vs critique severity | {metrics['betti_vs_critique']:.3f} |\n"
        f"| `AUROC (real TDA)` | Predictive baseline using TDA + chord features | {metrics['auroc_real']:.3f} |\n"
    )

    pre, _ = content.split(start, 1)
    _, post = content.split(end, 1)
    new_content = pre + start + "\n" + table + end + post
    readme.write_text(new_content, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Generate summary report")
    parser.add_argument("--path", default="data/telemetry/events.jsonl")
    parser.add_argument("--out", default="reports/summary.md")
    parser.add_argument("--plots", default="reports/plots")
    parser.add_argument("--stage", default="final")
    args = parser.parse_args()

    events = load_events(args.path, stage=args.stage)
    if not events:
        print("No telemetry events found")
        return

    out_path = Path(args.out)
    plots_dir = Path(args.plots)
    ensure_dir(out_path.parent)
    ensure_dir(plots_dir)

    entropy = [e.get("metrics", {}).get("entropy_score", 0.0) for e in events]
    health = [e.get("metrics", {}).get("health_score", 0.0) for e in events]
    dissonance = [e.get("metrics", {}).get("dissonance_score", 0.0) for e in events]
    critique = [e.get("metrics", {}).get("critique_severity", 0.0) for e in events]
    betti1 = [e.get("tda", {}).get("betti_1", 0.0) for e in events]
    persistence = [e.get("tda", {}).get("persistence_entropy", 0.0) for e in events]

    # Correlation stats
    corr_entropy_crit = pearson(entropy, critique)
    corr_persist_crit = pearson(persistence, critique)
    corr_betti_crit = pearson(betti1, critique)
    corr_entropy_health = pearson(entropy, health)
    corr_diss_health = pearson(dissonance, health)

    # Plots
    scatter_plot(entropy, critique, "Entropy vs Critique Severity", "Entropy", "Critique", plots_dir / "entropy_vs_critique.png")
    scatter_plot(persistence, critique, "Persistence Entropy vs Critique", "Persistence Entropy", "Critique", plots_dir / "persistence_vs_critique.png")
    scatter_plot(betti1, critique, "Betti-1 vs Critique", "Betti-1", "Critique", plots_dir / "betti1_vs_critique.png")

    # Predictive model ROC
    X, y = build_features(events, use_tda=True)
    if len(set(y)) >= 2:
        model = LogisticRegression(max_iter=200)
        model.fit(X, y)
        probs = model.predict_proba(X)[:, 1]
        auc = roc_auc_score(y, probs)
        fpr, tpr, _ = roc_curve(y, probs)
        plt.figure(figsize=(5, 4))
        plt.plot(fpr, tpr, label=f"AUROC {auc:.2f}")
        plt.plot([0, 1], [0, 1], linestyle="--", color="gray")
        plt.title("Predictive Model ROC")
        plt.xlabel("False Positive Rate")
        plt.ylabel("True Positive Rate")
        plt.legend()
        plt.tight_layout()
        plt.savefig(plots_dir / "roc_curve.png", dpi=150)
        plt.close()
    else:
        auc = 0.0

    # Ablation
    X_proxy, y_proxy = build_features(events, use_tda=False)
    auc_proxy = auc
    auc_real = auc
    if len(set(y_proxy)) >= 2:
        model_proxy = LogisticRegression(max_iter=200)
        model_proxy.fit(X_proxy, y_proxy)
        probs_proxy = model_proxy.predict_proba(X_proxy)[:, 1]
        auc_proxy = roc_auc_score(y_proxy, probs_proxy)
        auc_real = auc

    bar_plot(["Proxy", "Real TDA"], [auc_proxy, auc_real], "Ablation AUROC", "AUROC", plots_dir / "ablation_auroc.png")

    # Intervention summary
    valve_on = [e for e in events if e.get("focus", {}).get("valve_enabled") is True]
    valve_off = [e for e in events if e.get("focus", {}).get("valve_enabled") is False]
    def avg(xs):
        return float(np.mean(xs)) if xs else 0.0

    on_health = avg([e.get("metrics", {}).get("health_score", 0.0) for e in valve_on])
    off_health = avg([e.get("metrics", {}).get("health_score", 0.0) for e in valve_off])
    on_critique = avg([e.get("metrics", {}).get("critique_severity", 0.0) for e in valve_on])
    off_critique = avg([e.get("metrics", {}).get("critique_severity", 0.0) for e in valve_off])
    bar_plot(["Valve On", "Valve Off"], [on_health, off_health], "Intervention: Health", "Health", plots_dir / "intervention_health.png")
    bar_plot(["Valve On", "Valve Off"], [on_critique, off_critique], "Intervention: Critique", "Critique Severity", plots_dir / "intervention_critique.png")

    report = "# Experiment Summary\n\n"
    report += f"Samples: {len(events)}\n\n"
    report += "## Correlations (Pearson)\n\n"
    report += f"- entropy vs critique: {corr_entropy_crit:.3f}\n"
    report += f"- persistence entropy vs critique: {corr_persist_crit:.3f}\n"
    report += f"- betti-1 vs critique: {corr_betti_crit:.3f}\n"
    report += f"- entropy vs health: {corr_entropy_health:.3f}\n"
    report += f"- dissonance vs health: {corr_diss_health:.3f}\n\n"

    report += "## Plots\n\n"
    report += "- ![Entropy vs Critique](plots/entropy_vs_critique.png)\n"
    report += "- ![Persistence vs Critique](plots/persistence_vs_critique.png)\n"
    report += "- ![Betti-1 vs Critique](plots/betti1_vs_critique.png)\n"
    report += "- ![ROC Curve](plots/roc_curve.png)\n"
    report += "- ![Ablation AUROC](plots/ablation_auroc.png)\n"
    report += "- ![Intervention Health](plots/intervention_health.png)\n"
    report += "- ![Intervention Critique](plots/intervention_critique.png)\n"

    out_path.write_text(report, encoding="utf-8")
    print(f"Wrote {out_path}")

    update_readme_results({
        "entropy_vs_critique": corr_entropy_crit,
        "betti_vs_critique": corr_betti_crit,
        "auroc_real": auc_real,
    })


if __name__ == "__main__":
    main()
