"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMotionConfig } from "@/components/viz/motionVariants";
import { ProjectCard } from "@/components/ProjectCard";
import type { Project } from "@/lib/types";

interface AnimatedResultsProps {
  /** The results to render. The parent passes an already-sorted array; this
   * component animates whatever order it receives. */
  results: Project[];
  /** Current sort key. Changing the order of `results` (driven by this) triggers
   * the reorder/layout animation via each card's stable key + `layout` prop. */
  sortBy: string;
  /** Which discovery mode produced these results. */
  mode: "skills" | "search";
}

/**
 * Animated wrapper around the results list.
 *
 * Renders a staggered-entrance container (Req 1.1) whose children carry a stable
 * `key` and a `layout` prop, so when the parent re-sorts `results` the cards
 * smoothly reorder rather than snapping (Req 1.2). The reduced-motion decision is
 * centralized in {@link useMotionConfig}: on the reduced path the container uses
 * no stagger and cards use the instant (final-state) variant with layout disabled,
 * so the output matches the static UI (Req 1.4, 1.6).
 *
 * This component only *wraps* `ProjectCard` — its content, links, and Track action
 * are left untouched (Req 1.5). The mode-toggle panel transition (Req 1.3) is
 * handled by the page-level filter panels, not here.
 */
export function AnimatedResults({ results, sortBy, mode }: AnimatedResultsProps) {
  const { container, card, layout } = useMotionConfig();

  return (
    <motion.div
      className="space-y-4"
      variants={container}
      initial="hidden"
      animate="visible"
      data-sort={sortBy}
      data-mode={mode}
    >
      <AnimatePresence>
        {results.map((project) => (
          <motion.div
            key={project.id}
            variants={card}
            layout={layout}
          >
            <ProjectCard project={project} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
