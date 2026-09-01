import { NextRequest, NextResponse } from "next/server";
import { searchRepositories } from "@/lib/github";
import { calculateMatchScore, buildSearchQuery } from "@/lib/matching";
import type { MatchSkillsInput } from "@/lib/types";

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

    const query = buildSearchQuery(input);
    const data = await searchRepositories(query, { perPage: 30 });

    const projects = data.items
      .map((repo: any) => ({
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
        matchScore: calculateMatchScore(
          { language: repo.language || "", topics: repo.topics || [] },
          input
        ),
      }))
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, 10);

    return NextResponse.json({ projects, totalCount: projects.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "MATCH_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
