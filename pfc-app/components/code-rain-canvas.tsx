'use client';

import { useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════
// Code tokens for canvas rain — multicolor syntax highlighting
// ═══════════════════════════════════════════════════════════════════════

const TOKEN_POOL = [
  // Imports & keywords (ember/amber)
  { text: 'import torch', color: '#C4956A' },
  { text: 'import numpy as np', color: '#C4956A' },
  { text: 'import pandas as pd', color: '#C4956A' },
  { text: 'from sklearn', color: '#C4956A' },
  { text: 'import tensorflow', color: '#C4956A' },
  { text: 'from transformers', color: '#C4956A' },
  { text: 'import torch.nn', color: '#C4956A' },
  { text: 'from scipy', color: '#C4956A' },
  { text: 'class Model:', color: '#C4956A' },
  { text: 'def forward(self)', color: '#C4956A' },
  { text: 'lambda x:', color: '#C4956A' },
  { text: 'yield batch', color: '#C4956A' },
  { text: 'async def train', color: '#C4956A' },
  { text: 'import jax', color: '#C4956A' },
  { text: 'import einops', color: '#C4956A' },
  { text: 'from typing import', color: '#C4956A' },
  { text: 'import matplotlib', color: '#C4956A' },
  { text: 'from pathlib', color: '#C4956A' },
  { text: 'import wandb', color: '#C4956A' },
  { text: 'import huggingface', color: '#C4956A' },
  { text: 'from torch.optim', color: '#C4956A' },
  { text: 'import torchvision', color: '#C4956A' },
  // Rust keywords (orange)
  { text: 'fn main()', color: '#E07850' },
  { text: 'let mut x =', color: '#E07850' },
  { text: 'impl Trait for', color: '#E07850' },
  { text: 'pub struct', color: '#E07850' },
  { text: 'match result {', color: '#E07850' },
  { text: '.unwrap()', color: '#E07850' },
  { text: '&self', color: '#E07850' },
  { text: 'Vec<f64>', color: '#E07850' },
  // Functions & methods (ember)
  { text: 'model.fit()', color: '#E07850' },
  { text: 'optimizer.step()', color: '#E07850' },
  { text: 'loss.backward()', color: '#E07850' },
  { text: 'np.dot(W, X)', color: '#E07850' },
  { text: 'torch.matmul()', color: '#E07850' },
  { text: 'df.groupby()', color: '#E07850' },
  { text: 'np.linalg.inv()', color: '#E07850' },
  { text: 'F.softmax(logits)', color: '#E07850' },
  { text: 'nn.Linear(768, 512)', color: '#E07850' },
  { text: 'torch.sigmoid(z)', color: '#E07850' },
  { text: 'np.random.randn()', color: '#E07850' },
  { text: 'pd.read_csv()', color: '#E07850' },
  { text: 'model.eval()', color: '#E07850' },
  { text: 'torch.no_grad()', color: '#E07850' },
  { text: 'F.relu(x)', color: '#E07850' },
  { text: 'np.einsum("ij,jk")', color: '#E07850' },
  { text: 'model.parameters()', color: '#E07850' },
  { text: 'torch.cat(tensors)', color: '#E07850' },
  { text: 'nn.Dropout(0.1)', color: '#E07850' },
  { text: 'F.cross_entropy()', color: '#E07850' },
  { text: 'jax.grad(loss_fn)', color: '#E07850' },
  { text: 'np.fft.fft(signal)', color: '#E07850' },
  // JavaScript / TypeScript
  { text: 'const x = await', color: '#C4B5FD' },
  { text: 'export default', color: '#C4B5FD' },
  { text: 'interface Props {', color: '#C4B5FD' },
  { text: 'Promise.all()', color: '#C4B5FD' },
  { text: '.then(res =>)', color: '#C4B5FD' },
  { text: 'Array.from()', color: '#C4B5FD' },
  { text: 'new Map()', color: '#C4B5FD' },
  { text: 'type Guard<T>', color: '#C4B5FD' },
  // Strings & labels (green)
  { text: '"cross_entropy"', color: '#4ADE80' },
  { text: '"attention_mask"', color: '#4ADE80' },
  { text: '"hidden_states"', color: '#4ADE80' },
  { text: '"learning_rate"', color: '#4ADE80' },
  { text: '"embeddings"', color: '#4ADE80' },
  { text: '"gradient"', color: '#4ADE80' },
  { text: '"epoch_{i}"', color: '#4ADE80' },
  { text: '"meta_analysis"', color: '#4ADE80' },
  { text: '"confidence_interval"', color: '#4ADE80' },
  { text: '"bayesian_prior"', color: '#4ADE80' },
  { text: '"effect_size"', color: '#4ADE80' },
  { text: '"p_value < 0.05"', color: '#4ADE80' },
  { text: '"replication_rate"', color: '#4ADE80' },
  { text: '"funnel_plot"', color: '#4ADE80' },
  { text: '"heterogeneity"', color: '#4ADE80' },
  // Numbers & math (cyan)
  { text: '1e-4', color: '#22D3EE' },
  { text: '0.001', color: '#22D3EE' },
  { text: '768', color: '#22D3EE' },
  { text: '512', color: '#22D3EE' },
  { text: '3e-5', color: '#22D3EE' },
  { text: '0.9', color: '#22D3EE' },
  { text: '1024', color: '#22D3EE' },
  { text: '2048', color: '#22D3EE' },
  { text: '3.14159', color: '#22D3EE' },
  { text: '2.71828', color: '#22D3EE' },
  { text: '0.95', color: '#22D3EE' },
  { text: '1.96', color: '#22D3EE' },
  { text: '256', color: '#22D3EE' },
  { text: '4096', color: '#22D3EE' },
  { text: '0xDEAD', color: '#22D3EE' },
  { text: '0b1010', color: '#22D3EE' },
  // Types & classes (yellow)
  { text: 'torch.Tensor', color: '#FACC15' },
  { text: 'nn.Module', color: '#FACC15' },
  { text: 'pd.DataFrame', color: '#FACC15' },
  { text: 'np.ndarray', color: '#FACC15' },
  { text: 'DataLoader', color: '#FACC15' },
  { text: 'Optimizer', color: '#FACC15' },
  { text: 'Transformer', color: '#FACC15' },
  { text: 'BertModel', color: '#FACC15' },
  { text: 'GPT2Config', color: '#FACC15' },
  { text: 'AutoTokenizer', color: '#FACC15' },
  { text: 'LlamaForCausal', color: '#FACC15' },
  { text: 'AdamW', color: '#FACC15' },
  { text: 'StepLR', color: '#FACC15' },
  { text: 'GradScaler', color: '#FACC15' },
  // Operators & syntax (dim)
  { text: '@', color: '#9CA3AF' },
  { text: '**2', color: '#9CA3AF' },
  { text: '.T', color: '#9CA3AF' },
  { text: '[::, :]', color: '#9CA3AF' },
  { text: '-> Tensor', color: '#9CA3AF' },
  { text: '+=', color: '#9CA3AF' },
  { text: '.shape', color: '#9CA3AF' },
  { text: '|>', color: '#9CA3AF' },
  { text: '??=', color: '#9CA3AF' },
  { text: '<<=', color: '#9CA3AF' },
  { text: '...args', color: '#9CA3AF' },
  { text: '?.', color: '#9CA3AF' },
  { text: '>>>', color: '#9CA3AF' },
  // Comments (dim green)
  { text: '# gradient descent', color: '#86EFAC' },
  { text: '# backpropagation', color: '#86EFAC' },
  { text: '# attention heads', color: '#86EFAC' },
  { text: '# loss function', color: '#86EFAC' },
  { text: '# feature scaling', color: '#86EFAC' },
  { text: '# batch norm', color: '#86EFAC' },
  { text: '# meta-analysis', color: '#86EFAC' },
  { text: '# Bayesian inference', color: '#86EFAC' },
  { text: '# MCMC sampling', color: '#86EFAC' },
  { text: '# cross-validation', color: '#86EFAC' },
  { text: '# p(H|D) ∝ p(D|H)p(H)', color: '#86EFAC' },
  { text: '// TODO: optimize', color: '#86EFAC' },
  { text: '/* effect sizes */', color: '#86EFAC' },
  { text: '# heterogeneity test', color: '#86EFAC' },
  // Math symbols (pink)
  { text: 'Σ(xi - x̄)²', color: '#F9A8D4' },
  { text: '∂L/∂w', color: '#F9A8D4' },
  { text: '∇f(x)', color: '#F9A8D4' },
  { text: 'μ ± σ', color: '#F9A8D4' },
  { text: 'χ² test', color: '#F9A8D4' },
  { text: 'ℒ(θ|X)', color: '#F9A8D4' },
  { text: 'argmax P(y|x)', color: '#F9A8D4' },
  { text: 'KL(P‖Q)', color: '#F9A8D4' },
];

// ═══════════════════════════════════════════════════════════════════════
// Code block snippets — typed out ChatGPT-style
// ═══════════════════════════════════════════════════════════════════════

const CODE_SNIPPETS: { text: string; color: string }[][] = [
  [
    { text: '# gradient descent step', color: '#86EFAC' },
    { text: 'W = W - lr * dW', color: '#C4956A' },
    { text: 'b = b - lr * db', color: '#C4956A' },
    { text: 'loss = np.mean(', color: '#E07850' },
    { text: '  (y_pred - y)**2)', color: '#22D3EE' },
  ],
  [
    { text: 'import torch.nn as nn', color: '#C4956A' },
    { text: 'class Attention(nn.Module):', color: '#FACC15' },
    { text: '  def forward(self, Q, K, V):', color: '#E07850' },
    { text: '    scores = Q @ K.T', color: '#22D3EE' },
    { text: '    weights = F.softmax(', color: '#E07850' },
    { text: '      scores / d_k**0.5)', color: '#22D3EE' },
    { text: '    return weights @ V', color: '#C4956A' },
  ],
  [
    { text: 'X_train, X_test =', color: '#C4956A' },
    { text: '  train_test_split(X, y)', color: '#E07850' },
    { text: 'scaler = StandardScaler()', color: '#FACC15' },
    { text: 'X_train = scaler.fit_', color: '#E07850' },
    { text: '  transform(X_train)', color: '#E07850' },
  ],
  [
    { text: '# embedding layer', color: '#86EFAC' },
    { text: 'emb = nn.Embedding(', color: '#E07850' },
    { text: '  vocab_size, d_model)', color: '#22D3EE' },
    { text: 'pos = positional_encoding(', color: '#E07850' },
    { text: '  seq_len, d_model)', color: '#22D3EE' },
    { text: 'x = emb(tokens) + pos', color: '#C4956A' },
  ],
  [
    { text: 'optimizer = Adam(', color: '#E07850' },
    { text: '  model.parameters(),', color: '#FACC15' },
    { text: '  lr=3e-5, eps=1e-8)', color: '#22D3EE' },
    { text: 'for epoch in range(100):', color: '#C4956A' },
    { text: '  loss = criterion(out, y)', color: '#E07850' },
    { text: '  loss.backward()', color: '#E07850' },
    { text: '  optimizer.step()', color: '#E07850' },
  ],
  [
    { text: 'df = pd.read_csv(path)', color: '#C4956A' },
    { text: 'corr = df.corr()', color: '#E07850' },
    { text: 'features = df.select_dtypes(', color: '#E07850' },
    { text: '  include=[np.number])', color: '#FACC15' },
    { text: 'X = features.values', color: '#22D3EE' },
  ],
];

// ═══════════════════════════════════════════════════════════════════════
// Piñata token pool — 1-2 word tokens for brain knock-out effect
// ═══════════════════════════════════════════════════════════════════════

const PINATA_POOL = [
  { text: 'torch.Tensor', color: '#FACC15' },
  { text: 'nn.Module', color: '#FACC15' },
  { text: 'DataFrame', color: '#FACC15' },
  { text: 'np.ndarray', color: '#FACC15' },
  { text: 'DataLoader', color: '#FACC15' },
  { text: 'Transformer', color: '#FACC15' },
  { text: 'Optimizer', color: '#FACC15' },
  { text: 'model.fit()', color: '#E07850' },
  { text: 'loss.backward()', color: '#E07850' },
  { text: 'optimizer.step()', color: '#E07850' },
  { text: 'F.softmax()', color: '#E07850' },
  { text: 'np.dot()', color: '#E07850' },
  { text: 'torch.matmul()', color: '#E07850' },
  { text: 'pd.read_csv()', color: '#E07850' },
  { text: 'df.groupby()', color: '#E07850' },
  { text: 'torch.sigmoid()', color: '#E07850' },
  { text: 'import torch', color: '#C4956A' },
  { text: 'from sklearn', color: '#C4956A' },
  { text: 'class Model:', color: '#C4956A' },
  { text: 'lambda x:', color: '#C4956A' },
  { text: 'yield batch', color: '#C4956A' },
  { text: 'def forward()', color: '#C4956A' },
  { text: '"cross_entropy"', color: '#4ADE80' },
  { text: '"attention_mask"', color: '#4ADE80' },
  { text: '"gradient"', color: '#4ADE80' },
  { text: '"embeddings"', color: '#4ADE80' },
  { text: '768', color: '#22D3EE' },
  { text: '1e-4', color: '#22D3EE' },
  { text: '3e-5', color: '#22D3EE' },
  { text: '2048', color: '#22D3EE' },
  { text: '.shape', color: '#9CA3AF' },
  { text: '.T', color: '#9CA3AF' },
  { text: '-> Tensor', color: '#9CA3AF' },
  { text: '**2', color: '#9CA3AF' },
  { text: '# backprop', color: '#86EFAC' },
  { text: '# gradient', color: '#86EFAC' },
  { text: '# attention', color: '#86EFAC' },
  { text: '{', color: '#9CA3AF' },
  { text: '}', color: '#9CA3AF' },
  { text: '(', color: '#9CA3AF' },
  { text: ')', color: '#9CA3AF' },
  { text: '[', color: '#9CA3AF' },
  { text: ']', color: '#9CA3AF' },
  { text: '=', color: '#9CA3AF' },
  { text: '+', color: '#9CA3AF' },
  { text: ';', color: '#9CA3AF' },
  { text: ':', color: '#9CA3AF' },
  { text: '*', color: '#9CA3AF' },
  { text: '&', color: '#9CA3AF' },
  { text: '=>', color: '#E07850' },
  { text: '!=', color: '#9CA3AF' },
  { text: '++', color: '#9CA3AF' },
  { text: '->', color: '#9CA3AF' },
  { text: 'if', color: '#C4956A' },
  { text: 'for', color: '#C4956A' },
  { text: 'def', color: '#C4956A' },
  { text: 'int', color: '#22D3EE' },
  { text: 'var', color: '#C4956A' },
  { text: 'let', color: '#C4956A' },
  { text: 'fn', color: '#C4956A' },
  { text: 'nil', color: '#9CA3AF' },
  { text: 'True', color: '#22D3EE' },
  { text: 'None', color: '#9CA3AF' },
];

// ═══════════════════════════════════════════════════════════════════════
// Piñata particle — ragdoll physics (separate from background rain)
// ═══════════════════════════════════════════════════════════════════════

interface PinataParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  color: string;
  rotation: number;
  rotVel: number;
  fontSize: number;
  opacity: number;
  life: number;
  maxLife: number;
  bounced: boolean;
}

