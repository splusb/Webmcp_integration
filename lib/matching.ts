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
  project: { language: string; topics: string[]; stars?: number },
  input: MatchSkillsInput
): number {
  const projectTech = [
    project.language?.toLowerCase(),
    ...project.topics.map((t) => t.toLowerCase()),
  ].filter(Boolean);

  // Best per-project skill match: a project that matches ANY selected skill
  // directly scores high; adjacent-only matches score lower. We take the
  // strongest signal rather than averaging across all skills, so a great
  // single-skill match isn't diluted by the skills it doesn't match.
  let best = 0;
  let matchedSkills = 0;

  for (const skill of input.skills) {
    const lower = skill.toLowerCase();
    let skillScore = 0;

    if (projectTech.includes(lower)) {
      skillScore = 1.0; // direct language/topic match
    } else {
      const adjacent = SKILL_ADJACENCY[lower] || [];
      if (adjacent.some((adj) => projectTech.includes(adj))) {
        skillScore = 0.5; // adjacent match
      }
    }

    if (skillScore > 0) matchedSkills += 1;
    if (skillScore > best) best = skillScore;
  }

  if (best === 0) return 0;

  // Bonus for matching more than one selected skill (up to +0.15 per extra
  // matched skill), so multi-skill projects rank above single-skill ones.
  const multiSkillBonus = Math.min(0.3, (matchedSkills - 1) * 0.15);

  // Small popularity signal (log-scaled stars, up to +0.1) so equally-matched
  // projects don't all render with an identical weight — gives the graph and
  // the ranking visible variation.
  const stars = project.stars ?? 0;
  const popularity = stars > 0 ? Math.min(0.1, Math.log10(stars) / 60) : 0;

  return Math.min(1, best + multiSkillBonus + popularity);
}

/**
 * Build a GitHub search query for a SINGLE language/skill.
 *
 * GitHub's repository search does not reliably support OR-ing multiple
 * `language:` qualifiers in one query (especially combined with other
 * qualifiers like stars/pushed), so the route runs one query per selected
 * skill and merges the results instead. This function builds one such query.
 */
export function buildSkillQuery(
  skill: string,
  input: MatchSkillsInput
): string {
  const parts: string[] = [];

  if (skill && skill.trim().length > 0) {
    parts.push(`language:${skill.trim()}`);
  }

  // Beginner-friendly repos need good first issues.
  if (input.experienceLevel === "beginner") {
    parts.push("good-first-issues:>1");
  }

  // Quality + recency floors.
  parts.push("stars:>100");
  parts.push("pushed:>" + getDateMonthsAgo(3));

  return parts.join(" ");
}

/**
 * Kept for backward compatibility / single-skill callers. Builds a query for
 * the first selected skill only.
 */
export function buildSearchQuery(input: MatchSkillsInput): string {
  const first = input.skills[0] ?? "";
  return buildSkillQuery(first, input);
}

function getDateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}
