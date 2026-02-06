'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

// ── Code tokens with syntax-highlighting colors ──
const TOKENS = [
  // Keywords (purple)
  { text: 'const', color: '#8B7CF6' },
  { text: 'async', color: '#8B7CF6' },
  { text: 'return', color: '#8B7CF6' },
  { text: 'type', color: '#8B7CF6' },
  { text: 'if', color: '#8B7CF6' },
  { text: 'for', color: '#8B7CF6' },
  { text: 'let', color: '#8B7CF6' },
  { text: 'import', color: '#8B7CF6' },
  { text: 'export', color: '#8B7CF6' },
  { text: 'await', color: '#8B7CF6' },
  { text: 'function', color: '#8B7CF6' },
  { text: 'interface', color: '#8B7CF6' },
  // Function calls (ember/orange)
  { text: 'runPipeline()', color: '#E07850' },
  { text: 'calibrate()', color: '#E07850' },
  { text: 'synthesize()', color: '#E07850' },
  { text: 'assessTruth()', color: '#E07850' },
  { text: 'analyze()', color: '#E07850' },
  { text: 'updateSignals()', color: '#E07850' },
  { text: 'generateReport()', color: '#E07850' },
  { text: 'adversarialReview()', color: '#E07850' },
  // Strings (green)
  { text: '"confidence"', color: '#4ADE80' },
  { text: '"entropy"', color: '#4ADE80' },
  { text: '"bayesian"', color: '#4ADE80' },
  { text: '"pipeline"', color: '#4ADE80' },
  { text: '"synthesis"', color: '#4ADE80' },
  { text: '"causal"', color: '#4ADE80' },
  // Numbers (cyan)
  { text: '0.95', color: '#22D3EE' },
  { text: '0.73', color: '#22D3EE' },
  { text: '256', color: '#22D3EE' },
  { text: '0.42', color: '#22D3EE' },
  { text: '1024', color: '#22D3EE' },
  { text: '3.14', color: '#22D3EE' },
  { text: '0.001', color: '#22D3EE' },
  // Types (yellow)
  { text: 'StageResult', color: '#FACC15' },
  { text: 'DualMessage', color: '#FACC15' },
  { text: 'SignalUpdate', color: '#FACC15' },
  { text: 'TDASnapshot', color: '#FACC15' },
  { text: 'PipelineEvent', color: '#FACC15' },
  // Operators / punctuation (gray)
  { text: '=>', color: '#9CA3AF' },
  { text: '...', color: '#9CA3AF' },
  { text: '===', color: '#9CA3AF' },
  { text: '{ }', color: '#9CA3AF' },
  { text: '[ ]', color: '#9CA3AF' },
  { text: '??', color: '#9CA3AF' },
  { text: '|>', color: '#9CA3AF' },
  // Comments (soft green)
  { text: '// meta-analysis', color: '#86EFAC' },
  { text: '// bayesian update', color: '#86EFAC' },
  { text: '// adversarial pass', color: '#86EFAC' },
  { text: '// calibration', color: '#86EFAC' },
  { text: '// triage', color: '#86EFAC' },
];

// ── Depth layers define the parallax feel ──
// Each layer has a size range, speed range, and opacity range
// Far = small + slow + faint, Close = large + fast + brighter
interface DepthLayer {
  fontMin: number;
  fontMax: number;
  speedMin: number;
  speedMax: number;
  opacityMin: number;
  opacityMax: number;
  proportion: number; // fraction of total tokens in this layer
}

const DEPTH_LAYERS: DepthLayer[] = [
  // Far background — tiny, crawling, very faint
  { fontMin: 5, fontMax: 8, speedMin: 0.08, speedMax: 0.18, opacityMin: 0.02, opacityMax: 0.05, proportion: 0.30 },
  // Mid-far — small, slow
  { fontMin: 8, fontMax: 11, speedMin: 0.15, speedMax: 0.30, opacityMin: 0.03, opacityMax: 0.07, proportion: 0.25 },
  // Mid — medium
  { fontMin: 11, fontMax: 15, speedMin: 0.25, speedMax: 0.50, opacityMin: 0.04, opacityMax: 0.09, proportion: 0.20 },
  // Mid-close — larger, faster
  { fontMin: 15, fontMax: 20, speedMin: 0.40, speedMax: 0.70, opacityMin: 0.04, opacityMax: 0.08, proportion: 0.15 },
  // Close foreground — big, fast, slightly bolder
  { fontMin: 20, fontMax: 28, speedMin: 0.60, speedMax: 1.10, opacityMin: 0.03, opacityMax: 0.07, proportion: 0.10 },
];

