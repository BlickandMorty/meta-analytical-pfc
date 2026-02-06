from src.monitoring.telemetry import build_event


def test_telemetry_event():
    event = build_event(
        query_id="123",
        stage="final",
        mode="executive",
        metrics={"health_score": 0.8},
        tda={},
        chord={},
        focus={},
    )
    payload = event.to_json()
    assert "health_score" in payload
