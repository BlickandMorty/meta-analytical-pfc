"""
Local model activation capture for real TDA.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional
import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


@dataclass
class ActivationTrace:
    activations: Dict[int, torch.Tensor]
    tokens: List[int]
    text: str


@dataclass
class ActivationCaptureConfig:
    model_name: str
    revision: str = "main"
    device: str = "cuda"
    dtype: str = "float16"
    load_in_4bit: bool = True
    max_new_tokens: int = 32
    max_input_tokens: int = 512
    capture_layers: List[int] = None
    capture_tokens: int = 32
    token_stride: int = 1
    seed: int = 42


class ActivationCapture:
    def __init__(self, config: ActivationCaptureConfig):
        self.config = config
        self.model = None
        self.tokenizer = None

    def load(self):
        if self.model is not None:
            return

        torch.manual_seed(self.config.seed)

        kwargs = {
            "revision": self.config.revision,
            "device_map": "auto" if self.config.device == "cuda" else None,
        }

        self.tokenizer = AutoTokenizer.from_pretrained(self.config.model_name, revision=self.config.revision)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        try:
            if self.config.load_in_4bit:
                kwargs.update({"load_in_4bit": True})
            else:
                dtype = torch.float16 if self.config.dtype == "float16" else torch.float32
                kwargs.update({"torch_dtype": dtype})

            self.model = AutoModelForCausalLM.from_pretrained(
                self.config.model_name,
                **kwargs,
            )
        except Exception:
            # Fallback to standard loading on CPU if quantized load fails
            kwargs.pop("load_in_4bit", None)
            kwargs["device_map"] = None
            dtype = torch.float16 if self.config.dtype == "float16" else torch.float32
            kwargs["torch_dtype"] = dtype
            self.model = AutoModelForCausalLM.from_pretrained(
                self.config.model_name,
                **kwargs,
            )
        self.model.eval()

    def _resolve_layers(self) -> List[torch.nn.Module]:
        # Try common layer paths across architectures
        candidates = [
            "model.layers",  # Qwen, Llama
            "model.decoder.layers",  # some encoder-decoder
            "transformer.h",  # GPT-2 style
            "gpt_neox.layers",  # GPT-NeoX
        ]

        for path in candidates:
            obj = self.model
            ok = True
            for attr in path.split("."):
                if not hasattr(obj, attr):
                    ok = False
                    break
                obj = getattr(obj, attr)
            if ok and isinstance(obj, (list, torch.nn.ModuleList)):
                return list(obj)
        raise RuntimeError("Could not resolve transformer layers for activation hooks")

    def capture(self, prompt: str) -> Optional[ActivationTrace]:
        self.load()

        if not prompt:
            return None

        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=self.config.max_input_tokens,
        )
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

        layers = self._resolve_layers()
        capture_layers = self.config.capture_layers or [-1, -2, -3, -4]

        selected_indices = []
        for idx in capture_layers:
            if idx < 0:
                idx = len(layers) + idx
            if 0 <= idx < len(layers):
                selected_indices.append(idx)

        captured: Dict[int, torch.Tensor] = {}
        hooks = []

        def _make_hook(layer_idx):
            def hook_fn(module, inp, out):
                # out shape: (batch, seq, hidden)
                if isinstance(out, tuple):
                    out_tensor = out[0]
                else:
                    out_tensor = out
                # Keep last N tokens and stride
                tokens_to_keep = self.config.capture_tokens
                stride = max(1, self.config.token_stride)
                out_slice = out_tensor[:, -tokens_to_keep::stride, :].detach().cpu()
                captured[layer_idx] = out_slice.squeeze(0)
            return hook_fn

        for idx in selected_indices:
            hooks.append(layers[idx].register_forward_hook(_make_hook(idx)))

        with torch.no_grad():
            _ = self.model.generate(
                **inputs,
                max_new_tokens=self.config.max_new_tokens,
                do_sample=False,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        for h in hooks:
            h.remove()

        # Flatten tokens for reference
        tokens = inputs["input_ids"].squeeze(0).tolist()

        return ActivationTrace(
            activations=captured,
            tokens=tokens,
            text=prompt,
        )
