/**
 * Pure transform: contribution journey model.
 *
 * Converts the tracked-projects store (`lib/tracker.ts`) into a React Flow
 * (`@xyflow/react`) compatible node/edge model for the dashboard's
 * `ContributionJourney` visualization.
 *
 * This module is intentionally free of any React / React Flow / DOM imports so
 * it stays a pure, deterministic function that is trivial to unit- and
 * property-test. The node/edge shapes are defined locally but match what
 * `@xyflow/react` expects (`{ id, type, position, data }` / `{ id, source,
 * target }`), so the component can hand them straight to `<ReactFlow>`.
 *
 * Design references (data-visualizations spec):
 * - Property 4: exactly one node per tracked project, positioned by status
 *   lane, with `abandoned` in a distinct region off the forward path.
 * - Property 5: the set of project-node ids equals the set of tracked ids —
 *   no phantom nodes, no dropped nodes (except entries defensively skipped for
 *   missing id/status).
 */

import type { TrackedProject, TrackStatus } from "@/lib/tracker";

/**
 * The forward pipeline lanes, in progression order. A project's `status`
 * determines which lane it lands in. `abandoned` is deliberately NOT part of
 * this ordered list — it is rendered in a separate region below the pipeline.
 */
export const JOURNEY_LANES = [
  "interested",
  "in-progress",
  "pr-submitted",
  "merged",
] as const;

export type JourneyLane = (typeof JOURNEY_LANES)[number];

/**
 * Lane-index lookup so the component can position lane headers / columns
 * consistently with the node layout. Kept in sync with `JOURNEY_LANES`.
 */
export const JOURNEY_LANE_INDEX: Record<JourneyLane, number> =
  JOURNEY_LANES.reduce(
    (acc, lane, index) => {
      acc[lane] = index;
      return acc;
    },
    {} as Record<JourneyLane, number>
  );

/** Horizontal spacing between lanes. */
export const LANE_WIDTH = 260;
/** Vertical spacing between stacked nodes within a lane. */
export const NODE_STACK_HEIGHT = 90;
/** Top offset for the first stacked node in the forward lanes. */
export const LANE_TOP_OFFSET = 80;
/**
 * Vertical offset for the distinct `abandoned` region. Large enough to sit
 * clearly below the forward pipeline regardless of how the lanes fill up.
 */
export const ABANDONED_ROW_Y = 900;

/**
 * A journey node. Shaped for `@xyflow/react`. `data.project` is the full
 * tracked entry; `data.status` is the raw stored status (may be a value
 * outside the known set — the layout normalizes it, but we keep the original
 * for display/debugging).
 */
export interface JourneyNode {
  id: string;
  type: "project";
  position: { x: number; y: number };
  data: {
    project: TrackedProject;
    status: TrackStatus | string;
    /** The lane the node was placed in (`abandoned` for the distinct region). */
    lane: JourneyLane | "abandoned";
  };
}

/** A journey edge. Shaped for `@xyflow/react`. */
export interface JourneyEdge {
  id: string;
  source: string;
  target: string;
}

export interface JourneyModel {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
}

/**
 * Type guard for whether a status string is one of the four forward lanes.
 */
function isForwardLane(status: unknown): status is JourneyLane {
  return (
    typeof status === "string" &&
    (JOURNEY_LANES as readonly string[]).includes(status)
  );
}

/**
 * Build the React Flow model from the tracked-projects store.
 *
 * Guarantees:
 * - Exactly one node per valid tracked project.
 * - Entries missing an `id` or `status` are defensively skipped (never crash).
 * - Unknown / unexpected statuses fall back to the `interested` lane.
 * - `abandoned` projects go into a distinct region below the forward pipeline,
 *   never on the forward path.
 * - The set of returned node ids equals the set of tracked ids (minus skipped
 *   invalid entries) — no phantom nodes, no dropped valid nodes.
 *
 * Edges: kept intentionally empty. Project nodes carry all the lane/position
 * information needed to render the pipeline, and the component draws lane
 * headers/connectors from `JOURNEY_LANES`. Returning no edges keeps the
 * node-id ↔ tracked-id correspondence exact (Property 5) and the transform
 * fully deterministic.
 */
export function buildJourneyModel(tracked: TrackedProject[]): JourneyModel {
  const nodes: JourneyNode[] = [];

  if (!Array.isArray(tracked)) {
    return { nodes, edges: [] };
  }

  // Track how many nodes are already stacked in each lane so we can compute
  // the vertical position within the lane deterministically.
  const laneCounts: Record<string, number> = {};
  // Guard against duplicate ids in the store so node ids stay unique while
  // still reflecting the (deduplicated) set of tracked ids.
  const seenIds = new Set<string>();

  for (const project of tracked) {
    // Defensive skip: entries missing id or status are ignored, not fatal.
    if (
      !project ||
      typeof project.id !== "string" ||
      project.id.length === 0 ||
      typeof project.status !== "string" ||
      project.status.length === 0
    ) {
      continue;
    }

    if (seenIds.has(project.id)) {
      continue;
    }
    seenIds.add(project.id);

    const status = project.status;
    const isAbandoned = status === "abandoned";

    // Resolve the lane: abandoned -> distinct region, known forward status ->
    // its lane, anything else -> interested.
    const lane: JourneyLane | "abandoned" = isAbandoned
      ? "abandoned"
      : isForwardLane(status)
        ? status
        : "interested";

    const laneKey = lane;
    const stackIndex = laneCounts[laneKey] ?? 0;
    laneCounts[laneKey] = stackIndex + 1;

    let x: number;
    let y: number;

    if (isAbandoned) {
      // Distinct region: its own row well below the forward pipeline, laid out
      // horizontally so it never overlaps the forward lanes.
      x = stackIndex * LANE_WIDTH;
      y = ABANDONED_ROW_Y;
    } else {
      const laneIndex = JOURNEY_LANE_INDEX[lane as JourneyLane];
      x = laneIndex * LANE_WIDTH;
      y = stackIndex * NODE_STACK_HEIGHT + LANE_TOP_OFFSET;
    }

    nodes.push({
      id: project.id,
      type: "project",
      position: { x, y },
      data: {
        project,
        status,
        lane,
      },
    });
  }

  return { nodes, edges: [] };
}
