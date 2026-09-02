"use client";

import { create } from "zustand";
import type { Project } from "@/lib/types";

/**
 * Shared visualization + results store.
 *
 * This is the bridge that lets the AI agent drive what the human sees. It holds
 * two things:
 *
 * 1. The latest skill-match / search RESULTS and the skills they were matched
 *    against. When the agent runs match_skills_to_projects (or search_projects),
 *    its tool writes the results here. The /search page reads this store, so the
 *    project cards AND the D3 graph populate from an agent request — not just
 *    from the human clicking buttons.
 *
 * 2. A transient graph COMMAND (highlight/focus/reset) the agent can issue to
 *    manipulate the on-screen graph live.
 *
 * Zustand stores are module singletons, so both a plain WebMCP tool callback and
 * a React component can read/write them without any context wiring.
 */

export type GraphCommand =
  | { kind: "none" }
  | { kind: "highlight-project"; query: string }
  | { kind: "focus-skill"; skill: string };

interface VizState {
  // ---- Results shared between the agent and the search page ----
  /** Skills the current results were matched against (drives skill nodes). */
  skills: string[];
  /** Experience level the agent used for the current results (drives the UI radio). */
  experienceLevel: string;
  /** The current result set (drives cards + project nodes). */
  results: Project[];
  /** Monotonic token; bumped whenever the agent publishes new results. */
  resultsNonce: number;
  /** Publish a fresh result set from an agent tool. experienceLevel is optional. */
  publishResults: (skills: string[], results: Project[], experienceLevel?: string) => void;

  // ---- Transient graph command ----
  command: GraphCommand;
  nonce: number;
  highlightProject: (query: string) => void;
  focusSkill: (skill: string) => void;
  resetGraph: () => void;
}

const SESSION_KEY = "viz_shared_results";

/** Read any persisted results (survives the navigation to /search). */
function loadPersisted(): { skills: string[]; results: Project[]; experienceLevel: string } {
  if (typeof window === "undefined") return { skills: [], results: [], experienceLevel: "" };
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { skills: [], results: [], experienceLevel: "" };
    const parsed = JSON.parse(raw);
    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      results: Array.isArray(parsed.results) ? parsed.results : [],
      experienceLevel: typeof parsed.experienceLevel === "string" ? parsed.experienceLevel : "",
    };
  } catch {
    return { skills: [], results: [], experienceLevel: "" };
  }
}

const persisted = loadPersisted();

export const useVizStore = create<VizState>((set) => ({
  skills: persisted.skills,
  experienceLevel: persisted.experienceLevel,
  results: persisted.results,
  resultsNonce: persisted.results.length > 0 ? 1 : 0,
  publishResults: (skills, results, experienceLevel) => {
    const level = experienceLevel ?? "";
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ skills, results, experienceLevel: level })
        );
      } catch {
        /* ignore quota/serialization errors */
      }
    }
    set((s) => ({ skills, results, experienceLevel: level, resultsNonce: s.resultsNonce + 1 }));
  },

  command: { kind: "none" },
  nonce: 0,
  highlightProject: (query: string) =>
    set((s) => ({ command: { kind: "highlight-project", query }, nonce: s.nonce + 1 })),
  focusSkill: (skill: string) =>
    set((s) => ({ command: { kind: "focus-skill", skill }, nonce: s.nonce + 1 })),
  resetGraph: () =>
    set((s) => ({ command: { kind: "none" }, nonce: s.nonce + 1 })),
}));

/**
 * Non-hook accessors so plain (non-React) code — like a WebMCP tool's execute()
 * callback — can drive the store too.
 */
export const vizActions = {
  publishResults: (skills: string[], results: Project[], experienceLevel?: string) =>
    useVizStore.getState().publishResults(skills, results, experienceLevel),
  highlightProject: (query: string) => useVizStore.getState().highlightProject(query),
  focusSkill: (skill: string) => useVizStore.getState().focusSkill(skill),
  resetGraph: () => useVizStore.getState().resetGraph(),
  getState: () => useVizStore.getState(),
};
