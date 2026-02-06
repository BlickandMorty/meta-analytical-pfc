"""Pattern detector — clusters executive traces to identify learnable skills."""

from typing import Dict, List
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import DBSCAN
import numpy as np

from src.learning.executive_trace import ExecutiveTrace


class PatternDetector:
    """Clusters similar problem traces via TF-IDF + DBSCAN to surface skill gaps."""

    def __init__(self, min_cluster_size: int = 3, eps: float = 0.5):
        self.min_cluster_size = min_cluster_size
        self.eps = eps

    def detect_patterns(self, traces: List[ExecutiveTrace]) -> Dict:
        if len(traces) < self.min_cluster_size:
            return {"patterns": [], "total_traces": len(traces), "skill_gaps": []}

        queries = [t.query for t in traces]
        vectors = TfidfVectorizer(max_features=100, stop_words="english").fit_transform(queries)
        labels = DBSCAN(eps=self.eps, min_samples=self.min_cluster_size).fit_predict(vectors.toarray())

        clusters: Dict[int, List[ExecutiveTrace]] = {}
        for i, label in enumerate(labels):
            if label != -1:
                clusters.setdefault(label, []).append(traces[i])

        patterns = []
        for cluster_id, cluster in clusters.items():
            domains = [t.domain for t in cluster]
            avg_conf = float(np.mean([t.confidence for t in cluster]))
            patterns.append({
                "cluster_id": cluster_id,
                "size": len(cluster),
                "domain": max(set(domains), key=domains.count),
                "avg_confidence": avg_conf,
                "examples": [t.query for t in cluster[:3]],
                "skill_name": self._skill_name(cluster[0].query),
            })
        patterns.sort(key=lambda p: p["size"], reverse=True)

        skill_gaps = [
            {
                "pattern": p["skill_name"],
                "size": p["size"],
                "confidence": p["avg_confidence"],
                "priority": self._priority(p),
            }
            for p in patterns
            if p["avg_confidence"] < 0.85
        ]

        return {
            "patterns": patterns,
            "total_traces": len(traces),
            "skill_gaps": skill_gaps,
            "unique_clusters": len(clusters),
        }

    @staticmethod
    def _skill_name(query: str) -> str:
        words = query.lower().split()[:3]
        name = "_".join(words)
        return "".join(c for c in name if c.isalnum() or c == "_") or "general_reasoning"

    @staticmethod
    def _priority(pattern: Dict) -> float:
        size_score = min(pattern["size"] / 10, 1.0)
        gap = 1.0 - pattern["avg_confidence"]
        return float(size_score * gap)
