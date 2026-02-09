'use client';

import { useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════
// Code tokens for canvas rain — multicolor syntax highlighting
// ═══════════════════════════════════════════════════════════════════════

const TOKEN_POOL = [
  // Imports & keywords (violet)
  { text: 'import torch', color: '#8B7CF6' },
  { text: 'import numpy as np', color: '#8B7CF6' },
  { text: 'import pandas as pd', color: '#8B7CF6' },
  { text: 'from sklearn', color: '#8B7CF6' },
  { text: 'import tensorflow', color: '#8B7CF6' },
  { text: 'from transformers', color: '#8B7CF6' },
  { text: 'import torch.nn', color: '#8B7CF6' },
  { text: 'from scipy', color: '#8B7CF6' },
  { text: 'class Model:', color: '#8B7CF6' },
  { text: 'def forward(self)', color: '#8B7CF6' },
  { text: 'lambda x:', color: '#8B7CF6' },
  { text: 'yield batch', color: '#8B7CF6' },
  { text: 'async def train', color: '#8B7CF6' },
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
  // Strings & labels (green)
  { text: '"cross_entropy"', color: '#4ADE80' },
  { text: '"attention_mask"', color: '#4ADE80' },
  { text: '"hidden_states"', color: '#4ADE80' },
  { text: '"learning_rate"', color: '#4ADE80' },
  { text: '"embeddings"', color: '#4ADE80' },
  { text: '"gradient"', color: '#4ADE80' },
  { text: '"epoch_{i}"', color: '#4ADE80' },
  // Numbers & math (cyan)
  { text: '1e-4', color: '#22D3EE' },
  { text: '0.001', color: '#22D3EE' },
  { text: '768', color: '#22D3EE' },
  { text: '512', color: '#22D3EE' },
  { text: '3e-5', color: '#22D3EE' },
  { text: '0.9', color: '#22D3EE' },
  { text: '1024', color: '#22D3EE' },
  { text: '2048', color: '#22D3EE' },
  // Types & classes (yellow)
  { text: 'torch.Tensor', color: '#FACC15' },
  { text: 'nn.Module', color: '#FACC15' },
  { text: 'pd.DataFrame', color: '#FACC15' },
  { text: 'np.ndarray', color: '#FACC15' },
  { text: 'DataLoader', color: '#FACC15' },
  { text: 'Optimizer', color: '#FACC15' },
  { text: 'Transformer', color: '#FACC15' },
  // Operators & syntax (dim)
  { text: '@', color: '#9CA3AF' },
  { text: '**2', color: '#9CA3AF' },
  { text: '.T', color: '#9CA3AF' },
  { text: '[::, :]', color: '#9CA3AF' },
  { text: '-> Tensor', color: '#9CA3AF' },
  { text: '+=', color: '#9CA3AF' },
  { text: '.shape', color: '#9CA3AF' },
  // Comments (dim green)
  { text: '# gradient descent', color: '#86EFAC' },
  { text: '# backpropagation', color: '#86EFAC' },
  { text: '# attention heads', color: '#86EFAC' },
  { text: '# loss function', color: '#86EFAC' },
  { text: '# feature scaling', color: '#86EFAC' },
  { text: '# batch norm', color: '#86EFAC' },
];

// ═══════════════════════════════════════════════════════════════════════
// Code block snippets — typed out ChatGPT-style
// ═══════════════════════════════════════════════════════════════════════

const CODE_SNIPPETS: { text: string; color: string }[][] = [
  [
    { text: '# gradient descent step', color: '#86EFAC' },
    { text: 'W = W - lr * dW', color: '#8B7CF6' },
    { text: 'b = b - lr * db', color: '#8B7CF6' },
    { text: 'loss = np.mean(', color: '#E07850' },
    { text: '  (y_pred - y)**2)', color: '#22D3EE' },
  ],
  [
    { text: 'import torch.nn as nn', color: '#8B7CF6' },
    { text: 'class Attention(nn.Module):', color: '#FACC15' },
    { text: '  def forward(self, Q, K, V):', color: '#E07850' },
    { text: '    scores = Q @ K.T', color: '#22D3EE' },
    { text: '    weights = F.softmax(', color: '#E07850' },
    { text: '      scores / d_k**0.5)', color: '#22D3EE' },
    { text: '    return weights @ V', color: '#8B7CF6' },
  ],
  [
    { text: 'X_train, X_test =', color: '#8B7CF6' },
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
    { text: 'x = emb(tokens) + pos', color: '#8B7CF6' },
  ],
  [
    { text: 'optimizer = Adam(', color: '#E07850' },
    { text: '  model.parameters(),', color: '#FACC15' },
    { text: '  lr=3e-5, eps=1e-8)', color: '#22D3EE' },
    { text: 'for epoch in range(100):', color: '#8B7CF6' },
    { text: '  loss = criterion(out, y)', color: '#E07850' },
    { text: '  loss.backward()', color: '#E07850' },
    { text: '  optimizer.step()', color: '#E07850' },
  ],
  [
    { text: 'df = pd.read_csv(path)', color: '#8B7CF6' },
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
  { text: 'import torch', color: '#8B7CF6' },
  { text: 'from sklearn', color: '#8B7CF6' },
  { text: 'class Model:', color: '#8B7CF6' },
  { text: 'lambda x:', color: '#8B7CF6' },
  { text: 'yield batch', color: '#8B7CF6' },
  { text: 'def forward()', color: '#8B7CF6' },
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
  // Single characters & short syntax tokens
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
  { text: 'if', color: '#8B7CF6' },
  { text: 'for', color: '#8B7CF6' },
  { text: 'def', color: '#8B7CF6' },
  { text: 'int', color: '#22D3EE' },
  { text: 'var', color: '#8B7CF6' },
  { text: 'let', color: '#8B7CF6' },
  { text: 'fn', color: '#8B7CF6' },
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
const PINATA_MAX = 80;

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
// Canvas rain column — with size tiers for visual depth
// ═══════════════════════════════════════════════════════════════════════

type SizeTier = 'tiny' | 'normal' | 'large';

const STRIKEOUT_RED = '#F87171';
const CURSOR_COLOR = '#D4D4D8';

interface RainColumn {
  x: number;
  y: number;
  speed: number;
  fontSize: number;
  tokens: { text: string; color: string }[];
  tokenIndex: number;
  opacity: number;
  blur: number;
  trail: { text: string; color: string; y: number; opacity: number }[];
  sizeTier: SizeTier;
  strikeout: number;
  strikeoutText: string;
  strikeoutOrigColor: string;
  strikeoutY: number;
  editing: number;
  editOrigText: string;
  editNewText: string;
  editOrigColor: string;
  editNewColor: string;
  editY: number;
  codeblock: number;
  codeblockIdx: number;
  codeblockY: number;
}

function pickSizeTier(): SizeTier {
  const r = Math.random();
  if (r < 0.14) return 'large';   // More large blurred elements (was 0.08)
  if (r < 0.28) return 'tiny';
  return 'normal';
}

function applyTier(col: Partial<RainColumn>, tier: SizeTier) {
  switch (tier) {
    case 'large':
      col.fontSize = 22 + Math.random() * 14;   // Larger sizes (was 18+8)
      col.opacity = 0.03 + Math.random() * 0.05;
      col.speed = 0.15 + Math.random() * 0.35;  // Slower drift
      col.blur = 4 + Math.random() * 6;          // More blur for depth
      break;
    case 'tiny':
      col.fontSize = 6 + Math.random() * 3;
      col.opacity = 0.06 + Math.random() * 0.10;
      col.speed = 0.6 + Math.random() * 1.4;
      col.blur = 0.5 + Math.random() * 2;
      break;
    default:
      col.fontSize = 10 + Math.random() * 4;
      col.opacity = 0.08 + Math.random() * 0.14;  // Slightly less opaque
      col.blur = Math.random() < 0.4 ? (0.5 + Math.random() * 2) : 0;  // More blur variety (was 0.25)
      col.speed = 0.25 + Math.random() * 0.9;     // Slower overall, more varied
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

function createColumn(canvasWidth: number, canvasHeight: number): RainColumn {
  const tier = pickSizeTier();
  const tokenCount = 4 + Math.floor(Math.random() * 6);
  const tokens: { text: string; color: string }[] = [];
  for (let i = 0; i < tokenCount; i++) {
    tokens.push(TOKEN_POOL[Math.floor(Math.random() * TOKEN_POOL.length)]);
  }

  const col: RainColumn = {
    x: Math.random() * canvasWidth,
    y: -Math.random() * canvasHeight,
    speed: 0,
    fontSize: 0,
    tokens,
    tokenIndex: 0,
    opacity: 0,
    blur: 0,
    trail: [],
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
  applyTier(col, tier);
  return col;
}

// ═══════════════════════════════════════════════════════════════════════
// Canvas rain component — original background + piñata overlay
// ═══════════════════════════════════════════════════════════════════════

export function CodeRainCanvas({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const columnsRef = useRef<RainColumn[]>([]);
  const pinataRef = useRef<PinataParticle[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Pre-cached values to avoid per-frame allocation
    let cachedW = window.innerWidth;
    let cachedH = window.innerHeight;

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
      const colCount = Math.floor(cachedW / 42); // Fewer columns for less chaos
      columnsRef.current = [];
      for (let i = 0; i < colCount; i++) {
        columnsRef.current.push(createColumn(cachedW, cachedH));
      }
    }

    resize();
    window.addEventListener('resize', resize);

    // ── Piñata event listener ──
    function onPinata(e: Event) {
      const { x, y, count } = (e as CustomEvent).detail;
      const current = pinataRef.current.length;
      const toAdd = Math.min(count, PINATA_MAX - current);
      for (let i = 0; i < toAdd; i++) {
        pinataRef.current.push(createPinataParticle(x, y));
      }
    }
    window.addEventListener('pfc-pinata', onPinata);

    // Cached search-bar rect
    const STRIKEOUT_SPEED = 1 / 110;     // Slower animation (was /90)
    const STRIKEOUT_CHANCE = 0.0008;     // Less frequent (was 0.0015)
    const EDIT_SPEED = 1 / 180;          // Slower typing (was /140)
    const EDIT_CHANCE = 0.0006;          // Less frequent (was 0.001)
    const CODEBLOCK_SPEED = 1 / 260;    // Slower block typing (was /200)
    const CODEBLOCK_CHANCE = 0.00025;   // Less frequent (was 0.0004)
    let cursorClock = 0;

    const blurCache = new Map<number, string>();
    const fontCache = new Map<number, string>();
    const measureCache = new Map<string, number>();

    function getBlurFilter(blur: number): string {
      const key = Math.round(blur * 10);
      let v = blurCache.get(key);
      if (!v) { v = `blur(${blur}px)`; blurCache.set(key, v); }
      return v;
    }

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

    // Cache search bar rect outside rAF loop via ResizeObserver
    let searchBarRect: DOMRect | null = null;
    const searchBarEl = document.querySelector('[data-search-bar]');
    if (searchBarEl) searchBarRect = searchBarEl.getBoundingClientRect();
    const searchBarObserver = new ResizeObserver(() => {
      const el = document.querySelector('[data-search-bar]');
      searchBarRect = el ? el.getBoundingClientRect() : null;
    });
    if (searchBarEl) searchBarObserver.observe(searchBarEl);
    // Also update on scroll/resize
    const updateSearchBarRect = () => {
      const el = document.querySelector('[data-search-bar]');
      searchBarRect = el ? el.getBoundingClientRect() : null;
    };
    window.addEventListener('scroll', updateSearchBarRect, { passive: true });

    const PINATA_MAX_PARTICLES = 40;

    function draw(timestamp: number) {
      if (!canvas || !ctx) return;
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
      // LAYER 1: Background rain columns
      // ════════════════════════════════════════════════════════════

      for (const col of columnsRef.current) {
        col.y += col.speed * dt;

        const token = col.tokens[col.tokenIndex % col.tokens.length];
        ctx.font = getFont(col.fontSize);

        const isIdle = col.strikeout === 0 && col.editing === 0 && col.codeblock === 0;

        // Merge animation trigger checks into single branch
        if (isIdle && col.sizeTier === 'normal' && col.y > 0 && col.y < h) {
          const r = Math.random();
          if (r < STRIKEOUT_CHANCE) {
            col.strikeout = 0.001;
            col.strikeoutText = token.text;
            col.strikeoutOrigColor = token.color;
            col.strikeoutY = col.y;
          } else if (r < STRIKEOUT_CHANCE + EDIT_CHANCE) {
            let replacement = TOKEN_POOL[Math.floor(Math.random() * TOKEN_POOL.length)];
            for (let a = 0; a < 3 && replacement.text === token.text; a++) {
              replacement = TOKEN_POOL[Math.floor(Math.random() * TOKEN_POOL.length)];
            }
            col.editing = 0.001;
            col.editOrigText = token.text;
            col.editOrigColor = token.color;
            col.editNewText = replacement.text;
            col.editNewColor = replacement.color;
            col.editY = col.y;
          } else if (col.y > 40 && col.y < h - 100 && Math.random() < CODEBLOCK_CHANCE) {
            col.codeblock = 0.001;
            col.codeblockIdx = Math.floor(Math.random() * CODE_SNIPPETS.length);
            col.codeblockY = col.y;
          }
        }

        // ── Strikeout animation ──
        if (col.strikeout > 0) {
          const p = col.strikeout;
          const colorT = easeInOut(Math.min(p / 0.4, 1));
          const drawColor = lerpColor(col.strikeoutOrigColor, STRIKEOUT_RED, colorT);
          const fadeOut = p > 0.7 ? 1 - easeInOut((p - 0.7) / 0.3) : 1;
          const strikeAlpha = (isDark ? 0.55 : 0.45) * fadeOut;

          ctx.save();
          if (col.blur > 0) ctx.filter = getBlurFilter(col.blur);
          ctx.fillStyle = drawColor;
          ctx.globalAlpha = strikeAlpha;
          ctx.font = getFont(col.fontSize);
          ctx.fillText(col.strikeoutText, col.x, col.strikeoutY);

          if (p > 0.3) {
            const lineProgress = easeInOut(Math.min((p - 0.3) / 0.4, 1));
            const textWidth = getMeasure(col.strikeoutText, col.fontSize);
            const lineY = col.strikeoutY - col.fontSize * 0.3;
            ctx.strokeStyle = STRIKEOUT_RED;
            ctx.globalAlpha = strikeAlpha * 0.9;
            ctx.lineWidth = Math.max(1, col.fontSize * 0.08);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(col.x - 2, lineY);
            ctx.lineTo(col.x - 2 + (textWidth + 4) * lineProgress, lineY);
            ctx.stroke();
          }

          ctx.filter = 'none';
          ctx.restore();
          col.strikeout += STRIKEOUT_SPEED * dt;
          if (col.strikeout >= 1) col.strikeout = 0;
        }

        // ── Code-edit animation ──
        if (col.editing > 0) {
          const p = col.editing;
          const editAlpha = isDark ? 0.55 : 0.45;
          const origLen = col.editOrigText.length;
          const newLen = col.editNewText.length;

          let displayText = '';
          let displayColor = col.editOrigColor;
          let cursorX = 0;
          let showCursor = cursorOn;
          let fadeAlpha = 1;

          if (p < 0.08) {
            displayText = col.editOrigText;
            displayColor = col.editOrigColor;
          } else if (p < 0.38) {
            const deleteProgress = (p - 0.08) / 0.30;
            const charsRemaining = Math.max(0, origLen - Math.floor(deleteProgress * origLen));
            displayText = col.editOrigText.slice(0, charsRemaining);
            displayColor = col.editOrigColor;
          } else if (p < 0.45) {
            displayText = '';
          } else if (p < 0.85) {
            const typeProgress = (p - 0.45) / 0.40;
            const charsTyped = Math.min(newLen, Math.floor(typeProgress * (newLen + 1)));
            displayText = col.editNewText.slice(0, charsTyped);
            displayColor = col.editNewColor;
          } else {
            displayText = col.editNewText;
            displayColor = col.editNewColor;
            fadeAlpha = 1 - easeInOut((p - 0.85) / 0.15);
            showCursor = false;
          }

          ctx.save();
          if (col.blur > 0) ctx.filter = getBlurFilter(col.blur);
          ctx.font = getFont(col.fontSize);

          if (displayText.length > 0) {
            ctx.fillStyle = displayColor;
            ctx.globalAlpha = editAlpha * fadeAlpha;
            ctx.fillText(displayText, col.x, col.editY);
            cursorX = col.x + getMeasure(displayText, col.fontSize);
          } else {
            cursorX = col.x;
          }

          if (showCursor) {
            const cursorH = col.fontSize * 0.85;
            const cursorY = col.editY - cursorH + col.fontSize * 0.15;
            ctx.fillStyle = CURSOR_COLOR;
            ctx.globalAlpha = editAlpha * fadeAlpha * 0.8;
            ctx.fillRect(cursorX + 1, cursorY, Math.max(1, col.fontSize * 0.07), cursorH);
          }

          ctx.filter = 'none';
          ctx.restore();
          col.editing += EDIT_SPEED * dt;
          if (col.editing >= 1) col.editing = 0;
        }

        // ── Code block typewriter ──
        if (col.codeblock > 0) {
          const p = col.codeblock;
          const snippet = CODE_SNIPPETS[col.codeblockIdx % CODE_SNIPPETS.length];
          const blockFontSize = 8;
          const lineH = blockFontSize * 1.5;

          let totalChars = 0;
          for (const line of snippet) totalChars += line.text.length;

          const bgFadeIn = Math.min(p / 0.05, 1);
          const fadeOut = p > 0.85 ? 1 - easeInOut((p - 0.85) / 0.15) : 1;
          const blockAlpha = (isDark ? 0.5 : 0.4) * bgFadeIn * fadeOut;

          ctx.save();
          ctx.font = getFont(blockFontSize);

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

              const ly = col.codeblockY + li * lineH;
              ctx.fillStyle = line.color;
              ctx.globalAlpha = blockAlpha;
              ctx.fillText(visibleText, col.x, ly);

              if (visibleChars < line.text.length && cursorOn && fadeOut > 0.5) {
                const cw = getMeasure(visibleText, 8);
                ctx.fillStyle = CURSOR_COLOR;
                ctx.globalAlpha = blockAlpha * 0.7;
                ctx.fillRect(col.x + cw + 1, ly - blockFontSize * 0.7, 1, blockFontSize * 0.85);
              }
            }
          }

          ctx.restore();
          col.codeblock += CODEBLOCK_SPEED * dt;
          if (col.codeblock >= 1) col.codeblock = 0;
        }

        // ── Normal token drawing ──
        if (col.strikeout === 0 && col.editing === 0 && col.codeblock === 0) {
          const alpha = isDark ? col.opacity * 0.9 : col.opacity * 0.65;
          ctx.fillStyle = token.color;
          ctx.globalAlpha = Math.min(alpha, 1);

          if (col.blur > 0) ctx.filter = getBlurFilter(col.blur);
          ctx.fillText(token.text, col.x, col.y);
          if (col.blur > 0) ctx.filter = 'none';
        }

        if (Math.random() < 0.02) col.tokenIndex++;

        if (col.y > h + 50) {
          const tier = pickSizeTier();
          col.sizeTier = tier;
          applyTier(col, tier);
          col.y = -Math.random() * 200 - 50;
          col.x = Math.random() * w;
          col.tokenIndex = Math.floor(Math.random() * col.tokens.length);
          col.strikeout = 0;
          col.editing = 0;
          col.codeblock = 0;
        }
      }

      // ════════════════════════════════════════════════════════════
      // LAYER 2: Piñata particles (separate ragdoll physics)
      // ════════════════════════════════════════════════════════════

      // searchBarRect updated outside rAF via ResizeObserver + scroll listener

      const particles = pinataRef.current;
      // Hard cap particle count to prevent lag spikes
      while (particles.length > PINATA_MAX_PARTICLES) particles.pop();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Physics
        p.vy += PINATA_GRAVITY * dt;
        p.vx *= 0.998;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotVel * dt;

        // Life countdown
        p.life -= dtSec;
        if (p.life <= 0) { particles.splice(i, 1); continue; }

        // Search bar collision
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

        // Off screen removal
        if (p.y > h + 60 || p.x < -80 || p.x > w + 80) {
          particles.splice(i, 1);
          continue;
        }

        // Alpha with fade-in/out
        const age = p.maxLife - p.life;
        const fadeIn = Math.min(1, age / 0.15);
        const fadeOut = p.life < 2 ? p.life / 2 : 1;
        const alpha = p.opacity * fadeIn * fadeOut;

        // Draw with rotation — use setTransform instead of save/restore
        const cos = Math.cos(p.rotation);
        const sin = Math.sin(p.rotation);
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(cos * dpr, sin * dpr, -sin * dpr, cos * dpr, p.x * dpr, p.y * dpr);
        ctx.font = getFont(p.fontSize);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillText(p.text, 0, 0);
      }

      // Reset transform and alpha after particle loop
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pfc-pinata', onPinata);
      window.removeEventListener('scroll', updateSearchBarRect);
      searchBarObserver.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Vignette overlay
// ═══════════════════════════════════════════════════════════════════════

export function CodeRainOverlays({ isDark }: { isDark: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: isDark
          ? 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.92) 100%)'
          : 'radial-gradient(ellipse at center, transparent 30%, rgba(240,232,222,0.92) 100%)',
      }}
    />
  );
}
