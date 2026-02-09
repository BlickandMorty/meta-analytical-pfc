'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import {
  TerminalIcon,
  GitBranchIcon,
  SlidersHorizontalIcon,
  BookOpenIcon,
  WorkflowIcon,
  ActivityIcon,
  WrenchIcon,
  LockIcon,
  MonitorIcon,
  CpuIcon,
} from 'lucide-react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { PageShell, GlassSection } from '@/components/page-shell';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import { loadCachedDeviceProfile } from '@/lib/device-detection';
import type { DeviceProfile } from '@/lib/device-detection';
import { getSuiteTierFeatures } from '@/lib/research/types';
import type { SuiteTier } from '@/lib/research/types';

/* ═══════════════════════════════════════════════════════════
   Cupertino easing
   ═══════════════════════════════════════════════════════════ */
const CUPERTINO = [0.32, 0.72, 0, 1] as const;

/* ═══════════════════════════════════════════════════════════
   Animation variants
   ═══════════════════════════════════════════════════════════ */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.5,
      ease: CUPERTINO as unknown as [number, number, number, number],
    },
  },
};

/* ═══════════════════════════════════════════════════════════
   Tool card type
   ═══════════════════════════════════════════════════════════ */
interface ToolCard {
  id: string;
  title: string;
  description: string;
  icon: typeof TerminalIcon;
  iconColor: string;
  href: string | null;
  status: 'available' | 'coming-soon' | 'requires-full';
}

/* ═══════════════════════════════════════════════════════════
   Tier color mapping
   ═══════════════════════════════════════════════════════════ */
const TIER_COLORS: Record<SuiteTier, string> = {
  notes: '#34D399',        // pfc-green
  programming: '#8B7CF6',  // pfc-violet
  full: '#E07850',         // pfc-ember
};

