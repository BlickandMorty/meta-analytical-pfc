import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { useTheme } from '../shared/theme';

// --- Original research symbols ---
const SYMBOLS = [
  'μ', 'σ', 'I²', 'τ²', 'β₀', 'β₁', 'DAG', 'RCT', 'BF', 'θ',
  'CI', 'SE', 'MCMC', 'PD', 'HR', 'Π', 'δ', 'H₀', 'H₁', 'λ',
  'ℓ', 'p', 'n', 'd', 'ω', 'χ²', 'F', 'AIC', 'BIC', 'ρ',
];

// --- AI training algorithm phrases ---
const AI_PHRASES = [
  'SGD', 'Adam', 'backprop', '∇L', 'softmax', 'attn(Q,K,V)', 'ReLU',
  'dropout(p)', 'RLHF', 'PPO', 'DPO', 'KL-div', 'x-entropy', 'LayerNorm',
  'BatchNorm', 'conv2d', 'transformer', 'BERT', 'GPT', 'LoRA', 'QLoRA',
  '∂L/∂w', 'argmax', 'beam(k)', 'top-p', 'top-k', 'ε-greedy', 'Q(s,a)',
  'π(a|s)', 'V(s)', 'A(s,a)', 'GELU', 'SiLU', 'MHA', 'FFN', 'ResNet',
  'skip-conn', 'cosine-lr', 'warmup', 'grad-clip', 'fp16', 'bf16',
];

type SymbolCategory = 'math' | 'topology' | 'stat' | 'ai';

function categorize(sym: string): SymbolCategory {
  if (AI_PHRASES.includes(sym)) return 'ai';
  if (['β₀', 'β₁', 'H₀', 'H₁', 'DAG', 'ℓ'].includes(sym)) return 'topology';
  if (['μ', 'σ', 'θ', 'Π', 'δ', 'λ', 'ω', 'ρ'].includes(sym)) return 'math';
  return 'stat';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  speed: number;
  symbol: string;
  opacity: number;
  fontSize: number;
  category: SymbolCategory;
}

const PARTICLE_COUNT = 45;

// ~60% original symbols, ~40% AI phrases
const ALL_ITEMS = [...SYMBOLS, ...SYMBOLS, ...AI_PHRASES]; // double symbols for 60/40 ratio

function createParticle(id: number, screenWidth: number, screenHeight: number, randomY = false): Particle {
  const sym = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
  const cat = categorize(sym);
  const isAI = cat === 'ai';

  return {
    id,
    x: Math.random() * screenWidth,
    y: randomY ? Math.random() * screenHeight : -(Math.random() * 100),
    speed: isAI ? 15 + Math.random() * 20 : 20 + Math.random() * 40,
    symbol: sym,
    opacity: isAI ? 0.06 + Math.random() * 0.12 : 0.1 + Math.random() * 0.25,
    fontSize: isAI ? 7 + Math.random() * 4 : 8 + Math.random() * 6,
    category: cat,
  };
}

export function ResearchRain() {
  const { colors, fonts } = useTheme();
  const { width, height } = Dimensions.get('window');

  const categoryColorMap: Record<SymbolCategory, string> = {
    math: colors.semantic.info,
    topology: colors.brand.accent,
    stat: colors.semantic.success,
    ai: colors.brand.primary,
  };

  const [particles, setParticles] = useState<Particle[]>(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => createParticle(i, width, height, true))
  );
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const particlesRef = useRef(particles);
  particlesRef.current = particles;

  const tick = useCallback((time: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time;
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = time;

    setParticles((prev) =>
      prev.map((p) => {
        let newY = p.y + p.speed * dt;
        if (newY > height + 20) {
          return createParticle(p.id, width, height, false);
        }
        return { ...p, y: newY };
      })
    );

    rafRef.current = requestAnimationFrame(tick);
  }, [width, height]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <Text
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            fontFamily: fonts.mono,
            fontSize: p.fontSize,
            color: categoryColorMap[p.category],
            opacity: p.opacity,
          }}
        >
          {p.symbol}
        </Text>
      ))}
    </View>
  );
}
