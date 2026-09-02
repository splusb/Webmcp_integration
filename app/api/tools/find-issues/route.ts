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

    // Apply the caller's filters. Returns the filtered issue list.
    const applyFilters = (
      issues: any[],
      opts: { excludeAssigned: boolean; excludeStale: boolean }
    ) => {
      let out = issues.filter((issue: any) => !issue.pull_request);
      if (opts.excludeAssigned) {
        out = out.filter((issue: any) => !issue.assignee);
      }
      if (opts.excludeStale) {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        out = out.filter((issue: any) => new Date(issue.updated_at) > ninetyDaysAgo);
      }
      return out;
    };

    const wantExcludeAssigned = input.excludeAssigned !== false;
    const wantExcludeStale = input.excludeStale !== false;

    // First pass: with labels + the caller's filters.
    let issues = await getIssues(owner, repo, { labels });
    let filtered = applyFilters(issues, {
      excludeAssigned: wantExcludeAssigned,
      excludeStale: wantExcludeStale,
    });
    let relaxed = false;

    // Fallback: if the label filter produced nothing, retry without labels.
    if (filtered.length === 0 && labels) {
      issues = await getIssues(owner, repo, {});
      filtered = applyFilters(issues, {
        excludeAssigned: wantExcludeAssigned,
        excludeStale: wantExcludeStale,
      });
      relaxed = true;
    }

    // Fallback: if still empty (e.g. a heavily-triaged repo where the first
    // page of issues is all assigned/stale), relax those filters so we return
    // real issues instead of a misleading "no issues" result.
    if (filtered.length === 0) {
      filtered = applyFilters(issues, { excludeAssigned: false, excludeStale: false });
      relaxed = true;
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

    return NextResponse.json({
      issues: result,
      totalCount: result.length,
      // true when default filters (label / assigned / stale) were relaxed to
      // avoid returning an empty list. The agent should then verify each issue
      // with check_issue_availability, since some may be assigned or claimed.
      relaxedFilters: relaxed,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "ISSUES_FETCH_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