const PINATA_GRAVITY = 0.07;
const PINATA_MAX_PARTICLES = 40;

function createPinataParticle(x: number, y: number): PinataParticle {
  const token = PINATA_POOL[Math.floor(Math.random() * PINATA_POOL.length)];
  const angle = Math.random() * Math.PI * 2;
  const speed = 2.5 + Math.random() * 4;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 3,
    text: token.text,
    color: token.color,
    rotation: (Math.random() - 0.5) * 1.2,
    rotVel: (Math.random() - 0.5) * 0.1,
    fontSize: 10 + Math.random() * 8,
    opacity: 0.7 + Math.random() * 0.3,
    life: 8 + Math.random() * 4,
    maxLife: 12,
    bounced: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Rain drop — types in, falls, blurs out
// ═══════════════════════════════════════════════════════════════════════

type SizeTier = 'tiny' | 'normal' | 'large';

const STRIKEOUT_RED = '#F87171';
const CURSOR_COLOR = '#D4D4D8';

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  fontSize: number;
  text: string;
  color: string;
  typedChars: number;
  typeTimer: number;
  typeInterval: number;   // frames between each char appearing
  phase: 'typing' | 'visible' | 'fading';
  baseOpacity: number;
  fadeProgress: number;   // 0→1 during fading
  visibleTimer: number;   // frames to stay visible before fading
  sizeTier: SizeTier;
  // Strikeout animation
  strikeout: number;
  strikeoutText: string;
  strikeoutOrigColor: string;
  strikeoutY: number;
  // Code-edit animation
  editing: number;
  editOrigText: string;
  editNewText: string;
  editOrigColor: string;
  editNewColor: string;
  editY: number;
  // Codeblock animation
  codeblock: number;
  codeblockIdx: number;
  codeblockY: number;
}

