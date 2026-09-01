import type { Project } from "@/lib/types";

/**
 * A node in the skill→project network graph.
 * - `skill` nodes are keyed by the selected skill string.
 * - `project` nodes are keyed by the project's `fullName` (falling back to `id`).
 */
export interface GraphNode {
  id: string;
  label: string;
  type: "skill" | "project";
  /** For project nodes, the project's language (used for grouping/coloring). */
  group?: string;
}

/**
 * A weighted edge from a skill node to a project node.
 * `weight` is the project's matchScore clamped to [0, 1]; edges are only emitted
 * when weight > 0.
 */
export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Clamp a number into the inclusive [0, 1] range, treating non-finite values as 0. */
function clamp01(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Determine whether a skill matches a project. Matching is case-insensitive and
 * deterministic: the skill matches when it equals or is contained in the
 * project's language, appears in any of the project's topics, or appears in the
 * project's name.
 */
function skillMatchesProject(skill: string, project: Project): boolean {
  const needle = skill.trim().toLowerCase();
  if (needle.length === 0) {
    return false;
  }

  const language = (project.language ?? "").toLowerCase();
  if (language.includes(needle)) {
    return true;
  }

  const name = (project.name ?? "").toLowerCase();
  if (name.includes(needle)) {
    return true;
  }

  const topics = project.topics ?? [];
  for (const topic of topics) {
    if ((topic ?? "").toLowerCase().includes(needle)) {
      return true;
    }
  }

  return false;
}

/**
 * Build the skill→project graph model consumed by the D3 network graph.
 *
 * Pure and deterministic. Returns an empty model when either `skills` or
 * `results` is empty. Otherwise it emits one skill node per selected skill, one
 * project node per result (keyed by `fullName`, falling back to `id`), and a
 * weighted edge from a skill node to a project node whenever the skill matches
 * the project and the project's clamped matchScore is greater than 0.
 */
export function buildGraphModel(skills: string[], results: Project[]): GraphModel {
  // Property 3: empty skills OR empty results yields a fully empty model.
  if (skills.length === 0 || results.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Skill nodes, de-duplicated so the node set has unique ids.
  const seenSkillIds = new Set<string>();
  for (const skill of skills) {
    if (seenSkillIds.has(skill)) {
      continue;
    }
    seenSkillIds.add(skill);
    nodes.push({ id: skill, label: skill, type: "skill" });
  }

  // Project nodes, keyed by fullName (falling back to id), de-duplicated.
  const seenProjectIds = new Set<string>();
  for (const project of results) {
    const projectId = project.fullName || project.id;
    if (seenProjectIds.has(projectId)) {
      continue;
    }
    seenProjectIds.add(projectId);
    nodes.push({
      id: projectId,
      label: project.name || projectId,
      type: "project",
      group: project.language,
    });
  }

  // Edges. For each project we connect it to every selected skill it matches.
  // A skill matches a project when EITHER:
  //   (a) the project was tagged with that skill by the fetch layer
  //       (project.matchedSkills — the reliable, query-based relationship), OR
  //   (b) the skill string appears in the project's language/topics/name
  //       (catches cross-skill connections, e.g. a Python repo tagged for
  //        Python that also lists "javascript" in its topics).
  // A project matching two or more skills therefore connects to two or more
  // blue skill nodes, which is what visually links those skills together.
  const skillSet = new Set(skills.map((s) => s.trim().toLowerCase()));

  for (const project of results) {
    const projectId = project.fullName || project.id;
    const weight = clamp01(project.matchScore);
    if (weight <= 0) continue;

    const connected = new Set<string>();

    // (a) fetch-tagged skills — matched against the selected skill list.
    for (const tagged of project.matchedSkills ?? []) {
      const lower = tagged.trim().toLowerCase();
      if (skillSet.has(lower)) connected.add(lower);
    }

    // (b) string-based matches for any remaining selected skills.
    for (const skill of skills) {
      const lower = skill.trim().toLowerCase();
      if (lower.length === 0 || connected.has(lower)) continue;
      if (skillMatchesProject(skill, project)) connected.add(lower);
    }

    // Emit one edge per connected skill, using that skill's ORIGINAL casing
    // so the edge target matches the skill node id.
    for (const skill of skills) {
      if (connected.has(skill.trim().toLowerCase())) {
        edges.push({ source: skill, target: projectId, weight });
      }
    }
  }

  return { nodes, edges };
}
