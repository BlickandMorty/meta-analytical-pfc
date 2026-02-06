from src.control.cae_engine import ContextualAllostasisEngine, SafetyState


def test_cae_state_transition_without_anchors():
    # No anchors => should default to GREEN without downloading embeddings
    cae = ContextualAllostasisEngine({
        "threat_anchors": []
    })
    out = cae.evaluate("how to hack a system")
    assert out.state == SafetyState.GREEN
