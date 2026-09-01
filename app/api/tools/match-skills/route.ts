import { NextRequest, NextResponse } from "next/server";
import { searchRepositories } from "@/lib/github";
import { calculateMatchScore, buildSkillQuery } from "@/lib/matching";
import type { MatchSkillsInput } from "@/lib/types";

const PER_SKILL = 8; // how many repos to pull per selected skill
const MAX_RESULTS = 18; // final list cap after interleaving

export async function POST(req: NextRequest) {
  try {
    const input: MatchSkillsInput = await req.json();
    console.log("[tool:match_skills_to_projects] executed with input:", JSON.stringify(input));

    if (!input.skills || input.skills.length === 0) {
      return NextResponse.json(
        { error: { code: "MISSING_SKILLS", message: "At least one skill is required" } },
        { status: 400 }
      );
    }

    // GitHub search can't reliably OR multiple languages in one query, so we run
    // one query per selected skill (capped) and merge. We TAG each repo with the
    // skill whose query returned it, so the graph can draw accurate edges and so
    // we can interleave fairly across skills instead of letting the highest-
    // starred language dominate the final list.
    const skills = input.skills.slice(0, 5);

    const perSkillLists = await Promise.all(
      skills.map(async (skill) => {
        try {
          const query = buildSkillQuery(skill, input);
          const data = await searchRepositories(query, { perPage: PER_SKILL });
          return { skill, items: data.items || [] };
        } catch {
          return { skill, items: [] as any[] };
        }
      })
    );

    // Accumulate matchedSkills per repo across all skill queries.
    const byId = new Map<string, { repo: any; matchedSkills: Set<string> }>();
    for (const { skill, items } of perSkillLists) {
      for (const repo of items) {
        const existing = byId.get(repo.full_name);
        if (existing) {
          existing.matchedSkills.add(skill);
        } else {
          byId.set(repo.full_name, { repo, matchedSkills: new Set([skill]) });
        }
      }
    }

    // Build a per-skill queue (each repo in the order GitHub returned it),
    // skipping repos already taken, then round-robin across skills so every
    // selected skill is fairly represented in the final list.
    const taken = new Set<string>();
    const queues: Record<string, any[]> = {};
    for (const { skill, items } of perSkillLists) {
      queues[skill] = items;
    }

    const ordered: { repo: any; matchedSkills: string[] }[] = [];
    let added = true;
    while (added && ordered.length < MAX_RESULTS) {
      added = false;
      for (const skill of skills) {
        const q = queues[skill];
        if (!q || q.length === 0) continue;
        // pop the next not-yet-taken repo for this skill
        let repo = q.shift();
        while (repo && taken.has(repo.full_name)) {
          repo = q.shift();
        }
        if (!repo) continue;
        taken.add(repo.full_name);
        const entry = byId.get(repo.full_name)!;
        ordered.push({ repo, matchedSkills: Array.from(entry.matchedSkills) });
        added = true;
        if (ordered.length >= MAX_RESULTS) break;
      }
    }

    const projects = ordered.map(({ repo, matchedSkills }) => ({
      id: repo.full_name,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || "",
      url: repo.html_url,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language || "Unknown",
      topics: repo.topics || [],
      openIssueCount: repo.open_issues_count,
      lastActivity: repo.pushed_at,
      license: repo.license?.spdx_id || null,
      matchedSkills,
      matchScore: calculateMatchScore(
        {
          language: repo.language || "",
          topics: repo.topics || [],
          stars: repo.stargazers_count,
        },
        { ...input, skills: matchedSkills.length ? matchedSkills : input.skills }
      ),
    }));

    return NextResponse.json({ projects, totalCount: projects.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "MATCH_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
