"""Core PFC components: engine, triage, memory, adaptive control."""

__all__ = [
    "AdaptivePFC",
    "MetaAnalyticalPFC",
    "ComplexityTriage",
    "CrossChatMemory",
]


def __getattr__(name):
    if name == "AdaptivePFC":
        from .adaptive_pfc import AdaptivePFC
        return AdaptivePFC
    if name == "MetaAnalyticalPFC":
        from .pfc_engine import MetaAnalyticalPFC
        return MetaAnalyticalPFC
    if name == "ComplexityTriage":
        from .triage import ComplexityTriage
        return ComplexityTriage
    if name == "CrossChatMemory":
        from .memory import CrossChatMemory
        return CrossChatMemory
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
