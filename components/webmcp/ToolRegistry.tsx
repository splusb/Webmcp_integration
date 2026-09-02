"use client";

import { useEffect } from "react";
import { upsertTracked } from "@/lib/tracker";
import { vizActions } from "@/lib/viz/vizStore";

interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: object;
  execute: (input: any) => Promise<any>;
}

// The global `Document.modelContext` type lives in lib/webmcp.d.ts.

// Module-level guard: React Strict Mode (dev) mounts components twice, which
// would otherwise call registerAllTools() twice and trigger the browser's
// "Duplicate tool name" error. This ensures tools register exactly once.
let toolsRegistered = false;

export function WebMCPToolRegistry() {
  useEffect(() => {
    if (typeof document !== "undefined" && document.modelContext && !toolsRegistered) {
      registerAllTools();
      toolsRegistered = true;
    }
  }, []);

  return null;
}

function registerAllTools() {
  const mc = document.modelContext!;

  // Wrap registerTool so that if a tool with the same name already exists
  // (e.g. from a hot-reload during dev), we unregister it first instead of
  // throwing "Duplicate tool name".
  const registerTool = (tool: WebMCPTool) => {
    try {
      mc.unregisterTool?.(tool.name);
    } catch {
      // ignore — tool may not have been registered yet
    }
    mc.registerTool(tool);
  };

  // Navigate the human to the /search page (where the graph lives) so agent
  // results are visible. Deferred via setTimeout so the tool's execute() can
  // return its result to the agent BEFORE the full-page navigation happens;
  // a synchronous reload here would abort the agent loop mid-turn. No-op if
  // we're already on /search (the store subscription updates the view live).
  const goToSearch = () => {
    if (typeof window !== "undefined" && window.location.pathname !== "/search") {
      setTimeout(() => window.location.assign("/search"), 400);
    }
  };

  // Navigate the human to the /dashboard page so agent-driven tracking /
  // status changes are visible. Deferred so the tool result returns first.
  const goToDashboard = () => {
    if (typeof window !== "undefined" && window.location.pathname !== "/dashboard") {
      setTimeout(() => window.location.assign("/dashboard"), 400);
    }
  };

  registerTool({
    name: "search_projects",
    description: "Search open-source projects by broad filters (domain, activity, stars) when the user does NOT name specific skills/languages. If the user names languages/skills, prefer match_skills_to_projects instead so the skill graph populates.",
    inputSchema: {
      type: "object",
      properties: {
        technologies: { type: "array", items: { type: "string" }, description: "Programming languages or frameworks" },
        domain: { type: "string", enum: ["web", "mobile", "ml", "devtools", "gaming", "data", "security", "other"] },
        difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
        minStars: { type: "number" },
        maxStars: { type: "number" },
        hasGoodFirstIssues: { type: "boolean" },
        activelyMaintained: { type: "boolean" },
        limit: { type: "number", default: 10 },
      },
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/search-projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = await res.json();
      // Only publish to the shared graph store when this search actually names
      // technologies to plot as skill nodes. Publishing with NO skills would
      // overwrite an existing skill-matched graph and blank it out ("No
      // connections found"), so in that case we just return data to the agent.
      const skills = Array.isArray(input?.technologies)
        ? input.technologies.filter((t: unknown) => typeof t === "string" && t.trim().length > 0)
        : [];
      if (data && Array.isArray(data.projects) && skills.length > 0) {
        vizActions.publishResults(skills, data.projects);
        goToSearch();
      }
      return data;
    },
  });

  registerTool({
    name: "match_skills_to_projects",
    description: "PREFERRED tool when the user mentions one or more programming languages or skills (e.g. 'JavaScript and Python beginner projects'). Finds personalized project matches for the given skills and renders them in the on-screen skill graph. Pass every language/skill the user named in the 'skills' array and set experienceLevel from words like 'beginner'.",
    inputSchema: {
      type: "object",
      properties: {
        skills: { type: "array", items: { type: "string" } },
        interests: { type: "array", items: { type: "string" } },
        experienceLevel: { type: "string", enum: ["beginner", "intermediate", "senior"] },
        timeCommitment: { type: "string", enum: ["one-time", "occasional", "regular"] },
        preferredContributionType: { type: "array", items: { type: "string", enum: ["code", "documentation", "testing", "design", "translation"] } },
      },
      required: ["skills"],
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/match-skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = await res.json();
      // Publish into the shared store so the /search page (cards + graph) shows
      // the agent's matches, then navigate there so the human sees the graph.
      if (data && Array.isArray(data.projects)) {
        const skills = Array.isArray(input?.skills) ? input.skills : [];
        vizActions.publishResults(skills, data.projects);
        goToSearch();
      }
      return data;
    },
  });

  registerTool({
    name: "find_issues",
    description: "Find open issues in a project filtered by labels, difficulty, or skill requirements.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "e.g. facebook/react" },
        labels: { type: "array", items: { type: "string" } },
        difficulty: { type: "string", enum: ["good-first-issue", "medium", "complex"] },
        skills: { type: "array", items: { type: "string" } },
        issueType: { type: "string", enum: ["bug", "feature", "documentation", "testing"] },
        excludeAssigned: { type: "boolean", default: true },
        excludeStale: { type: "boolean", default: true },
      },
      required: ["projectId"],
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/find-issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return res.json();
    },
  });

  registerTool({
    name: "summarize_project",
    description: "Get comprehensive project summary including purpose, tech stack, and community health.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        includeContributionGuide: { type: "boolean", default: true },
        includeCodeStructure: { type: "boolean", default: false },
        includeCommunityMetrics: { type: "boolean", default: true },
        includeRecentActivity: { type: "boolean", default: true },
      },
      required: ["projectId"],
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/summarize-project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return res.json();
    },
  });

  registerTool({
    name: "estimate_first_response_time",
    description: "Estimate how responsive a project is to contributors by sampling recent closed pull requests: median time to first response (first comment/review from someone other than the PR author) and median time to merge. Returns a responsiveness rating. Use to judge whether a PR here is likely to be reviewed or ignored — pairs well with search_projects to find active AND responsive projects.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "e.g. facebook/react" },
        sampleSize: { type: "number", description: "How many recent closed PRs to sample (3-15, default 10)" },
      },
      required: ["projectId"],
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/estimate-first-response-time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return res.json();
    },
  });

  registerTool({
    name: "explain_issue",
    description: "Get beginner-friendly explanation of an issue with context and suggested approach.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: { type: "string" },
        projectId: { type: "string" },
        detailLevel: { type: "string", enum: ["brief", "detailed", "step-by-step"], default: "detailed" },
      },
      required: ["issueId", "projectId"],
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/explain-issue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return res.json();
    },
  });

  registerTool({
    name: "draft_contribution_plan",
    description: "Generate a concrete, step-by-step first-contribution plan for a project (and optionally a specific issue): setup commands, which files to look at, how to run tests, and a PR checklist. Synthesizes the repo's README and CONTRIBUTING guide with AI. Use when the user has picked a project/issue and asks how to actually get started.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "e.g. facebook/react" },
        issueId: { type: "string", description: "Optional issue number to tailor the plan to a specific issue" },
        experienceLevel: { type: "string", enum: ["beginner", "intermediate", "senior"], default: "beginner" },
      },
      required: ["projectId"],
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/draft-contribution-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return res.json();
    },
  });

  registerTool({
    name: "assess_issue_difficulty",
    description: "Assess whether an issue is realistically doable for a given experience level, beyond its label. Analyzes comment volume, age, description detail, keywords, and assignment/claim signals to return a difficulty score, reasons, and red flags (taken, contentious, stale). Use after find_issues to filter to genuinely doable issues.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "e.g. facebook/react" },
        issueId: { type: "string", description: "The issue number" },
        experienceLevel: { type: "string", enum: ["beginner", "intermediate", "senior"], default: "beginner" },
      },
      required: ["projectId", "issueId"],
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/assess-issue-difficulty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return res.json();
    },
  });

  registerTool({
    name: "check_issue_availability",
    description: "Check whether an issue is free to work on: is it assigned, has someone claimed it in a recent comment, or is there already an open PR referencing it? Returns available | likely-taken | taken with evidence. Use after find_issues, before a user commits time to an issue, to avoid duplicate work.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "e.g. facebook/react" },
        issueId: { type: "string", description: "The issue number" },
      },
      required: ["projectId", "issueId"],
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/check-issue-availability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return res.json();
    },
  });

  registerTool({
    name: "check_contribution_requirements",
    description: "Get contribution requirements including CLA, code style, testing, and PR process.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/contribution-requirements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return res.json();
    },
  });

  registerTool({
    name: "track_contribution",
    description: "Track a project or issue in the contribution tracker, OR change the status of an already-tracked one. Provide projectId (owner/repo) and a status: interested, in-progress, pr-submitted, merged, or abandoned. Use for requests like track facebook/react, mark next.js as merged, or move it to in-progress. The change shows on the dashboard.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        issueId: { type: "string" },
        status: { type: "string", enum: ["interested", "in-progress", "pr-submitted", "merged", "abandoned"] },
        notes: { type: "string" },
        targetDate: { type: "string", format: "date" },
      },
      required: ["projectId"],
    },
    execute: async (input) => {
      // Persist to the server (keeps demo logs) ...
      let apiResult: any = null;
      try {
        const res = await fetch("/api/tools/track-contribution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        apiResult = await res.json();
      } catch {
        /* server tracking is best-effort; localStorage is the source of truth */
      }

      // ... and to localStorage, which the dashboard reads. This is the key
      // fix: the agent and the human "Track" button now share one store.
      const id = input.issueId
        ? `${input.projectId}#${input.issueId}`
        : input.projectId;
      const saved = upsertTracked({
        id,
        fullName: input.projectId,
        name: input.projectId,
        issueId: input.issueId ?? null,
        status: input.status || "interested",
        notes: input.notes,
      });

      // Take the human to the dashboard so they see the tracking/status
      // change land live. Deferred so this result returns to the agent first.
      goToDashboard();

      return {
        success: true,
        message: `Tracked ${id} as "${saved.status}". Opening your dashboard.`,
        contribution: saved,
        server: apiResult,
      };
    },
  });

  registerTool({
    name: "get_mentorship_projects",
    description: "Find projects in mentorship programs like GSoC, Outreachy, MLH, or Hacktoberfest.",
    inputSchema: {
      type: "object",
      properties: {
        program: { type: "string", enum: ["gsoc", "outreachy", "mlh", "hacktoberfest", "lfx", "all"] },
        year: { type: "number" },
        technologies: { type: "array", items: { type: "string" } },
        acceptingApplications: { type: "boolean" },
      },
    },
    execute: async (input) => {
      const res = await fetch("/api/tools/mentorship-projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return res.json();
    },
  });

  // --- Agent-driven visualization controls -------------------------------
  // These tools don't fetch data — their execute() runs in the browser and
  // writes to the shared viz store, so the on-screen D3 graph reacts live to
  // what the user asks the agent. This is the "humans + agents create together"
  // moment: the agent changes what the human sees in real time.

  registerTool({
    name: "highlight_project",
    description:
      "Visually highlight a project node in the on-screen skill graph. Pass a specific name (e.g. 'excalidraw' or 'facebook/react'), OR a superlative describing the current results: 'most-starred', 'most-forked', or 'most-issues'. The matching node glows and its connections are emphasized while others dim. Use this (NOT a new search) when the user asks to point out, highlight, or focus on a project in the results already shown.",
    inputSchema: {
      type: "object",
      properties: {
        project: {
          type: "string",
          description: "Project name or owner/repo to highlight in the graph.",
        },
      },
      required: ["project"],
    },
    execute: async (input) => {
      let query = String(input?.project ?? "").trim();
      if (!query) {
        return { success: false, message: "No project name provided." };
      }

      // Resolve superlatives ("most-starred" / "most forked" / "most issues")
      // against the current shared results so the agent can point at the top
      // project without knowing its exact name — and without re-searching.
      const norm = query.toLowerCase().replace(/[^a-z]/g, "");
      const results = vizActions.getState().results || [];
      if (results.length > 0 && (norm.includes("most") || norm.includes("top") || norm.includes("highest"))) {
        let metric: "stars" | "forks" | "issues" = "stars";
        if (norm.includes("fork")) metric = "forks";
        else if (norm.includes("issue")) metric = "issues";
        const pick = [...results].sort((a: any, b: any) => {
          const av = metric === "stars" ? a.stars : metric === "forks" ? a.forks : a.openIssueCount;
          const bv = metric === "stars" ? b.stars : metric === "forks" ? b.forks : b.openIssueCount;
          return (bv || 0) - (av || 0);
        })[0];
        if (pick) {
          query = pick.fullName || pick.name || query;
        }
      }

      vizActions.highlightProject(query);
      return {
        success: true,
        message: `Highlighted "${query}" in the skill graph.`,
      };
    },
  });

  registerTool({
    name: "focus_skill",
    description:
      "Focus the on-screen skill graph on a single selected skill (e.g. 'Python'), emphasizing that skill node and the projects it connects to while fading the rest. Use when the user wants to see the projects for one particular skill.",
    inputSchema: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          description: "The skill/language to focus on (must be one the user selected).",
        },
      },
      required: ["skill"],
    },
    execute: async (input) => {
      const skill = String(input?.skill ?? "").trim();
      if (!skill) {
        return { success: false, message: "No skill provided." };
      }
      vizActions.focusSkill(skill);
      return { success: true, message: `Focused the graph on "${skill}".` };
    },
  });

  registerTool({
    name: "reset_graph",
    description:
      "Clear any highlight or focus on the on-screen skill graph, restoring all nodes and connections to full visibility.",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      vizActions.resetGraph();
      return { success: true, message: "Graph view reset." };
    },
  });

  console.log("[WebMCP] All 15 tools registered successfully");
}
