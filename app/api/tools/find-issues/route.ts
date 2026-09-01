import { NextRequest, NextResponse } from "next/server";
import { getIssues } from "@/lib/github";
import type { FindIssuesInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const input: FindIssuesInput = await req.json();
    console.log("[tool:find_issues] executed with input:", JSON.stringify(input));
    const [owner, repo] = input.projectId.split("/");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: { code: "INVALID_PROJECT_ID", message: "projectId must be in format owner/repo" } },
        { status: 400 }
      );
    }

    const labels = input.labels?.join(",") || (input.difficulty === "good-first-issue" ? "good first issue" : undefined);
    const issues = await getIssues(owner, repo, { labels });

    let filtered = issues.filter((issue: any) => !issue.pull_request);

    if (input.excludeAssigned !== false) {
      filtered = filtered.filter((issue: any) => !issue.assignee);
    }

    if (input.excludeStale !== false) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      filtered = filtered.filter((issue: any) => new Date(issue.updated_at) > ninetyDaysAgo);
    }

    const result = filtered.map((issue: any) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      labels: issue.labels.map((l: any) => l.name),
      state: issue.state,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      commentsCount: issue.comments,
      isAssigned: !!issue.assignee,
      body: issue.body?.substring(0, 500) || "",
    }));

    return NextResponse.json({ issues: result, totalCount: result.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "ISSUES_FETCH_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
