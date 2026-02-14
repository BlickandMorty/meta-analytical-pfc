// ═══════════════════════════════════════════════════════════════════
// Unified Motion Configuration
// M3 emphasized easing — smooth deceleration, no overshoot/recoil
// Snappy but fluid, like Google Material You motion
// ═══════════════════════════════════════════════════════════════════

// ── M3 Emphasized Easing ──
// All motion uses tween-based easing (no springs = no recoil)
// cubic-bezier(0.2, 0, 0, 1) = fast start, smooth deceleration, zero overshoot

const M3_EASE = [0.2, 0, 0, 1] as [number, number, number, number];
const M3_ACCEL = [0.3, 0, 0.8, 0.15] as [number, number, number, number];

export const spring = {
  /** Snappy toggle/switch — lightweight, responsive (buttons, chips) */
  snappy:   { duration: 0.2, ease: M3_EASE },
  /** Standard UI transition — balanced (panels, cards) */
  standard: { duration: 0.35, ease: M3_EASE },
  /** Heavy element — weighty, authoritative (modals, drawers) */
  heavy:    { duration: 0.45, ease: M3_EASE },
  /** Bouncy — now smooth entrance (notifications, toasts) */
  bouncy:   { duration: 0.3, ease: M3_EASE },
  /** Gentle — slow, ambient (background elements, fades) */
  gentle:   { duration: 0.5, ease: M3_EASE },
  /** Critically damped — no overshoot (layout shifts, resizes) */
  settle:   { duration: 0.3, ease: M3_EASE },
  /** Editor — responsive for block operations */
  editor:   { duration: 0.25, ease: M3_EASE },
} as const;

// ── Easing Curves ──
export const ease = {
  cupertino:  [0.32, 0.72, 0, 1] as [number, number, number, number],
  emphasized: M3_EASE,
  decelerate: [0, 0, 0.2, 1] as [number, number, number, number],
  accelerate: M3_ACCEL,
} as const;

// ── Component Animation Variants ──
// Use with <motion.div variants={variants.panel} initial="hidden" animate="visible" exit="exit" />

export const variants = {
  /** Page content fade in */
  page: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: spring.standard },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: M3_ACCEL } },
  },

  /** Panel/card appear */
  panel: {
    hidden: { opacity: 0, scale: 0.97 },
    visible: { opacity: 1, scale: 1, transition: spring.standard },
    exit: { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: M3_ACCEL } },
  },

  /** Sidebar slide */
  sidebar: {
    hidden: { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0, transition: spring.settle },
    exit: { opacity: 0, x: -16, transition: { duration: 0.15, ease: M3_ACCEL } },
  },

  /** Message bubble (chat, streaming) */
  message: {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: spring.snappy },
    exit: { opacity: 0, x: -40, transition: { duration: 0.15, ease: M3_ACCEL } },
  },

  /** Floating menu/popover */
  popover: {
    hidden: { opacity: 0, y: 4, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: spring.snappy },
    exit: { opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.12, ease: M3_ACCEL } },
  },

  /** List item stagger child */
  listItem: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
  },

  /** Glass bubble button */
  glassBubble: {
    rest: { scale: 1 },
    hover: { scale: 1.04 },
    tap: { scale: 0.96 },
  },
} as const;

// ── Stagger Orchestration ──
const stagger = {
  fast:     { staggerChildren: 0.03 },
  standard: { staggerChildren: 0.06 },
  slow:     { staggerChildren: 0.12 },
} as const;

// ── Layout Transition Presets ──
const layout = {
  /** Smooth block reorder */
  block: { duration: 0.25, ease: M3_EASE },
  /** Tab underline / shared layout */
  shared: { duration: 0.2, ease: M3_EASE },
} as const;

// ── Reduced Motion ──
const reducedMotion = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
} as const;
