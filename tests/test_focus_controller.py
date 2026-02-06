from src.control.focus_controller import FocusController


def test_focus_plan_bounds():
    controller = FocusController(min_depth=2, max_depth=6, base_depth=3)
    plan = controller.plan({"entropy_score": 0.9, "dissonance_score": 0.8})
    assert 2 <= plan.depth <= 6
    assert 0.0 < plan.temperature_scale <= 1.0
