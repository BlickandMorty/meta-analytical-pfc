"""Benchmark inference latency/throughput for Transformers vs vLLM (optional)."""

import argparse
import time
from pathlib import Path
import json

from src.utils.config_loader import ConfigLoader


def benchmark_transformers(cfg):
    from transformers import AutoTokenizer, AutoModelForCausalLM
    import torch

    model_name = cfg.get("model_name")
    revision = cfg.get("revision", "main")
    device = cfg.get("device", "cuda")
    dtype = torch.float16 if cfg.get("dtype", "float16") == "float16" else torch.float32
    load_in_4bit = bool(cfg.get("load_in_4bit", True))

    tokenizer = AutoTokenizer.from_pretrained(model_name, revision=revision)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    kwargs = {"revision": revision, "device_map": "auto" if device == "cuda" else None}
    if load_in_4bit:
        kwargs["load_in_4bit"] = True
    else:
        kwargs["torch_dtype"] = dtype

    model = AutoModelForCausalLM.from_pretrained(model_name, **kwargs)
    model.eval()

    prompt = cfg.get("prompt", "Hello")
    max_new_tokens = int(cfg.get("max_new_tokens", 64))
    runs = int(cfg.get("runs", 3))

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

    times = []
    with torch.no_grad():
        for _ in range(runs):
            start = time.perf_counter()
            _ = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
            times.append(time.perf_counter() - start)

    avg_time = sum(times) / len(times)
    return {
        "backend": "transformers",
        "avg_time_sec": avg_time,
        "tokens_per_sec": max_new_tokens / avg_time if avg_time > 0 else 0.0,
    }


def benchmark_vllm(cfg):
    try:
        from vllm import LLM, SamplingParams
    except Exception:
        return None

    model_name = cfg.get("model_name")
    max_new_tokens = int(cfg.get("max_new_tokens", 64))
    runs = int(cfg.get("runs", 3))
    prompt = cfg.get("prompt", "Hello")

    llm = LLM(model=model_name)
    params = SamplingParams(max_tokens=max_new_tokens, temperature=0.0)

    times = []
    for _ in range(runs):
        start = time.perf_counter()
        _ = llm.generate([prompt], params)
        times.append(time.perf_counter() - start)

    avg_time = sum(times) / len(times)
    return {
        "backend": "vllm",
        "avg_time_sec": avg_time,
        "tokens_per_sec": max_new_tokens / avg_time if avg_time > 0 else 0.0,
    }


def main():
    parser = argparse.ArgumentParser(description="Inference benchmark")
    parser.add_argument("--config", default="benchmark.yaml")
    parser.add_argument("--out", default="reports/inference_benchmark.json")
    args = parser.parse_args()

    loader = ConfigLoader()
    cfg = loader.load_yaml(args.config, default={}).get("benchmark", {})

    results = []
    results.append(benchmark_transformers(cfg))

    vllm_result = benchmark_vllm(cfg)
    if vllm_result:
        results.append(vllm_result)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
