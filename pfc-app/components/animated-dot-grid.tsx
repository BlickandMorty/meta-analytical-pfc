'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

// ── Subtle code tokens for chat background rain ──
const SUBTLE_TOKENS = [
  { text: 'const', color: '#8B7CF6' },
  { text: 'async', color: '#8B7CF6' },
  { text: 'return', color: '#8B7CF6' },
  { text: 'type', color: '#8B7CF6' },
  { text: 'if', color: '#8B7CF6' },
  { text: 'for', color: '#8B7CF6' },
  { text: 'runPipeline()', color: '#E07850' },
  { text: 'calibrate()', color: '#E07850' },
  { text: 'synthesize()', color: '#E07850' },
  { text: 'assessTruth()', color: '#E07850' },
  { text: '"confidence"', color: '#4ADE80' },
  { text: '"entropy"', color: '#4ADE80' },
  { text: '"bayesian"', color: '#4ADE80' },
  { text: '0.95', color: '#22D3EE' },
  { text: '0.73', color: '#22D3EE' },
  { text: '256', color: '#22D3EE' },
  { text: 'StageResult', color: '#FACC15' },
  { text: 'DualMessage', color: '#FACC15' },
  { text: '=>', color: '#9CA3AF' },
  { text: '...', color: '#9CA3AF' },
  { text: '// meta-analysis', color: '#86EFAC' },
  { text: '// bayesian', color: '#86EFAC' },
];

interface FallingToken {
  x: number;
  y: number;
  speed: number;
  fontSize: number;
  text: string;
  color: string;
  opacity: number;
}

function createFallingToken(w: number, h: number): FallingToken {
  const token = SUBTLE_TOKENS[Math.floor(Math.random() * SUBTLE_TOKENS.length)];
  return {
    x: Math.random() * w,
    y: -Math.random() * h - 20,
    speed: 0.15 + Math.random() * 0.4,
    fontSize: 8 + Math.random() * 3,
    text: token.text,
    color: token.color,
    opacity: 0.04 + Math.random() * 0.08,
  };
}

/**
 * Animated dot grid + subtle falling syntax background.
 * Uses canvas for performance. Covers full parent area.
 */
export function AnimatedDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);
  const mountedRef = useRef(false);
  const tokensRef = useRef<FallingToken[]>([]);

  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    mountedRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationId: number;

    // Dot grid parameters
    const spacing = 24;
    const baseDotRadius = 1.0;
    const waveSpeed = 0.0008;
    const waveAmplitude = 0.6;
    const driftAmplitude = 1.2;
    const driftSpeed = 0.0004;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      // Use getBoundingClientRect for accurate full-area coverage
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Init falling tokens — sparse, subtle
      const tokenCount = Math.max(6, Math.floor(w / 55));
      tokensRef.current = [];
      for (let i = 0; i < tokenCount; i++) {
        tokensRef.current.push(createFallingToken(w, h));
      }
    }

    resize();
    window.addEventListener('resize', resize);

    function draw(timestamp: number) {
      if (!canvas || !ctx) return;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      const isDark = themeRef.current === 'dark';

      ctx.clearRect(0, 0, w, h);

      // ── Layer 1: Dot grid ──
      const cols = Math.ceil(w / spacing) + 2;
      const rows = Math.ceil(h / spacing) + 2;

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const baseX = col * spacing;
          const baseY = row * spacing;

          const phase = (col * 0.4 + row * 0.3);
          const driftX = Math.sin(timestamp * driftSpeed + phase) * driftAmplitude;
          const driftY = Math.cos(timestamp * driftSpeed * 0.7 + phase * 1.3) * driftAmplitude;

          const x = baseX + driftX;
          const y = baseY + driftY;

          const wave = Math.sin(timestamp * waveSpeed + col * 0.15 + row * 0.12);
          const opacityBase = isDark ? 0.12 : 0.18;
          const opacityVariation = wave * waveAmplitude * (isDark ? 0.06 : 0.08);
          const opacity = Math.max(0.02, opacityBase + opacityVariation);

          const sizeWave = Math.sin(timestamp * waveSpeed * 1.3 + col * 0.2 + row * 0.18);
          const radius = baseDotRadius + sizeWave * 0.3;

          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.3, radius), 0, Math.PI * 2);
          ctx.fillStyle = isDark
            ? `rgba(160, 160, 180, ${opacity})`
            : `rgba(80, 80, 100, ${opacity})`;
          ctx.fill();
        }
      }

      // ── Layer 2: Subtle falling syntax tokens ──
      ctx.save();
      for (const token of tokensRef.current) {
        token.y += token.speed;

        ctx.font = `${token.fontSize}px "Geist Mono", ui-monospace, monospace`;
        ctx.globalAlpha = isDark ? token.opacity * 1.3 : token.opacity * 0.7;
        ctx.fillStyle = token.color;
        ctx.fillText(token.text, token.x, token.y);

        // Reset when off screen
        if (token.y > h + 30) {
          token.y = -20 - Math.random() * 100;
          token.x = Math.random() * w;
          token.speed = 0.15 + Math.random() * 0.4;
          const newToken = SUBTLE_TOKENS[Math.floor(Math.random() * SUBTLE_TOKENS.length)];
          token.text = newToken.text;
          token.color = newToken.color;
          token.opacity = 0.04 + Math.random() * 0.08;
        }
      }
      ctx.restore();

      animationId = requestAnimationFrame(draw);
    }

    animationId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
      mountedRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  );
}
