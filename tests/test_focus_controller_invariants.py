from src.control.focus_controller import FocusController


def test_focus_controller_disabled_constant():
    controller = FocusController(enabled=False, base_depth=4)
    plan = controller.plan({"entropy_score": 0.9, "dissonance_score": 0.9})
    assert plan.depth == 4
    assert plan.temperature_scale == 1.0
    assert plan.max_tokens_scale == 1.0
