"""Download local model weights for activation capture."""

import argparse
import os
import sys

# Ensure repo root is on sys.path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from huggingface_hub import snapshot_download
from src.utils.config_loader import ConfigLoader


def main():
    parser = argparse.ArgumentParser(description="Download local model weights")
    parser.add_argument("--model", default=None, help="Override model name")
    parser.add_argument("--revision", default=None, help="Override revision")
    parser.add_argument("--cache-dir", default=None, help="Hugging Face cache dir")
    args = parser.parse_args()

    loader = ConfigLoader()
    cfg = loader.load_yaml("local_model.yaml", default={})
    local_cfg = cfg.get("local_model", {})

    model_name = args.model or local_cfg.get("model_name", "Qwen/Qwen2.5-7B-Instruct")
    revision = args.revision or local_cfg.get("revision", "main")

    print(f"Downloading {model_name}@{revision}...")
    snapshot_download(
        repo_id=model_name,
        revision=revision,
        cache_dir=args.cache_dir,
        local_dir=None,
        local_dir_use_symlinks=True,
    )
    print("Download complete.")


if __name__ == "__main__":
    main()
