"""Ablation: compare critique severity with valve on vs off."""

import argparse
import numpy as np
from evaluation._metrics_utils import load_events


def main():
    parser = argparse.ArgumentParser(description="Focus valve ablation")
    parser.add_argument("--path", default="data/telemetry/events.jsonl")
    parser.add_argument("--stage", default="final")
    args = parser.parse_args()

    events = load_events(args.path, stage=args.stage)
    if not events:
        print("No telemetry events found")
        return

    valve_on = [e for e in events if e.get("focus", {}).get("valve_enabled") is True]
    valve_off = [e for e in events if e.get("focus", {}).get("valve_enabled") is False]

    def avg(xs):
        return float(np.mean(xs)) if xs else 0.0

    def extract(events):
        return [e.get("metrics", {}).get("critique_severity", 0.0) for e in events]

    on_vals = extract(valve_on)
    off_vals = extract(valve_off)

    print("Valve ON: n=", len(on_vals), "avg critique", avg(on_vals))
    print("Valve OFF: n=", len(off_vals), "avg critique", avg(off_vals))


if __name__ == "__main__":
    main()
