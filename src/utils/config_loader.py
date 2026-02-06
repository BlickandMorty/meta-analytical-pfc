"""Centralized config loader with environment variable expansion."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional
import os
import yaml


class ConfigLoader:
    def __init__(self, base_dir: str = "config"):
        self.base_dir = self._resolve_base_dir(base_dir)

    def _resolve_base_dir(self, base_dir: str) -> Path:
        base_path = Path(base_dir)
        if base_path.is_absolute():
            return base_path

        # Prefer current working directory if config exists there.
        cwd_candidate = Path.cwd() / base_dir
        if cwd_candidate.exists():
            return cwd_candidate

        # Fall back to resolving relative to this file's location.
        here = Path(__file__).resolve()
        for parent in [here] + list(here.parents):
            candidate = parent / base_dir
            if candidate.exists():
                return candidate

        # Last resort: return the cwd candidate (even if missing).
        return cwd_candidate

    def load_yaml(self, path: str, default: Optional[Dict] = None) -> Dict:
        if not path.endswith(".yaml") and not path.endswith(".yml"):
            path = f"{path}.yaml"

        file_path = Path(path)
        if not file_path.is_absolute():
            # If the caller already passed a path including the base dir,
            # don't prepend it again.
            if not file_path.exists():
                file_path = self.base_dir / path

        if not file_path.exists():
            return default or {}

        with open(file_path, "r") as f:
            data = yaml.safe_load(f) or {}

        return self._expand_env_vars(data)

    def _expand_env_vars(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {k: self._expand_env_vars(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._expand_env_vars(v) for v in value]
        if isinstance(value, str):
            return self._expand_env_var_str(value)
        return value

    def _expand_env_var_str(self, value: str) -> str:
        out = value
        while "${" in out:
            start = out.find("${")
            end = out.find("}", start)
            if start == -1 or end == -1:
                break
            key = out[start + 2:end]
            replacement = os.getenv(key, "")
            out = out[:start] + replacement + out[end + 1:]
        return out
