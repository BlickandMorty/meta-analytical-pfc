'use client';

import { useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Brain Mascot — 2D pixel-cartoony brain with detailed folds

   Design:
   • Flat 2D brain with lighter realistic pink gradient
   • More detailed brain folds/sulci for anatomical feel
   • Large cartoonish eyes with pupils that track cursor
   • Tiny round glasses, subtle smile
   • Fluid spring physics for body follow + pupil tracking
   • Click = smooth knockback + piñata burst
   • All animation via refs (zero React re-renders per frame)
   ═══════════════════════════════════════════════════════════════ */

interface BrainMascotProps {
  isDark: boolean;
  size?: number;
  mini?: boolean;
}

export function BrainMascot({ isDark, size = 48, mini = false }: BrainMascotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const stateRef = useRef({
    offsetX: 0,
    offsetY: 0,
    velX: 0,
    velY: 0,
    pupilX: 0,
    pupilY: 0,
    targetPupilX: 0,
    targetPupilY: 0,
    knockback: false,
    knockTimer: 0,
    homeX: 0,
    homeY: 0,
    homeSet: false,
    breathPhase: 0,
  });

  useEffect(() => {
    function onMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    // Cache SVG element refs once — avoids querySelector per frame
    let lp: SVGCircleElement | null = null;
    let rp: SVGCircleElement | null = null;
    let lh: SVGCircleElement | null = null;
    let rh: SVGCircleElement | null = null;
    let refsSet = false;

    function tick() {
      const el = containerRef.current;
      if (!el) { rafRef.current = requestAnimationFrame(tick); return; }

      if (!refsSet) {
        lp = el.querySelector('#bp-lp');
        rp = el.querySelector('#bp-rp');
        lh = el.querySelector('#bp-lh');
        rh = el.querySelector('#bp-rh');
        refsSet = true;
      }

      if (!state.homeSet) {
        const rect = el.getBoundingClientRect();
        state.homeX = rect.left + rect.width / 2;
        state.homeY = rect.top + rect.height / 2;
        state.homeSet = true;
      }

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const dx = mx - state.homeX;
      const dy = my - state.homeY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Smooth pupil tracking with lerp
      const maxPupil = mini ? 1.5 : 3.0;
      const pupilStrength = Math.min(dist / 80, 1);
      state.targetPupilX = (dx / dist) * maxPupil * pupilStrength;
      state.targetPupilY = (dy / dist) * maxPupil * pupilStrength;
      state.pupilX += (state.targetPupilX - state.pupilX) * 0.12;
      state.pupilY += (state.targetPupilY - state.pupilY) * 0.12;

      if (!mini) {
        // Spring body follow
        const followRange = 140;
        const maxOffset = 18;
        const springK = 0.05;
        const damping = 0.82;

        let targetX = 0;
        let targetY = 0;

        if (dist < followRange) {
          const strength = 1 - dist / followRange;
          targetX = Math.max(-maxOffset, Math.min(maxOffset, dx * strength * 0.3));
          targetY = Math.max(-maxOffset, Math.min(maxOffset, dy * strength * 0.3));
        }

        state.velX += (targetX - state.offsetX) * springK;
        state.velY += (targetY - state.offsetY) * springK;
        state.velX *= damping;
        state.velY *= damping;
        state.offsetX += state.velX;
        state.offsetY += state.velY;

        if (state.knockback) {
          state.knockTimer -= 16;
          if (state.knockTimer <= 0) state.knockback = false;
        }
      }

      // Breathing animation
      state.breathPhase += 0.02;
      const breathScale = 1 + Math.sin(state.breathPhase) * 0.008;

      const scale = state.knockback ? 0.88 * breathScale : breathScale;
      const rot = state.knockback ? -8 : Math.sin(state.breathPhase * 0.7) * 0.5;
      el.style.transform = mini
        ? `scale(${breathScale})`
        : `translate(${state.offsetX}px, ${state.offsetY}px) scale(${scale}) rotate(${rot}deg)`;

      // Update pupils via cached refs — direct SVG property access (no reflow)
      if (lp) { lp.cx.baseVal.value = 17 + state.pupilX; lp.cy.baseVal.value = 22 + state.pupilY; }
      if (rp) { rp.cx.baseVal.value = 33 + state.pupilX; rp.cy.baseVal.value = 22 + state.pupilY; }
      if (lh) { lh.cx.baseVal.value = 15.8 + state.pupilX * 0.6; lh.cy.baseVal.value = 20.5 + state.pupilY * 0.6; }
      if (rh) { rh.cx.baseVal.value = 31.8 + state.pupilX * 0.6; rh.cy.baseVal.value = 20.5 + state.pupilY * 0.6; }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mini]);

  useEffect(() => {
    function onResize() { stateRef.current.homeSet = false; }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleClick = useCallback(() => {
    if (mini) return;
    const el = containerRef.current;
    if (!el) return;
    const state = stateRef.current;

    state.knockback = true;
    state.knockTimer = 200;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const dxc = state.homeX + state.offsetX - mx;
    const dyc = state.homeY + state.offsetY - my;
    const d = Math.sqrt(dxc * dxc + dyc * dyc) || 1;
    state.velX += (dxc / d) * 2.5;
    state.velY += (dyc / d) * 2.5;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 6 + Math.floor(Math.random() * 8);
    window.dispatchEvent(new CustomEvent('pfc-pinata', {
      detail: { x: cx, y: cy, count },
    }));
  }, [mini]);

  const glowFilter = !isDark && !mini
    ? 'drop-shadow(0 0 6px rgba(216,160,170,0.25))'
    : 'none';

  const gid = mini ? 'm' : 'l';

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        width: size,
        height: size,
        cursor: mini ? 'default' : 'pointer',
        flexShrink: 0,
        filter: glowFilter,
        willChange: 'transform',
      }}
    >
      <svg viewBox="0 0 50 50" width={size} height={size} style={{ overflow: 'visible' }}>
        <defs>
          {/* Lighter realistic brain pink gradient */}
          <radialGradient id={`bgrd-${gid}`} cx="45%" cy="35%">
            <stop offset="0%" stopColor="#F5C6D0" />
            <stop offset="55%" stopColor="#E8A8B8" />
            <stop offset="100%" stopColor="#D98FA0" />
          </radialGradient>
          <radialGradient id={`bgls-${gid}`} cx="30%" cy="20%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.30)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Brain body — organic shape with two hemispheres + dark outline for 2D feel */}
        <path
          d="M25 6 C15 6, 6 13, 6 23 C6 29, 9 34, 14 37 C16 38.5, 19 40, 25 40 C31 40, 34 38.5, 36 37 C41 34, 44 29, 44 23 C44 13, 35 6, 25 6 Z"
          fill={`url(#bgrd-${gid})`}
          stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(140,80,100,0.18)'}
          strokeWidth="0.6"
        />
        <path
          d="M25 6 C15 6, 6 13, 6 23 C6 29, 9 34, 14 37 C16 38.5, 19 40, 25 40 C31 40, 34 38.5, 36 37 C41 34, 44 29, 44 23 C44 13, 35 6, 25 6 Z"
          fill={`url(#bgls-${gid})`}
        />

        {/* ─── Central fissure ─── */}
        <path d="M25 7.5 C24.8 12, 25.2 18, 25 24 C24.8 30, 25.2 35, 25 39"
          stroke="rgba(160,70,90,0.22)" fill="none" strokeWidth="1.1" strokeLinecap="round" />

        {/* ─── Brain folds - left hemisphere (detailed sulci) ─── */}
        <path d="M9 15 Q14 12, 21 15" stroke="rgba(160,70,90,0.18)" fill="none" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M8 20 Q14 17, 23 19" stroke="rgba(160,70,90,0.16)" fill="none" strokeWidth="0.75" strokeLinecap="round" />
        <path d="M7 26 Q13 23, 24 25.5" stroke="rgba(160,70,90,0.15)" fill="none" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M9 31 Q15 28, 24 30" stroke="rgba(160,70,90,0.14)" fill="none" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M12 35 Q18 33, 24 35" stroke="rgba(160,70,90,0.12)" fill="none" strokeWidth="0.6" strokeLinecap="round" />
        {/* Diagonal secondary folds — left */}
        <path d="M10 17 Q12 20, 10 24" stroke="rgba(160,70,90,0.10)" fill="none" strokeWidth="0.5" strokeLinecap="round" />
        <path d="M15 12 Q16 16, 14 20" stroke="rgba(160,70,90,0.10)" fill="none" strokeWidth="0.5" strokeLinecap="round" />
        <path d="M20 10 Q19 14, 20 18" stroke="rgba(160,70,90,0.09)" fill="none" strokeWidth="0.45" strokeLinecap="round" />

        {/* ─── Brain folds - right hemisphere (detailed sulci) ─── */}
        <path d="M29 15 Q36 12, 41 15" stroke="rgba(160,70,90,0.18)" fill="none" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M27 19 Q36 17, 42 20" stroke="rgba(160,70,90,0.16)" fill="none" strokeWidth="0.75" strokeLinecap="round" />
        <path d="M26 25.5 Q37 23, 43 26" stroke="rgba(160,70,90,0.15)" fill="none" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M26 30 Q35 28, 41 31" stroke="rgba(160,70,90,0.14)" fill="none" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M26 35 Q32 33, 38 35" stroke="rgba(160,70,90,0.12)" fill="none" strokeWidth="0.6" strokeLinecap="round" />
        {/* Diagonal secondary folds — right */}
        <path d="M40 17 Q38 20, 40 24" stroke="rgba(160,70,90,0.10)" fill="none" strokeWidth="0.5" strokeLinecap="round" />
        <path d="M35 12 Q34 16, 36 20" stroke="rgba(160,70,90,0.10)" fill="none" strokeWidth="0.5" strokeLinecap="round" />
        <path d="M30 10 Q31 14, 30 18" stroke="rgba(160,70,90,0.09)" fill="none" strokeWidth="0.45" strokeLinecap="round" />

        {/* ─── Eyes — bigger, more cartoonish ─── */}
        {/* White sclera — larger */}
        <ellipse cx="17" cy="22" rx="5.2" ry="4.8" fill="white"
          stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(100,50,60,0.08)'} strokeWidth="0.3" />
        <ellipse cx="33" cy="22" rx="5.2" ry="4.8" fill="white"
          stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(100,50,60,0.08)'} strokeWidth="0.3" />

        {/* Pupils — larger (animated via DOM) */}
        <circle id="bp-lp" cx="17" cy="22" r="2.6" fill="#2D1B35" />
        <circle id="bp-rp" cx="33" cy="22" r="2.6" fill="#2D1B35" />

        {/* Pupil highlights — bigger for cartoony sparkle */}
        <circle id="bp-lh" cx="15.8" cy="20.5" r="0.9" fill="white" />
        <circle id="bp-rh" cx="31.8" cy="20.5" r="0.9" fill="white" />

        {/* ─── Glasses — thin round frames ─── */}
        <circle cx="17" cy="22" r="6.5" fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.30)' : 'rgba(60,30,50,0.22)'} strokeWidth="0.75" />
        <circle cx="33" cy="22" r="6.5" fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.30)' : 'rgba(60,30,50,0.22)'} strokeWidth="0.75" />
        {/* Bridge */}
        <path d="M23.2 22.5 Q25 21, 26.8 22.5"
          stroke={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(60,30,50,0.18)'} fill="none" strokeWidth="0.65" />
        {/* Arms */}
        <line x1="10.5" y1="21" x2="7" y2="18.5"
          stroke={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(60,30,50,0.12)'} strokeWidth="0.65" strokeLinecap="round" />
        <line x1="39.5" y1="21" x2="43" y2="18.5"
          stroke={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(60,30,50,0.12)'} strokeWidth="0.65" strokeLinecap="round" />

        {/* ─── Mouth — gentle smile ─── */}
        <path d="M21 31.5 Q25 34 29 31.5"
          stroke={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(120,50,70,0.25)'}
          fill="none" strokeWidth="0.85" strokeLinecap="round" />
      </svg>
    </div>
  );
}