function pickSpeedTier(): { speed: number; tier: SizeTier } {
  const r = Math.random();
  if (r < 0.12) {
    // Large: slow background depth elements
    return { speed: 0.3 + Math.random() * 0.5, tier: 'large' };
  }
  if (r < 0.25) {
    // Slow rain
    return { speed: 1.0 + Math.random() * 1.2, tier: 'normal' };
  }
  if (r < 0.55) {
    // Medium rain
    return { speed: 2.0 + Math.random() * 1.5, tier: 'normal' };
  }
  // Fast rain (majority)
  return { speed: 3.0 + Math.random() * 2.5, tier: Math.random() < 0.2 ? 'tiny' : 'normal' };
}

function createDrop(w: number, h: number): RainDrop {
  const token = TOKEN_POOL[Math.floor(Math.random() * TOKEN_POOL.length)];
  const { speed, tier } = pickSpeedTier();

  let fontSize: number;
  let baseOpacity: number;

  switch (tier) {
    case 'large':
      fontSize = 22 + Math.random() * 14;
      baseOpacity = 0.04 + Math.random() * 0.05;
      break;
    case 'tiny':
      fontSize = 7 + Math.random() * 4;
      baseOpacity = 0.08 + Math.random() * 0.10;
      break;
    default:
      fontSize = 11 + Math.random() * 5;
      baseOpacity = 0.10 + Math.random() * 0.16;
      break;
  }

  // Faster drops type faster
  const typeInterval = speed > 2.5 ? 1.5 + Math.random() * 1.5 : 2 + Math.random() * 3;

  return {
    x: Math.random() * w,
    y: -Math.random() * h * 0.5 - 30,
    speed,
    fontSize,
    text: token.text,
    color: token.color,
    typedChars: 0,
    typeTimer: 0,
    typeInterval,
    phase: 'typing',
    baseOpacity,
    fadeProgress: 0,
    visibleTimer: 20 + Math.random() * 60, // stay visible 20-80 frames
    sizeTier: tier,
    strikeout: 0,
    strikeoutText: '',
    strikeoutOrigColor: '',
    strikeoutY: 0,
    editing: 0,
    editOrigText: '',
    editNewText: '',
    editOrigColor: '',
    editNewColor: '',
    editY: 0,
    codeblock: 0,
    codeblockIdx: 0,
    codeblockY: 0,
  };
}

