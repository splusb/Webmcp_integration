import { NextRequest, NextResponse } from "next/server";
import { getIssueDetail, getIssueComments, searchIssueReferencingPRs } from "@/lib/github";

/**
 * check_issue_availability
 *
 * Answers "is this issue free for me to take?" using observable GitHub signals,
 * so a contributor doesn't waste time on work someone else already started.
 *
 * Verdict:
 *   taken        -> formally assigned, OR an open PR already references it
 *   likely-taken -> a recent (<= ~30d) "working on it" style comment, no PR yet
 *   available    -> none of the above (may include a stale, abandoned old claim)
 *
 * Every verdict comes with `evidence[]` so the reasoning is transparent.
 */

const CLAIM_PHRASES = [
  "working on this",
  "working on it",
  "i'll take this",
  "ill take this",
  "i will take this",
  "can i work on",
  "can i take this",
  "i'd like to work",
  "i would like to work",
  "assign me",
  "assign this to me",
  "taking this",
  "i'll pick this up",
  "on it",
];

const RECENT_DAYS = 30; // a claim newer than this counts as an active claim
const STALE_DAYS = 60; // a claim older than this is treated as likely abandoned

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    console.log("[tool:check_issue_availability] executed with input:", JSON.stringify(input));

    const [owner, repo] = (input.projectId || "").split("/");
    const issueNumber = parseInt(input.issueId, 10);

    if (!owner || !repo || isNaN(issueNumber)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Valid projectId (owner/repo) and numeric issueId are required",
          },
        },
        { status: 400 }
      );
    }

    const [issue, comments, refPRs] = await Promise.all([
      getIssueDetail(owner, repo, issueNumber),
      getIssueComments(owner, repo, issueNumber),
      searchIssueReferencingPRs(owner, repo, issueNumber),
    ]);

    const evidence: string[] = [];
    let status: "available" | "likely-taken" | "taken" = "available";
    let confidence: "low" | "medium" | "high" = "medium";

    // 1) Formal assignment (strongest signal)
    const assignees: any[] = (issue.assignees && issue.assignees.length
      ? issue.assignees
      : issue.assignee
      ? [issue.assignee]
      : []) as any[];
    if (assignees.length > 0) {
      status = "taken";
      confidence = "high";
      evidence.push(
        `Formally assigned to ${assignees.map((a: any) => "@" + a.login).join(", ")}`
      );
    } else {
      evidence.push("Not formally assigned to anyone");
    }

    // 2) An open PR already references this issue (also strong)
    if (Array.isArray(refPRs) && refPRs.length > 0) {
      const pr = refPRs[0];
      status = "taken";
      confidence = "high";
      evidence.push(
        `Open PR #${pr.number} ("${(pr.title || "").slice(0, 60)}") appears to reference this issue`
      );
    } else {
      evidence.push("No open pull request appears to reference this issue");
    }

    // 3) Informal claim in comments (only if not already "taken")
    const claimComments = (comments as any[])
      .filter((c) => CLAIM_PHRASES.some((p) => (c.body || "").toLowerCase().includes(p)))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (claimComments.length > 0) {
      const latest = claimComments[0];
      const age = daysAgo(latest.created_at);
      const who = latest.user?.login ? "@" + latest.user.login : "someone";

      if (status !== "taken") {
        if (age <= RECENT_DAYS) {
          status = "likely-taken";
          confidence = "medium";
          evidence.push(`${who} signaled they're working on it ${age} day(s) ago`);
        } else if (age >= STALE_DAYS) {
          // stale claim, no PR, not assigned -> probably free again
          status = "available";
          confidence = "low";
          evidence.push(
            `${who} claimed it ${age} day(s) ago but there's no PR — likely abandoned, probably free again`
          );
        } else {
          status = "likely-taken";
          confidence = "low";
          evidence.push(`${who} mentioned working on it ${age} day(s) ago`);
        }
      } else {
        evidence.push(`Also: ${who} mentioned working on it in the comments`);
      }
    }

    let recommendation: string;
    if (status === "taken") {
      recommendation =
        "This looks taken. Pick a different issue, or comment to ask the current owner if help is welcome.";
    } else if (status === "likely-taken") {
      recommendation =
        "Someone recently claimed this. Comment to confirm before starting, or choose another issue to avoid duplicate work.";
    } else {
      recommendation =
        "Looks free to take. It's still polite to comment that you're starting, so others don't duplicate your work.";
    }

    return NextResponse.json({
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
      },
      availability: {
        status,
        confidence,
        evidence,
        recommendation,
        meta: {
          isAssigned: assignees.length > 0,
          referencingOpenPRs: Array.isArray(refPRs) ? refPRs.length : 0,
          claimComments: claimComments.length,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "AVAILABILITY_CHECK_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
