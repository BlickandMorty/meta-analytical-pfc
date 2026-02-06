"""
Shared core types to avoid circular imports.
"""

from enum import Enum


class ReasoningMode(Enum):
    """Reasoning pathway selection"""
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    META_ANALYTICAL = "meta_analytical"
    EXECUTIVE_OVERRIDE = "executive_override"
