"""Shared utilities for evaluation scripts."""

import json
from pathlib import Path
import numpy as np


def load_events(path: str, stage: str = "final"):
    path = Path(path)
    if not path.exists():
        return []
    events = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            event = json.loads(line)
            if stage and event.get("stage") != stage:
                continue
            events.append(event)
    return events


def bootstrap_ci(values, func, n_boot: int = 1000, alpha: float = 0.05, seed: int = 42):
    rng = np.random.default_rng(seed)
    values = np.array(values)
    if len(values) == 0:
        return 0.0, (0.0, 0.0)
    stats = []
    for _ in range(n_boot):
        sample = rng.choice(values, size=len(values), replace=True)
        stats.append(func(sample))
    stats = np.array(stats)
    lower = float(np.percentile(stats, 100 * alpha / 2))
    upper = float(np.percentile(stats, 100 * (1 - alpha / 2)))
    return float(func(values)), (lower, upper)


def pearson(x, y):
    x = np.array(x, dtype=float)
    y = np.array(y, dtype=float)
    if len(x) < 2 or x.std() == 0 or y.std() == 0:
        return 0.0
    return float(np.corrcoef(x, y)[0, 1])


def spearman(x, y):
    x = np.array(x, dtype=float)
    y = np.array(y, dtype=float)
    if len(x) < 2:
        return 0.0
    rx = np.argsort(np.argsort(x))
    ry = np.argsort(np.argsort(y))
    return pearson(rx, ry)
