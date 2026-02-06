from src.monitoring.concepts import ConceptRegistry


def test_concept_detection_and_chord():
    registry = ConceptRegistry("config/concepts.yaml")
    concepts = registry.detect_concepts("execute the plan with authorization and safety")
    assert "Execute" in concepts
    assert "Authorization" in concepts
    chord = registry.chord_product(concepts)
    assert chord > 1


def test_dissonance_requires():
    registry = ConceptRegistry("config/concepts.yaml")
    concepts = ["Execute"]
    score, events = registry.evaluate_dissonance(concepts)
    assert score > 0
    assert any("missing" in e.detail for e in events)


def test_dissonance_forbidden_pair():
    registry = ConceptRegistry("config/concepts.yaml")
    concepts = ["Deception", "Truth"]
    score, events = registry.evaluate_dissonance(concepts)
    assert score > 0
    assert any("conflicts" in e.detail for e in events)


def test_dissonance_empty():
    registry = ConceptRegistry("config/concepts.yaml")
    score, events = registry.evaluate_dissonance([])
    assert score == 0.0
