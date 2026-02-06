"""
TDA pipeline for activation point clouds.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import numpy as np
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from ripser import ripser


@dataclass
class TDAResult:
    betti_0: int
    betti_1: int
    persistence_entropy: float
    max_persistence: float
    point_cloud: List[List[float]]
    topology_graph: Dict


def build_point_cloud(activations: Dict[int, np.ndarray], max_points: int = 512) -> np.ndarray:
    # activations: layer -> tokens x hidden
    if not activations:
        return np.empty((0, 0))

    points = []
    for acts in activations.values():
        if acts is None:
            continue
        # acts shape: tokens x hidden
        points.append(acts)
    if not points:
        return np.empty((0, 0))

    cloud = np.concatenate(points, axis=0)

    # Downsample if too large
    if cloud.shape[0] > max_points:
        idx = np.random.choice(cloud.shape[0], size=max_points, replace=False)
        cloud = cloud[idx]

    return cloud


def reduce_dimensions(points: np.ndarray, n_components: int = 3) -> np.ndarray:
    if points.size == 0:
        return points
    pca = PCA(n_components=n_components, random_state=42)
    return pca.fit_transform(points)


def compute_persistence_entropy(diagrams: List[np.ndarray]) -> Tuple[float, float]:
    lifetimes = []
    for dgm in diagrams:
        if dgm.size == 0:
            continue
        for birth, death in dgm:
            if np.isinf(death):
                continue
            lifetime = max(0.0, death - birth)
            if lifetime > 0:
                lifetimes.append(lifetime)

    if not lifetimes:
        return 0.0, 0.0

    lifetimes = np.array(lifetimes)
    probs = lifetimes / lifetimes.sum()
    entropy = -np.sum(probs * np.log(probs + 1e-12))
    max_persistence = float(lifetimes.max())
    return float(entropy), max_persistence


def build_topology_graph(points_3d: np.ndarray, n_clusters: int = 8) -> Dict:
    if points_3d.size == 0:
        return {"nodes": [], "edges": []}

    n_clusters = min(n_clusters, len(points_3d))
    if n_clusters < 2:
        return {"nodes": [], "edges": []}

    kmeans = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
    labels = kmeans.fit_predict(points_3d)
    centers = kmeans.cluster_centers_

    nodes = []
    for i, center in enumerate(centers):
        size = int((labels == i).sum())
        nodes.append({
            "id": i,
            "x": float(center[0]),
            "y": float(center[1]),
            "z": float(center[2]),
            "size": size,
        })

    # Build edges based on centroid distance
    edges = []
    for i in range(len(centers)):
        for j in range(i + 1, len(centers)):
            dist = np.linalg.norm(centers[i] - centers[j])
            if dist < np.percentile(np.linalg.norm(centers - centers.mean(axis=0), axis=1), 75):
                edges.append({"source": i, "target": j, "weight": float(dist)})

    return {"nodes": nodes, "edges": edges}


def compute_tda(activations: Dict[int, np.ndarray], max_points: int = 512) -> Optional[TDAResult]:
    cloud = build_point_cloud(activations, max_points=max_points)
    if cloud.size == 0:
        return None

    points_3d = reduce_dimensions(cloud, n_components=3)

    diagrams = ripser(points_3d, maxdim=1)["dgms"]
    betti_0 = len(diagrams[0]) if len(diagrams) > 0 else 0
    betti_1 = len(diagrams[1]) if len(diagrams) > 1 else 0
    entropy, max_persistence = compute_persistence_entropy(diagrams)

    topology_graph = build_topology_graph(points_3d)

    # Downsample point cloud for visualization
    vis_points = points_3d
    if len(points_3d) > 256:
        idx = np.random.choice(len(points_3d), size=256, replace=False)
        vis_points = points_3d[idx]

    return TDAResult(
        betti_0=int(betti_0),
        betti_1=int(betti_1),
        persistence_entropy=float(entropy),
        max_persistence=float(max_persistence),
        point_cloud=vis_points.tolist(),
        topology_graph=topology_graph,
    )