/* ═══════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════ */
export default function DevToolsPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile | null>(null);

  const programmingEnabled = usePFCStore((s) => s.programmingEnabled);
  const measurementEnabled = usePFCStore((s) => s.measurementEnabled);
  const suiteTier = usePFCStore((s) => s.suiteTier);

  useEffect(() => {
    setMounted(true);
    const cached = loadCachedDeviceProfile();
    if (cached) setDeviceProfile(cached);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const tierFeatures = getSuiteTierFeatures(suiteTier);
  const tierColor = TIER_COLORS[suiteTier] || TIER_COLORS.programming;

  /* ── Build tool cards ── */
  const tools: ToolCard[] = [
    {
      id: 'code-analyzer',
      title: 'Code Language Analyzer',
      description: 'Find the best language for your project. Compare performance, ecosystem, and DX.',
      icon: TerminalIcon,
      iconColor: '#E07850',  // pfc-ember
      href: '/code-analyzer',
      status: 'available',
    },
    {
      id: 'revamp-planner',
      title: 'Codebase Revamp Planner',
      description: 'Plan a language migration with AI-guided suggestions and open-source repo recommendations.',
      icon: GitBranchIcon,
      iconColor: '#FBBF24',  // pfc-yellow
      href: null,
      status: 'coming-soon',
    },
    {
      id: 'steering-lab',
      title: 'AI Steering Lab',
      description: 'Control AI behavior with bias vectors, temperature, and adversarial tuning.',
      icon: SlidersHorizontalIcon,
      iconColor: '#8B7CF6',  // pfc-violet
      href: '/steering-lab',
      status: 'available',
    },
    {
      id: 'research-copilot',
      title: 'Research Copilot',
      description: 'AI-powered research assistant with citation tracking and deep analysis.',
      icon: BookOpenIcon,
      iconColor: '#22D3EE',  // pfc-cyan
      href: '/research-copilot',
      status: 'available',
    },
    {
      id: 'pipeline',
      title: 'Pipeline Inspector',
      description: 'Visualize and debug the 10-stage analytical pipeline.',
      icon: WorkflowIcon,
      iconColor: '#34D399',  // pfc-green
      href: '/pipeline',
      status: measurementEnabled ? 'available' : 'requires-full',
    },
    {
      id: 'diagnostics',
      title: 'Signal Diagnostics',
      description: 'Monitor confidence, entropy, and dissonance in real-time.',
      icon: ActivityIcon,
      iconColor: '#F87171',  // pfc-red
      href: '/diagnostics',
      status: measurementEnabled ? 'available' : 'requires-full',
    },
  ];

  /* ── Gate: programming not enabled ── */
  if (mounted && !programmingEnabled) {
    return (
      <PageShell
        icon={WrenchIcon}
        iconColor="var(--color-pfc-violet)"
        title="Developer Tools"
        subtitle="Programming Suite hub"
      >
        <GlassSection>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '50vh',
              textAlign: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '4rem',
                width: '4rem',
                borderRadius: '1.25rem',
                background: isDark ? 'rgba(139,124,246,0.08)' : 'rgba(139,124,246,0.06)',
              }}
            >
              <LockIcon
                style={{ height: '2rem', width: '2rem', color: 'rgba(139,124,246,0.4)' }}
              />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  marginBottom: '0.375rem',
                }}
              >
                Programming Suite Required
              </h2>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)',
                  maxWidth: '24rem',
                  lineHeight: 1.5,
                }}
              >
                Developer tools require the Programming or Full suite tier.
                Upgrade in Settings to unlock code analysis, steering lab, and more.
              </p>
            </div>
            <GlassBubbleButton
              color="violet"
              size="lg"
              onClick={() => router.push('/settings')}
            >
              Go to Settings
            </GlassBubbleButton>
          </div>
        </GlassSection>
      </PageShell>
    );
  }

  return (
    <PageShell
      icon={WrenchIcon}
      iconColor="var(--color-pfc-violet)"
      title="Developer Tools"
      subtitle="Programming Suite hub"
    >
      {/* ── Device Info + Tier Bar ── */}
      <GlassSection>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {/* Device info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {deviceProfile ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '1.75rem',
                    width: '1.75rem',
                    borderRadius: '0.5rem',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  }}
                >
                  {deviceProfile.deviceClass === 'phone' || deviceProfile.deviceClass === 'tablet' ? (
                    <MonitorIcon style={{ height: '0.875rem', width: '0.875rem', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }} />
                  ) : (
                    <CpuIcon style={{ height: '0.875rem', width: '0.875rem', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }} />
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                  }}
                >
                  {deviceProfile.summary}
                </span>
              </>
            ) : (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                }}
              >
                Detecting device...
              </span>
            )}
          </div>

          {/* Tier badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: tierColor,
              background: `${tierColor}14`,
              border: `1px solid ${tierColor}28`,
            }}
          >
            <span
              style={{
                height: '0.375rem',
                width: '0.375rem',
                borderRadius: '50%',
                background: tierColor,
              }}
            />
            {tierFeatures.tierLabel}
          </div>
        </div>
      </GlassSection>

      {/* ── Tool Cards Grid ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))',
          gap: '1rem',
        }}
      >
        {tools.map((tool) => (
          <ToolCardComponent
            key={tool.id}
            tool={tool}
            isDark={isDark}
            onNavigate={
              tool.status === 'available' && tool.href
                ? () => router.push(tool.href!)
                : undefined
            }
          />
        ))}
      </motion.div>
    </PageShell>
  );
}

/* ═══════════════════════════════════════════════════════════
   ToolCardComponent — individual glass card
   ═══════════════════════════════════════════════════════════ */
function ToolCardComponent({
  tool,
  isDark,
  onNavigate,
}: {
  tool: ToolCard;
  isDark: boolean;
  onNavigate?: () => void;
}) {
  const Icon = tool.icon;
  const isDisabled = tool.status !== 'available';

  const statusLabel =
    tool.status === 'available'
      ? 'Available'
      : tool.status === 'coming-soon'
        ? 'Coming Soon'
        : 'Requires Full Suite';

  const statusColor =
    tool.status === 'available'
      ? '#34D399'
      : tool.status === 'coming-soon'
        ? '#FBBF24'
        : 'rgba(128,128,128,0.5)';

  return (
    <motion.div
      variants={cardVariants}
      onClick={isDisabled ? undefined : onNavigate}
      style={{
        position: 'relative',
        padding: '1.5rem',
        borderRadius: '1.25rem',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        overflow: 'hidden',
        transition: 'border-color 0.25s cubic-bezier(0.32,0.72,0,1), box-shadow 0.25s cubic-bezier(0.32,0.72,0,1), background 0.25s cubic-bezier(0.32,0.72,0,1)',
      }}
      whileHover={
        isDisabled
          ? undefined
          : {
              scale: 1.02,
              transition: { type: 'spring', stiffness: 400, damping: 25, mass: 0.5 },
            }
      }
      whileTap={
        isDisabled
          ? undefined
          : {
              scale: 0.98,
              transition: { type: 'spring', stiffness: 500, damping: 30, mass: 0.5 },
            }
      }
      onHoverStart={(e) => {
        if (isDisabled) return;
        const el = e.target as HTMLElement;
        if (el?.style) {
          el.style.borderColor = isDark
            ? 'rgba(255,255,255,0.12)'
            : 'rgba(0,0,0,0.1)';
          el.style.boxShadow = isDark
            ? `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`
            : `0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)`;
        }
      }}
      onHoverEnd={(e) => {
        const el = e.target as HTMLElement;
        if (el?.style) {
          el.style.borderColor = isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.06)';
          el.style.boxShadow = 'none';
        }
      }}
    >
      {/* Icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '2.75rem',
          width: '2.75rem',
          borderRadius: '0.875rem',
          marginBottom: '1rem',
          background: `${tool.iconColor}14`,
          flexShrink: 0,
        }}
      >
        <Icon
          style={{
            height: '1.375rem',
            width: '1.375rem',
            color: tool.iconColor,
          }}
        />
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: '0.9375rem',
          fontWeight: 650,
          letterSpacing: '-0.02em',
          marginBottom: '0.375rem',
          color: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.85)',
        }}
      >
        {tool.title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: '0.8125rem',
          lineHeight: 1.5,
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)',
          marginBottom: '1rem',
        }}
      >
        {tool.description}
      </p>

      {/* Status badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.2rem 0.625rem',
          borderRadius: '999px',
          fontSize: '0.625rem',
          fontWeight: 600,
          letterSpacing: '0.01em',
          color: statusColor,
          background: `${statusColor}14`,
          border: `1px solid ${statusColor}22`,
        }}
      >
        <span
          style={{
            height: '0.3125rem',
            width: '0.3125rem',
            borderRadius: '50%',
            background: statusColor,
          }}
        />
        {statusLabel}
      </div>
    </motion.div>
  );
}
