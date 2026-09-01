"use client";

/**
 * Contribution Journey visualization.
 *
 * Renders the user's tracked projects as a left-to-right pipeline
 * (interested -> in-progress -> pr-submitted -> merged) using React Flow,
 * with an `abandoned` region below the forward path. Reads directly from the
 * client-side tracker store and stays live by re-reading on the tracker's
 * update event and on window focus (mirrors the dashboard's pattern).
 *
 * No props. Meant to be dynamically imported with `ssr:false` at the call site.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.5, 7.6.
 */

import { useEffect, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { readTracked, TRACKER_EVENT, type TrackedProject } from "@/lib/tracker";
import {
  buildJourneyModel,
  JOURNEY_LANES,
  LANE_WIDTH,
} from "@/lib/viz/journeyModel";
import { VizEmpty } from "@/components/viz/states";

/**
 * Human-readable lane labels, keyed by the raw status values in
 * `JOURNEY_LANES` (plus `abandoned`). Mirrors the dashboard's STATUS_LABELS.
 */
const STATUS_LABELS: Record<string, string> = {
  interested: "Interested",
  "in-progress": "In Progress",
  "pr-submitted": "PR Submitted",
  merged: "Merged",
  abandoned: "Abandoned",
};

/**
 * Hex equivalents of the dashboard's tailwind STATUS_COLORS, so React Flow's
 * inline node styles stay visually consistent with the rest of the app.
 */
const STATUS_COLORS_HEX: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  interested: { bg: "#dbeafe", border: "#93c5fd", text: "#1d4ed8" },
  "in-progress": { bg: "#fef9c3", border: "#fde047", text: "#a16207" },
  "pr-submitted": { bg: "#f3e8ff", border: "#d8b4fe", text: "#7e22ce" },
  merged: { bg: "#dcfce7", border: "#86efac", text: "#15803d" },
  abandoned: { bg: "#f3f4f6", border: "#e5e7eb", text: "#6b7280" },
};

const DEFAULT_COLOR = STATUS_COLORS_HEX.interested;

/** Vertical position for the abandoned lane header, above the abandoned row. */
const ABANDONED_HEADER_Y = 860;

export default function ContributionJourney() {
  const [tracked, setTracked] = useState<TrackedProject[]>([]);

  useEffect(() => {
    const refresh = () => setTracked(readTracked());
    refresh();
    // Stay live: the agent tool and the Track button both dispatch TRACKER_EVENT;
    // re-read on tab focus too, in case another tab changed the store.
    window.addEventListener(TRACKER_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(TRACKER_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const model = buildJourneyModel(tracked);

    // Lane header nodes (non-draggable, non-selectable) for the forward pipeline.
    const laneHeaders: Node[] = JOURNEY_LANES.map((lane, index) => ({
      id: `lane-header-${lane}`,
      position: { x: index * LANE_WIDTH, y: 0 },
      data: { label: STATUS_LABELS[lane] ?? lane },
      draggable: false,
      selectable: false,
      style: {
        width: LANE_WIDTH - 40,
        padding: 8,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        color: "#111827",
        fontSize: 12,
        fontWeight: 700,
        textAlign: "center" as const,
      },
    }));

    const hasAbandoned = model.nodes.some((n) => n.data.lane === "abandoned");
    if (hasAbandoned) {
      laneHeaders.push({
        id: "lane-header-abandoned",
        position: { x: 0, y: ABANDONED_HEADER_Y },
        data: { label: STATUS_LABELS.abandoned },
        draggable: false,
        selectable: false,
        style: {
          width: LANE_WIDTH - 40,
          padding: 8,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#f3f4f6",
          color: "#6b7280",
          fontSize: 12,
          fontWeight: 700,
          textAlign: "center" as const,
        },
      });
    }

    // Project nodes: map the pure model to React Flow nodes with a short label
    // and a status-colored card style.
    const projectNodes: Node[] = model.nodes.map((n) => {
      const colors =
        STATUS_COLORS_HEX[n.data.status as string] ?? DEFAULT_COLOR;
      const project = n.data.project;
      const issueSuffix = project.issueId ? ` #${project.issueId}` : "";
      return {
        id: n.id,
        position: n.position,
        data: { label: `${project.fullName}${issueSuffix}` },
        style: {
          width: LANE_WIDTH - 60,
          padding: 8,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          background: colors.bg,
          color: colors.text,
          fontSize: 11,
          fontWeight: 600,
          textAlign: "center" as const,
        },
      };
    });

    // Subtle forward edges between lane headers to indicate pipeline direction.
    // Abandoned is intentionally excluded from the forward flow (Req 5.2).
    const laneEdges: Edge[] = JOURNEY_LANES.slice(0, -1).map((lane, index) => ({
      id: `lane-e-${index}`,
      source: `lane-header-${lane}`,
      target: `lane-header-${JOURNEY_LANES[index + 1]}`,
      animated: false,
      style: { stroke: "#d1d5db" },
    }));

    return {
      nodes: [...laneHeaders, ...projectNodes],
      edges: laneEdges,
    };
  }, [tracked]);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Contribution Journey
      </h3>
      {tracked.length === 0 ? (
        <VizEmpty
          title="No contribution journey yet"
          hint="Track projects to see them flow from interested to merged."
        />
      ) : (
        <div className="h-[420px] w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