function recycleDrop(drop: RainDrop, w: number) {
  const token = TOKEN_POOL[Math.floor(Math.random() * TOKEN_POOL.length)];
  const { speed, tier } = pickSpeedTier();

  drop.text = token.text;
  drop.color = token.color;
  drop.speed = speed;
  drop.sizeTier = tier;
  drop.x = Math.random() * w;
  drop.y = -Math.random() * 120 - 30;
  drop.typedChars = 0;
  drop.typeTimer = 0;
  drop.typeInterval = speed > 2.5 ? 1.5 + Math.random() * 1.5 : 2 + Math.random() * 3;
  drop.phase = 'typing';
  drop.fadeProgress = 0;
  drop.visibleTimer = 20 + Math.random() * 60;
  drop.strikeout = 0;
  drop.editing = 0;
  drop.codeblock = 0;

  switch (tier) {
    case 'large':
      drop.fontSize = 22 + Math.random() * 14;
      drop.baseOpacity = 0.04 + Math.random() * 0.05;
      break;
    case 'tiny':
      drop.fontSize = 7 + Math.random() * 4;
      drop.baseOpacity = 0.08 + Math.random() * 0.10;
      break;
    default:
      drop.fontSize = 11 + Math.random() * 5;
      drop.baseOpacity = 0.10 + Math.random() * 0.16;
      break;
  }
}

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// ═══════════════════════════════════════════════════════════════════════
// Canvas rain component
// ═══════════════════════════════════════════════════════════════════════

