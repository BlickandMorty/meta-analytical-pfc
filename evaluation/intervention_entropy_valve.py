"""Compare metrics with entropy valve enabled vs disabled."""

import argparse
import numpy as np
from evaluation._metrics_utils import load_events


def summarize(events):
    if not events:
        return {}
    entropy = [e.get("metrics", {}).get("entropy_score", 0.0) for e in events]
    dissonance = [e.get("metrics", {}).get("dissonance_score", 0.0) for e in events]
    critique = [e.get("metrics", {}).get("critique_severity", 0.0) for e in events]
    health = [e.get("metrics", {}).get("health_score", 0.0) for e in events]

    def avg(x):
        return float(np.mean(x)) if x else 0.0

    return {
        "n": len(events),
        "entropy": avg(entropy),
        "dissonance": avg(dissonance),
        "critique": avg(critique),
        "health": avg(health),
    }


def main():
    parser = argparse.ArgumentParser(description="Intervention study: entropy valve on/off")
    parser.add_argument("--path", default="data/telemetry/events.jsonl")
    parser.add_argument("--stage", default="final")
    args = parser.parse_args()

    events = load_events(args.path, stage=args.stage)
    if not events:
        print("No telemetry events found")
        return

    valve_on = [e for e in events if e.get("focus", {}).get("valve_enabled") is True]
    valve_off = [e for e in events if e.get("focus", {}).get("valve_enabled") is False]

    print("Entropy valve ON summary:", summarize(valve_on))
    print("Entropy valve OFF summary:", summarize(valve_off))


if __name__ == "__main__":
    main()
