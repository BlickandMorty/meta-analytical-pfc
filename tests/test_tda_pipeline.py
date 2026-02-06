import numpy as np
from src.tda.tda_pipeline import compute_tda


def test_tda_pipeline():
    activations = {
        0: np.random.randn(10, 8),
        1: np.random.randn(12, 8),
    }
    result = compute_tda(activations, max_points=32)
    assert result is not None
    assert result.betti_0 >= 0
