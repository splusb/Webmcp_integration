// Skill-to-project matching logic

import type { Project, MatchSkillsInput } from "./types";

// Skill adjacency map: related skills get partial credit
const SKILL_ADJACENCY: Record<string, string[]> = {
  react: ["javascript", "typescript", "nextjs", "redux"],
  vue: ["javascript", "typescript", "nuxt"],
  angular: ["typescript", "rxjs"],
  nextjs: ["react", "typescript", "nodejs"],
  nodejs: ["javascript", "typescript", "express"],
  python: ["django", "flask", "fastapi"],
  typescript: ["javascript"],
  javascript: ["typescript"],
  rust: ["systems", "webassembly"],
  go: ["systems", "docker", "kubernetes"],
  java: ["kotlin", "spring"],
  kotlin: ["java", "android"],
  swift: ["ios", "macos"],
  "c++": ["c", "systems"],
};

export function calculateMatchScore(
  project: { language: string; topics: string[] },
  input: MatchSkillsInput
): number {
  let score = 0;
  const projectTech = [
    project.language?.toLowerCase(),
    ...project.topics.map((t) => t.toLowerCase()),
  ].filter(Boolean);

  for (const skill of input.skills) {
    const lower = skill.toLowerCase();
    // Direct match
    if (projectTech.includes(lower)) {
      score += 1.0;
      continue;
    }
    // Adjacent match
    const adjacent = SKILL_ADJACENCY[lower] || [];
    for (const adj of adjacent) {
      if (projectTech.includes(adj)) {
        score += 0.5;
        break;
      }
    }
  }

  // Normalize by number of skills
  return input.skills.length > 0 ? score / input.skills.length : 0;
}

export function buildSearchQuery(input: MatchSkillsInput): string {
  const parts: string[] = [];

  // Add language filters
  if (input.skills.length > 0) {
    parts.push("language:" + input.skills[0]);
  }

  // Add good first issues filter for beginners
  if (input.experienceLevel === "beginner") {
    parts.push("good-first-issues:>1");
  }

  // Minimum stars for quality
  parts.push("stars:>100");

  // Active projects
  parts.push("pushed:>" + getDateMonthsAgo(3));

  return parts.join(" ");
}

function getDateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}
