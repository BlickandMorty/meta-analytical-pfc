// ═══════════════════════════════════════════════════════════════════
// Unified Motion Configuration
// Physics-based spring presets, animation variants, and performance helpers
// Inspired by Apple's CoreAnimation + Material Design 3 motion system
// ═══════════════════════════════════════════════════════════════════

// ── Spring Presets ──
// All UI motion uses springs (interruptible, velocity-inheriting)
// Never use duration-based easing for interactive elements

export const spring = {
  /** Snappy toggle/switch — lightweight, responsive (buttons, chips) */
  snappy:   { type: 'spring' as const, stiffness: 400, damping: 25, mass: 0.5 },
  /** Standard UI transition — balanced (panels, cards) */
  standard: { type: 'spring' as const, stiffness: 200, damping: 20, mass: 1 },
  /** Heavy element — weighty, authoritative (modals, drawers) */
  heavy:    { type: 'spring' as const, stiffness: 150, damping: 22, mass: 1.2 },
  /** Bouncy — playful overshoot (notifications, toasts) */
  bouncy:   { type: 'spring' as const, stiffness: 300, damping: 12, mass: 0.8 },
  /** Gentle — slow, ambient (background elements, fades) */
  gentle:   { type: 'spring' as const, stiffness: 120, damping: 18, mass: 1 },
  /** Critically damped — no overshoot (layout shifts, resizes) */
  settle:   { type: 'spring' as const, stiffness: 200, damping: 28, mass: 1 },
  /** Editor — responsive for block operations */
  editor:   { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.6 },
} as const;

// ── Cupertino Easing (for rare non-spring cases) ──
export const ease = {
  cupertino:  [0.32, 0.72, 0, 1] as [number, number, number, number],
  emphasized: [0.2, 0, 0, 1] as [number, number, number, number],
  decelerate: [0, 0, 0.2, 1] as [number, number, number, number],
} as const;

// ── Component Animation Variants ──
// Use with <motion.div variants={variants.panel} initial="hidden" animate="visible" exit="exit" />

export const variants = {
  /** Page content fade in */
  page: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: spring.standard },
    exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
  },

  /** Panel/card appear */
  panel: {
    hidden: { opacity: 0, scale: 0.97 },
    visible: { opacity: 1, scale: 1, transition: spring.standard },
    exit: { opacity: 0, scale: 0.97, transition: { duration: 0.1 } },
  },

  /** Sidebar slide */
  sidebar: {
    hidden: { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0, transition: spring.settle },
    exit: { opacity: 0, x: -16, transition: { duration: 0.12 } },
  },

  /** Message bubble (chat, streaming) */
  message: {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: spring.snappy },
    exit: { opacity: 0, x: -40, transition: { duration: 0.15 } },
  },

  /** Floating menu/popover */
  popover: {
    hidden: { opacity: 0, y: 4, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: spring.snappy },
    exit: { opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.1 } },
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
  block: { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.6 },
  /** Tab underline / shared layout */
  shared: { type: 'spring' as const, stiffness: 500, damping: 30 },
} as const;

// ── Reduced Motion ──
const reducedMotion = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
} as const;