interface FallingToken {
  x: number;
  y: number;
  speed: number;
  fontSize: number;
  text: string;
  color: string;
  opacity: number;
  drift: number;      // horizontal sway amplitude
  driftPhase: number;  // sway phase offset
  driftSpeed: number;  // sway speed
  blur: boolean;       // whether to apply slight blur (far tokens)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function createToken(w: number, h: number, startAbove: boolean): FallingToken {
  const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];

  // Pick a depth layer weighted by proportion
  let roll = Math.random();
  let layer = DEPTH_LAYERS[0];
  for (const l of DEPTH_LAYERS) {
    roll -= l.proportion;
    if (roll <= 0) { layer = l; break; }
  }

  const t = Math.random(); // interpolation within layer
  const fontSize = lerp(layer.fontMin, layer.fontMax, t);
  const speed = lerp(layer.speedMin, layer.speedMax, t);
  const opacity = lerp(layer.opacityMin, layer.opacityMax, Math.random());

  return {
    x: Math.random() * w,
    y: startAbove ? (-Math.random() * h * 1.5 - 20) : (Math.random() * h),
    speed,
    fontSize,
    text: token.text,
    color: token.color,
    opacity,
    drift: 0.2 + Math.random() * (fontSize > 15 ? 1.5 : 0.6),
    driftPhase: Math.random() * Math.PI * 2,
    driftSpeed: 0.0003 + Math.random() * 0.0008,
    blur: fontSize < 9,
  };
}

/**
 * Immersive falling syntax rain background.
 * Multi-depth parallax — small/faint tokens feel distant, large ones feel close.
 * Uses canvas for performance. Covers full parent area.
 */
export function AnimatedDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);
  const tokensRef = useRef<FallingToken[]>([]);

  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationId: number;

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Dense token count — scales with screen area
      // Roughly 1 token per 2500px² → a 1920x1080 screen gets ~830 tokens
      const tokenCount = Math.max(40, Math.floor((w * h) / 2500));
      tokensRef.current = [];
      for (let i = 0; i < tokenCount; i++) {
        tokensRef.current.push(createToken(w, h, false));
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

      // Theme-based opacity multiplier
      const themeMul = isDark ? 1.4 : 0.8;

      for (const token of tokensRef.current) {
        // Move down
        token.y += token.speed;

        // Gentle horizontal sway
        const sway = Math.sin(timestamp * token.driftSpeed + token.driftPhase) * token.drift;

        const drawX = token.x + sway;
        const drawY = token.y;

        // Set font
        ctx.font = `${token.fontSize}px "Geist Mono", ui-monospace, monospace`;
        ctx.globalAlpha = Math.min(token.opacity * themeMul, 0.15);
        ctx.fillStyle = token.color;

        // Very far tokens get slight blur for depth
        if (token.blur) {
          ctx.filter = 'blur(0.5px)';
        } else {
          ctx.filter = 'none';
        }

        ctx.fillText(token.text, drawX, drawY);

        // Reset when off screen
        if (token.y > h + 40) {
          const newToken = TOKENS[Math.floor(Math.random() * TOKENS.length)];
          token.y = -10 - Math.random() * 80;
          token.x = Math.random() * w;
          token.text = newToken.text;
          token.color = newToken.color;
          token.driftPhase = Math.random() * Math.PI * 2;
        }
      }

      // Reset filter
      ctx.filter = 'none';
      ctx.globalAlpha = 1;

      animationId = requestAnimationFrame(draw);
    }

    animationId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
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
