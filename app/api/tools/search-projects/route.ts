import { NextRequest, NextResponse } from "next/server";
import { searchRepositories } from "@/lib/github";
import type { SearchProjectsInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const input: SearchProjectsInput = await req.json();
    console.log("[tool:search_projects] executed with input:", JSON.stringify(input));
    const queryParts: string[] = [];

    if (input.technologies?.length) {
      queryParts.push("language:" + input.technologies[0]);
    }
    if (input.hasGoodFirstIssues) {
      queryParts.push("good-first-issues:>1");
    }
    if (input.activelyMaintained) {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      queryParts.push("pushed:>" + threeMonthsAgo.toISOString().split("T")[0]);
    }
    if (input.minStars) {
      queryParts.push("stars:>" + input.minStars);
    }
    if (input.domain) {
      queryParts.push("topic:" + input.domain);
    }

    const query = queryParts.length > 0 ? queryParts.join(" ") : "stars:>500";
    const data = await searchRepositories(query, { perPage: input.limit || 10 });

    const projects = data.items.map((repo: any) => ({
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
    }));

    return NextResponse.json({ projects, totalCount: data.total_count });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "SEARCH_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
