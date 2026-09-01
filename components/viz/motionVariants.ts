"use client";

import { useReducedMotion, type Variants } from "framer-motion";

/**
 * Shared Framer Motion variants for the data-visualization layer.
 *
 * These are consumed through {@link useMotionConfig}, which centralizes the
 * reduced-motion decision so every animated surface (animated results, mode
 * panels) has a single source of truth. The reduced-motion path always renders
 * the final visual state with no motion-based animation.
 */

/**
 * Container variant that staggers its children on entrance.
 *
 * Stagger is tuned to ~0.03s per child so a list of 20+ cards finishes its
 * entrance within ~1s: base card duration (~0.25s) + 20 × 0.03s ≈ 0.85s.
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

/**
 * Container variant with no stagger — used on the reduced-motion path so all
 * children appear together at their final state.
 */
export const noStagger: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0,
    },
  },
};

/**
 * Child variant: fade in and slide up slightly on entrance.
 */
export const fadeSlideVariant: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

/**
 * Child variant for the reduced-motion path: renders the final state instantly
 * with no motion (duration 0).
 */
export const instantVariant: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0 },
  },
};

/**
 * Panel/mode transition variant for use with `AnimatePresence`.
 */
export const panelVariant: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15 },
  },
};

/**
 * Resolved motion configuration for a component tree.
 */
export interface MotionConfig {
  /** Whether the user prefers reduced motion. */
  reduce: boolean;
  /** Container variant (staggered when motion is allowed, none when reduced). */
  container: Variants;
  /** Child/card variant (fade+slide when allowed, instant when reduced). */
  card: Variants;
  /** Panel/mode transition variant (always available; skip animating when reduced). */
  panel: Variants;
  /** Whether layout (reorder) animations should be enabled. */
  layout: boolean;
}

/**
 * Centralizes the reduced-motion decision via Framer Motion's
 * `useReducedMotion()`.
 *
 * When the user prefers reduced motion, this returns the no-stagger container,
 * the instant (final-state) card variant, and disables layout animations so the
 * rendered output matches the static UI. Otherwise it returns the staggered
 * container, fade/slide card variant, and enables layout animations.
 *
 * `panel` is always `panelVariant`; `AnimatePresence` remains valid but callers
 * should skip animating the swap when `reduce` is true.
 */
export function useMotionConfig(): MotionConfig {
  const reduce = useReducedMotion() ?? false;
  return {
    reduce,
    container: reduce ? noStagger : staggerContainer,
    card: reduce ? instantVariant : fadeSlideVariant,
    panel: panelVariant,
    layout: !reduce,
  };
}
