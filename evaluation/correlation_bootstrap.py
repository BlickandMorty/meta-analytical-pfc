"""Correlation analysis with bootstrap confidence intervals."""

import argparse
from evaluation._metrics_utils import load_events, pearson, spearman, bootstrap_ci


def main():
    parser = argparse.ArgumentParser(description="Correlation + bootstrap CI")
    parser.add_argument("--path", default="data/telemetry/events.jsonl")
    parser.add_argument("--stage", default="final")
    parser.add_argument("--n-boot", type=int, default=1000)
    args = parser.parse_args()

    events = load_events(args.path, stage=args.stage)
    if not events:
        print("No telemetry events found")
        return

    entropy = []
    health = []
    dissonance = []
    critique = []
    betti1 = []
    persistence = []

    for event in events:
        metrics = event.get("metrics", {})
        tda = event.get("tda", {})
        entropy.append(metrics.get("entropy_score", 0.0))
        health.append(metrics.get("health_score", 0.0))
        dissonance.append(metrics.get("dissonance_score", 0.0))
        critique.append(metrics.get("critique_severity", 0.0))
        betti1.append(tda.get("betti_1", 0.0))
        persistence.append(tda.get("persistence_entropy", 0.0))

    def corr_report(name, x, y):
        r = pearson(x, y)
        s = spearman(x, y)
        r_stat, r_ci = bootstrap_ci(list(zip(x, y)), lambda pairs: pearson([p[0] for p in pairs], [p[1] for p in pairs]), n_boot=args.n_boot)
        s_stat, s_ci = bootstrap_ci(list(zip(x, y)), lambda pairs: spearman([p[0] for p in pairs], [p[1] for p in pairs]), n_boot=args.n_boot)
        print(f"{name} Pearson r={r:.3f} (boot {r_stat:.3f}, CI {r_ci[0]:.3f}-{r_ci[1]:.3f})")
        print(f"{name} Spearman ρ={s:.3f} (boot {s_stat:.3f}, CI {s_ci[0]:.3f}-{s_ci[1]:.3f})")

    corr_report("entropy vs critique", entropy, critique)
    corr_report("persistence_entropy vs critique", persistence, critique)
    corr_report("betti1 vs critique", betti1, critique)
    corr_report("entropy vs health", entropy, health)
    corr_report("dissonance vs health", dissonance, health)


if __name__ == "__main__":
    main()
