import { NextRequest, NextResponse } from "next/server";
import { getIssueDetail, getRepository } from "@/lib/github";

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    console.log("[tool:explain_issue] executed with input:", JSON.stringify(input));
    const [owner, repo] = input.projectId.split("/");
    const issueNumber = parseInt(input.issueId, 10);

    if (!owner || !repo || isNaN(issueNumber)) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Valid projectId and issueId are required" } },
        { status: 400 }
      );
    }

    const [issue, repoData] = await Promise.all([
      getIssueDetail(owner, repo, issueNumber),
      getRepository(owner, repo),
    ]);

    const labels = issue.labels.map((l: any) => (typeof l === "string" ? l : l.name));

    const explanation = {
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
      },
      explanation: {
        summary: issue.body?.substring(0, 500) || "No description provided",
        labels,
        background: "This issue is in the " + repoData.name + " project (" + repoData.language + "), which has " + repoData.stargazers_count + " stars.",
        technicalContext: "Primary language: " + (repoData.language || "Unknown") + ". Topics: " + (repoData.topics || []).join(", "),
        commentsCount: issue.comments,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        isAssigned: !!issue.assignee,
        assignee: issue.assignee?.login || null,
      },
    };

    return NextResponse.json(explanation);
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "EXPLAIN_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
