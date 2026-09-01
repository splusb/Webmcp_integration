"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { buildGraphModel } from "@/lib/viz/graphModel";
import type { Project } from "@/lib/types";
import { VizLoading, VizEmpty } from "@/components/viz/states";
import { useVizStore } from "@/lib/viz/vizStore";

interface SkillNetworkGraphProps {
  skills: string[];
  results: Project[];
  loading: boolean;
}

// Colors for the two node types (kept in the neutral app palette).
const SKILL_COLOR = "#2563eb"; // blue-600
const PROJECT_COLOR = "#16a34a"; // green-600

/**
 * Force-directed skill→project network graph (Requirement 4).
 *
 * React owns the <svg> shell; D3 owns everything inside it. The simulation is
 * created inside a useEffect keyed on the graph inputs, and torn down on every
 * re-render so no simulation is leaked across renders. The public props are
 * typed, but D3 datum types are kept loose (`any`) to avoid fighting D3's
 * generics as it mutates node x/y and link source/target.
 */
export default function SkillNetworkGraph({ skills, results, loading }: SkillNetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Populated by the D3-building effect; lets the store-driven effect apply
  // agent commands (highlight/focus) without rebuilding the whole graph.
  const applyCommandRef = useRef<((cmd: { kind: string; query?: string; skill?: string }) => void) | null>(null);

  // Subscribe to the shared viz store so agent tools can drive the graph.
  const command = useVizStore((s) => s.command);
  const nonce = useVizStore((s) => s.nonce);

  // Build the pure model up front; the effect depends on the same inputs.
  const model = buildGraphModel(skills, results);

  useEffect(() => {
    // Only render the graph when we actually have edges to show. The pre-render
    // states below handle loading / no-skills / no-connections.
    if (loading || skills.length === 0 || model.edges.length === 0) {
      return;
    }

    const svgEl = svgRef.current;
    if (!svgEl) {
      return;
    }

    const rect = svgEl.getBoundingClientRect();
    const width = rect.width || 640;
    const height = rect.height || 360;

    // Clone into mutable objects that D3 can annotate (x/y, resolved links).
    const nodes: any[] = model.nodes.map((n) => ({ ...n }));
    const links: any[] = model.edges.map((e) => ({ ...e }));

    // Fast neighbor lookup for hover highlighting.
    const neighbors = new Map<string, Set<string>>();
    const linkKeys = new Set<string>();
    for (const n of nodes) {
      neighbors.set(n.id, new Set<string>());
    }
    for (const e of links) {
      neighbors.get(e.source)?.add(e.target);
      neighbors.get(e.target)?.add(e.source);
      linkKeys.add(`${e.source}::${e.target}`);
    }
    const areConnected = (a: string, b: string) =>
      a === b || linkKeys.has(`${a}::${b}`) || linkKeys.has(`${b}::${a}`);

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const root = svg.append("g");

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          // Stronger matches (higher weight) sit closer to their skill node.
          .distance((d: any) => 140 - d.weight * 70),
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(28))
      // Settle ~30 nodes quickly without visible stutter (Req 4.7 / 7.6).
      .alphaDecay(0.05);

    // Edges: stroke width/opacity scaled by weight.
    const link = root
      .append("g")
      .attr("stroke", "#94a3b8") // slate-400
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d: any) => 1 + d.weight * 6)
      .attr("stroke-opacity", (d: any) => 0.25 + d.weight * 0.55);

    // Highest incoming edge weight per project node — used to size project dots
    // so stronger matches read as bigger, complementing edge thickness.
    const projectWeight = new Map<string, number>();
    for (const e of links) {
      const t = typeof e.target === "object" ? e.target.id : e.target;
      projectWeight.set(t, Math.max(projectWeight.get(t) ?? 0, e.weight));
    }

    // Nodes: group with a circle + label.
    const node = root
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer");

    node
      .append("circle")
      .attr("r", (d: any) => (d.type === "skill" ? 11 : 6 + (projectWeight.get(d.id) ?? 0) * 6))
      .attr("fill", (d: any) => (d.type === "skill" ? SKILL_COLOR : PROJECT_COLOR))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5);

    node
      .append("text")
      .text((d: any) => d.label)
      .attr("dx", 12)
      .attr("dy", 4)
      .attr("font-size", 10)
      .attr("fill", "#374151"); // gray-700

    // Hover highlight: raise the hovered node + its edges + neighbors, dim rest.
    function highlight(id: string) {
      node.attr("opacity", (d: any) => (areConnected(id, d.id) ? 1 : 0.15));
      link.attr("stroke-opacity", (d: any) => {
        const s = typeof d.source === "object" ? d.source.id : d.source;
        const t = typeof d.target === "object" ? d.target.id : d.target;
        const connected = s === id || t === id;
        return connected ? Math.min(1, 0.4 + d.weight * 0.6) : 0.04;
      });
    }
    function restore() {
      node.attr("opacity", 1);
      link.attr("stroke-opacity", (d: any) => 0.2 + d.weight * 0.6);
    }

    node
      .on("mouseover", (_event, d: any) => highlight(d.id))
      .on("mouseout", () => restore());

    // Focus a whole skill: emphasize the skill node + all projects it links to.
    function focusSkill(skillId: string) {
      const target = skillId.trim().toLowerCase();
      const keep = new Set<string>();
      for (const n of nodes) {
        if (n.type === "skill" && n.id.trim().toLowerCase() === target) {
          keep.add(n.id);
        }
      }
      if (keep.size === 0) {
        restore();
        return;
      }
      // add projects connected to the focused skill
      for (const e of links) {
        const s = typeof e.source === "object" ? e.source.id : e.source;
        const t = typeof e.target === "object" ? e.target.id : e.target;
        if (keep.has(s)) keep.add(t);
        if (keep.has(t)) keep.add(s);
      }
      node.attr("opacity", (d: any) => (keep.has(d.id) ? 1 : 0.12));
      link.attr("stroke-opacity", (d: any) => {
        const s = typeof d.source === "object" ? d.source.id : d.source;
        const t = typeof d.target === "object" ? d.target.id : d.target;
        return keep.has(s) && keep.has(t) ? Math.min(1, 0.4 + d.weight * 0.6) : 0.04;
      });
    }

    // Highlight a project by fuzzy name/id match.
    function highlightProject(query: string) {
      const q = query.trim().toLowerCase();
      const match = nodes.find(
        (n: any) =>
          n.type === "project" &&
          (n.id.toLowerCase().includes(q) || (n.label ?? "").toLowerCase().includes(q)),
      );
      if (!match) {
        restore();
        return;
      }
      // pulse the matched node briefly, then settle into a highlight
      node
        .filter((d: any) => d.id === match.id)
        .select("circle")
        .transition()
        .duration(300)
        .attr("r", (d: any) => (d.type === "skill" ? 16 : 14))
        .transition()
        .duration(300)
        .attr("r", (d: any) => (d.type === "skill" ? 11 : 6 + (projectWeight.get(d.id) ?? 0) * 6));
      highlight(match.id);
    }

    // Expose the command applier to the store-driven effect.
    applyCommandRef.current = (cmd) => {
      if (cmd.kind === "highlight-project" && cmd.query) {
        highlightProject(cmd.query);
      } else if (cmd.kind === "focus-skill" && cmd.skill) {
        focusSkill(cmd.skill);
      } else {
        restore();
      }
    };

    // Optional drag (nice to have): pin node while dragging.
    const drag = d3
      .drag<SVGGElement, any>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    node.call(drag as any);

    // If the store already has an active command (e.g. the agent focused a skill
    // before results refreshed), apply it now that the graph exists.
    const pending = useVizStore.getState().command;
    if (pending && pending.kind !== "none") {
      applyCommandRef.current?.(pending as any);
    }

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
      d3.select(svgEl).selectAll("*").remove();
      applyCommandRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(skills), JSON.stringify(results), loading]);

  // Apply agent commands from the shared viz store. Runs after the graph is
  // built (applyCommandRef is set) and whenever a new command arrives (nonce).
  useEffect(() => {
    const apply = applyCommandRef.current;
    if (!apply) return;
    apply(command as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Pre-render states (Req 4.4, 4.5, 4.6).
  let body: React.ReactNode;
  if (loading) {
    body = <VizLoading label="Building graph..." />;
  } else if (skills.length === 0) {
    body = (
      <VizEmpty
        title="Select skills to see connections"
        hint="Pick skills on the left to visualize matching projects."
      />
    );
  } else if (model.edges.length === 0) {
    body = (
      <VizEmpty
        title="No connections found"
        hint="Try different skills or broaden your search."
      />
    );
  } else {
    body = (
      <div className="h-[360px] w-full">
        <svg ref={svgRef} width="100%" height="100%" role="img" aria-label="Skill to project network graph" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Skill → Project Connections</h3>
      {body}
    </div>
  );
}