export function CodeRainCanvas({ isDark, searchFocused }: { isDark: boolean; searchFocused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<RainDrop[]>([]);
  const pinataRef = useRef<PinataParticle[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameSkipRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let cachedW = window.innerWidth;
    let cachedH = window.innerHeight;
    const densityMultiplier = isDark ? 1.3 : 1.6;

    function resetDrops() {
      dropsRef.current = [];
      const count = Math.floor((cachedW / 48) * densityMultiplier);
      for (let i = 0; i < count; i++) {
        dropsRef.current.push(createDrop(cachedW, cachedH));
      }
    }

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cachedW = window.innerWidth;
      cachedH = window.innerHeight;
      resetDrops();
    }

    resize();
    window.addEventListener('resize', resize);

    // Piñata event listener
    function onPinata(e: Event) {
      const { x, y, count } = (e as CustomEvent).detail;
      const current = pinataRef.current.length;
      const toAdd = Math.min(count, PINATA_MAX_PARTICLES - current);
      for (let i = 0; i < toAdd; i++) {
        pinataRef.current.push(createPinataParticle(x, y));
      }
    }
    window.addEventListener('pfc-pinata', onPinata);

    // Animation constants
    const STRIKEOUT_SPEED = 1 / 90;
    const STRIKEOUT_CHANCE = 0.0015;
    const EDIT_SPEED = 1 / 140;
    const EDIT_CHANCE = 0.001;
    const CODEBLOCK_SPEED = 1 / 200;
    const CODEBLOCK_CHANCE = 0.0004;
    const FADE_SPEED = 0.035; // how fast drops blur-vanish (higher = faster)
    let cursorClock = 0;

    const fontCache = new Map<number, string>();
    const measureCache = new Map<string, number>();

    function getFont(size: number): string {
      const key = Math.round(size);
      let v = fontCache.get(key);
      if (!v) { v = `${size}px ui-monospace, "SF Mono", monospace`; fontCache.set(key, v); }
      return v;
    }

    function getMeasure(text: string, fontSize: number): number {
      const key = `${Math.round(fontSize)}:${text}`;
      let v = measureCache.get(key);
      if (v === undefined) {
        ctx!.font = getFont(fontSize);
        v = ctx!.measureText(text).width;
        measureCache.set(key, v);
      }
      return v;
    }

    // Search bar rect cache
    let searchBarRect: DOMRect | null = null;
    const searchBarEl = document.querySelector('[data-search-bar]');
    if (searchBarEl) searchBarRect = searchBarEl.getBoundingClientRect();
    const searchBarObserver = new ResizeObserver(() => {
      const el = document.querySelector('[data-search-bar]');
      searchBarRect = el ? el.getBoundingClientRect() : null;
    });
    if (searchBarEl) searchBarObserver.observe(searchBarEl);
    const updateSearchBarRect = () => {
      const el = document.querySelector('[data-search-bar]');
      searchBarRect = el ? el.getBoundingClientRect() : null;
    };
    window.addEventListener('scroll', updateSearchBarRect, { passive: true });

    // Battery: pause when tab hidden
    let tabHidden = document.hidden;
    const onVisChange = () => { tabHidden = document.hidden; };
    document.addEventListener('visibilitychange', onVisChange);

    // Respect prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const onMotionChange = (e: MediaQueryListEvent) => { reducedMotion = e.matches; };
    motionQuery.addEventListener('change', onMotionChange);

    function draw(timestamp: number) {
      if (!canvas || !ctx) return;

      if (tabHidden) { rafRef.current = requestAnimationFrame(draw); return; }
      if (reducedMotion) { rafRef.current = requestAnimationFrame(draw); return; }

      // 30fps throttle — skip every other frame
      frameSkipRef.current = !frameSkipRef.current;
      if (frameSkipRef.current) { rafRef.current = requestAnimationFrame(draw); return; }

      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      if (delta > 200) { rafRef.current = requestAnimationFrame(draw); return; }
      const dt = Math.min(delta / 16.67, 3);
      const dtSec = delta / 1000;

      const w = cachedW;
      const h = cachedH;

      ctx.clearRect(0, 0, w, h);
      cursorClock += dt;
      const cursorOn = Math.sin(cursorClock * 0.55) > 0;

      // ════════════════════════════════════════════════════════════
      // LAYER 1: Rain drops — type in, fall, blur-vanish
      // ════════════════════════════════════════════════════════════

      const idleBuckets = new Map<number, RainDrop[]>();
      const animatingDrops: RainDrop[] = [];

      for (const drop of dropsRef.current) {
        // Fall
        drop.y += drop.speed * dt;

        // Off-screen: recycle
        if (drop.y > h + 60) {
          recycleDrop(drop, w);
          continue;
        }
        if (drop.y < -250) continue;

        // Phase logic
        if (drop.phase === 'typing') {
          drop.typeTimer += dt;
          if (drop.typeTimer >= drop.typeInterval) {
            drop.typeTimer = 0;
            drop.typedChars++;
            if (drop.typedChars >= drop.text.length) {
              drop.typedChars = drop.text.length;
              drop.phase = 'visible';
            }
          }
        } else if (drop.phase === 'visible') {
          drop.visibleTimer -= dt;
          if (drop.visibleTimer <= 0) {
            drop.phase = 'fading';
            drop.fadeProgress = 0;
          }
        } else if (drop.phase === 'fading') {
          drop.fadeProgress += FADE_SPEED * dt;
          if (drop.fadeProgress >= 1) {
            recycleDrop(drop, w);
            continue;
          }
        }

        const isIdle = drop.strikeout === 0 && drop.editing === 0 && drop.codeblock === 0;

        // Trigger animations (only normal-tier, visible phase, on-screen)
        if (isIdle && drop.phase === 'visible' && drop.sizeTier === 'normal' && drop.y > 0 && drop.y < h) {
          const r = Math.random();
          if (r < STRIKEOUT_CHANCE) {
            drop.strikeout = 0.001;
            drop.strikeoutText = drop.text;
            drop.strikeoutOrigColor = drop.color;
            drop.strikeoutY = drop.y;
          } else if (r < STRIKEOUT_CHANCE + EDIT_CHANCE) {
            let replacement = TOKEN_POOL[Math.floor(Math.random() * TOKEN_POOL.length)];
            for (let a = 0; a < 3 && replacement.text === drop.text; a++) {
              replacement = TOKEN_POOL[Math.floor(Math.random() * TOKEN_POOL.length)];
            }
            drop.editing = 0.001;
            drop.editOrigText = drop.text;
            drop.editOrigColor = drop.color;
            drop.editNewText = replacement.text;
            drop.editNewColor = replacement.color;
            drop.editY = drop.y;
          } else if (drop.y > 40 && drop.y < h - 100 && Math.random() < CODEBLOCK_CHANCE) {
            drop.codeblock = 0.001;
            drop.codeblockIdx = Math.floor(Math.random() * CODE_SNIPPETS.length);
            drop.codeblockY = drop.y;
          }
        }

        // Advance animation timers
        if (drop.strikeout > 0) {
          drop.strikeout += STRIKEOUT_SPEED * dt;
          if (drop.strikeout >= 1) drop.strikeout = 0;
        }
        if (drop.editing > 0) {
          drop.editing += EDIT_SPEED * dt;
          if (drop.editing >= 1) drop.editing = 0;
        }
        if (drop.codeblock > 0) {
          drop.codeblock += CODEBLOCK_SPEED * dt;
          if (drop.codeblock >= 1) drop.codeblock = 0;
        }

        // Bucket for batch drawing
        if (drop.strikeout > 0 || drop.editing > 0 || drop.codeblock > 0) {
          animatingDrops.push(drop);
        } else {
          const key = Math.round(drop.fontSize);
          let bucket = idleBuckets.get(key);
          if (!bucket) { bucket = []; idleBuckets.set(key, bucket); }
          bucket.push(drop);
        }
      }

      // ── Batch-draw idle drops by font size ──
      for (const [fontSize, drops] of idleBuckets) {
        ctx.font = getFont(fontSize);
        for (const drop of drops) {
          // Calculate how many chars to show
          const chars = Math.min(drop.typedChars, drop.text.length);
          if (chars <= 0) continue;

          const displayText = drop.text.slice(0, chars);

          // Calculate opacity with fade
          let alpha = isDark ? drop.baseOpacity * 0.9 : drop.baseOpacity * 0.88;
          if (drop.phase === 'fading') {
            const fadeEased = easeOut(drop.fadeProgress);
            alpha *= (1 - fadeEased);
          }

          if (alpha < 0.005) continue;

          // Apply blur via filter for fading drops (CSS filter on canvas)
          if (drop.phase === 'fading' && drop.fadeProgress > 0.1) {
            const blurAmount = drop.fadeProgress * 6;
            ctx.filter = `blur(${blurAmount}px)`;
          }

          ctx.fillStyle = drop.color;
          ctx.globalAlpha = Math.min(alpha, 1);
          ctx.fillText(displayText, drop.x, drop.y);

          // Typing cursor
          if (drop.phase === 'typing' && chars < drop.text.length && cursorOn) {
            const tw = getMeasure(displayText, drop.fontSize);
            ctx.fillStyle = CURSOR_COLOR;
            ctx.globalAlpha = alpha * 0.6;
            ctx.fillRect(drop.x + tw + 1, drop.y - drop.fontSize * 0.75, Math.max(1, drop.fontSize * 0.06), drop.fontSize * 0.85);
          }

          if (ctx.filter !== 'none') ctx.filter = 'none';
        }
      }

      // ── Draw animating drops ──
      for (const drop of animatingDrops) {
        ctx.font = getFont(drop.fontSize);

        // Strikeout animation
        if (drop.strikeout > 0) {
          const p = drop.strikeout;
          const colorT = easeInOut(Math.min(p / 0.4, 1));
          const drawColor = lerpColor(drop.strikeoutOrigColor, STRIKEOUT_RED, colorT);
          const fadeOut = p > 0.7 ? 1 - easeInOut((p - 0.7) / 0.3) : 1;
          const strikeAlpha = 0.55 * fadeOut;

          ctx.fillStyle = drawColor;
          ctx.globalAlpha = strikeAlpha;
          ctx.fillText(drop.strikeoutText, drop.x, drop.strikeoutY);

          if (p > 0.3) {
            const lineProgress = easeInOut(Math.min((p - 0.3) / 0.4, 1));
            const textWidth = getMeasure(drop.strikeoutText, drop.fontSize);
            const lineY = drop.strikeoutY - drop.fontSize * 0.3;
            ctx.strokeStyle = STRIKEOUT_RED;
            ctx.globalAlpha = strikeAlpha * 0.9;
            ctx.lineWidth = Math.max(1, drop.fontSize * 0.08);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(drop.x - 2, lineY);
            ctx.lineTo(drop.x - 2 + (textWidth + 4) * lineProgress, lineY);
            ctx.stroke();
          }
        }

        // Code-edit animation
        if (drop.editing > 0) {
          const p = drop.editing;
          const editAlpha = 0.55;
          const origLen = drop.editOrigText.length;
          const newLen = drop.editNewText.length;

          let displayText = '';
          let displayColor = drop.editOrigColor;
          let cursorX = 0;
          let showCursor = cursorOn;
          let fadeAlpha = 1;

          if (p < 0.08) {
            displayText = drop.editOrigText;
            displayColor = drop.editOrigColor;
          } else if (p < 0.38) {
            const deleteProgress = (p - 0.08) / 0.30;
            const charsRemaining = Math.max(0, origLen - Math.floor(deleteProgress * origLen));
            displayText = drop.editOrigText.slice(0, charsRemaining);
            displayColor = drop.editOrigColor;
          } else if (p < 0.45) {
            displayText = '';
          } else if (p < 0.85) {
            const typeProgress = (p - 0.45) / 0.40;
            const charsTyped = Math.min(newLen, Math.floor(typeProgress * (newLen + 1)));
            displayText = drop.editNewText.slice(0, charsTyped);
            displayColor = drop.editNewColor;
          } else {
            displayText = drop.editNewText;
            displayColor = drop.editNewColor;
            fadeAlpha = 1 - easeInOut((p - 0.85) / 0.15);
            showCursor = false;
          }

          if (displayText.length > 0) {
            ctx.fillStyle = displayColor;
            ctx.globalAlpha = editAlpha * fadeAlpha;
            ctx.fillText(displayText, drop.x, drop.editY);
            cursorX = drop.x + getMeasure(displayText, drop.fontSize);
          } else {
            cursorX = drop.x;
          }

          if (showCursor) {
            const cursorH = drop.fontSize * 0.85;
            const cursorY = drop.editY - cursorH + drop.fontSize * 0.15;
            ctx.fillStyle = CURSOR_COLOR;
            ctx.globalAlpha = editAlpha * fadeAlpha * 0.8;
            ctx.fillRect(cursorX + 1, cursorY, Math.max(1, drop.fontSize * 0.07), cursorH);
          }
        }

        // Code block typewriter
        if (drop.codeblock > 0) {
          const p = drop.codeblock;
          const snippet = CODE_SNIPPETS[drop.codeblockIdx % CODE_SNIPPETS.length];
          const blockFontSize = 8;
          const lineH = blockFontSize * 1.5;

          let totalChars = 0;
          for (const line of snippet) totalChars += line.text.length;

          const bgFadeIn = Math.min(p / 0.05, 1);
          const fadeOut = p > 0.85 ? 1 - easeInOut((p - 0.85) / 0.15) : 1;
          const blockAlpha = 0.5 * bgFadeIn * fadeOut;

          ctx.font = getFont(blockFontSize);
          const cbAlpha = blockAlpha * 0.7;

          if (p > 0.05) {
            const typeProgress = Math.min((p - 0.05) / 0.80, 1);
            let charsToShow = Math.floor(typeProgress * totalChars);
            let charCount = 0;

            for (let li = 0; li < snippet.length; li++) {
              const line = snippet[li];
              const remaining = charsToShow - charCount;
              if (remaining <= 0) break;

              const visibleChars = Math.min(remaining, line.text.length);
              const visibleText = line.text.slice(0, visibleChars);
              charCount += line.text.length;

              const ly = drop.codeblockY + li * lineH;
              ctx.fillStyle = line.color;
              ctx.globalAlpha = cbAlpha;
              ctx.fillText(visibleText, drop.x, ly);

              if (visibleChars < line.text.length && cursorOn && fadeOut > 0.5) {
                const cw = getMeasure(visibleText, 8);
                ctx.fillStyle = CURSOR_COLOR;
                ctx.globalAlpha = cbAlpha * 0.7;
                ctx.fillRect(drop.x + cw + 1, ly - blockFontSize * 0.7, 1, blockFontSize * 0.85);
              }
            }
          }
        }
      }

      // ════════════════════════════════════════════════════════════
      // LAYER 2: Piñata particles
      // ════════════════════════════════════════════════════════════

      const particles = pinataRef.current;
      while (particles.length > PINATA_MAX_PARTICLES) particles.pop();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.vy += PINATA_GRAVITY * dt;
        p.vx *= 0.998;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotVel * dt;

        p.life -= dtSec;
        if (p.life <= 0) { particles.splice(i, 1); continue; }

        if (!p.bounced && searchBarRect && p.vy > 0) {
          const sb = searchBarRect;
          if (p.x > sb.left - 10 && p.x < sb.right + 10 &&
              p.y > sb.top - 4 && p.y < sb.bottom) {
            p.vy = -Math.abs(p.vy) * 0.25;
            p.vx *= 0.6;
            p.rotVel *= 1.5;
            p.y = sb.top - 4;
            p.life = Math.min(p.life, 2.5);
            p.bounced = true;
          }
        }

        if (p.y > h + 60 || p.x < -80 || p.x > w + 80) {
          particles.splice(i, 1);
          continue;
        }

        const age = p.maxLife - p.life;
        const fadeIn = Math.min(1, age / 0.15);
        const fadeOut = p.life < 2 ? p.life / 2 : 1;
        const alpha = p.opacity * fadeIn * fadeOut;

        const cos = Math.cos(p.rotation);
        const sin = Math.sin(p.rotation);
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(cos * dpr, sin * dpr, -sin * dpr, cos * dpr, p.x * dpr, p.y * dpr);
        ctx.font = getFont(p.fontSize);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillText(p.text, 0, 0);
      }

      // Reset transform
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pfc-pinata', onPinata);
      window.removeEventListener('scroll', updateSearchBarRect);
      document.removeEventListener('visibilitychange', onVisChange);
      motionQuery.removeEventListener('change', onMotionChange);
      searchBarObserver.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: searchFocused ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Vignette overlay
// ═══════════════════════════════════════════════════════════════════════

export function CodeRainOverlays({ isDark }: { isDark: boolean }) {
  if (isDark) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(250,250,248,0.65) 100%)',
      }}
    />
  );
}
