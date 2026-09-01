"use client";

import { useEffect } from "react";

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

  registerTool({
    name: "search_projects",
    description: "Search open-source projects by technology, domain, activity level, and contributor-friendliness.",
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
      return res.json();
    },
  });

  registerTool({
    name: "match_skills_to_projects",
    description: "Given developer skills and interests, find personalized project matches.",
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
      return res.json();
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
    description: "Save a project or issue to the user contribution tracker.",
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
      const res = await fetch("/api/tools/track-contribution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return res.json();
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

  console.log("[WebMCP] All 8 tools registered successfully");
}
