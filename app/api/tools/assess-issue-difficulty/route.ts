import { NextRequest, NextResponse } from "next/server";
import { getIssueDetail, getRepository, getIssueComments } from "@/lib/github";

/**
 * assess_issue_difficulty
 *
 * Estimates whether an issue is realistically doable — beyond its label —
 * using observable GitHub signals, and flags risks (taken, contentious,
 * stale, underspecified). The scoring is a transparent weighted heuristic,
 * not an AI guess, so every point is explainable.
 *
 * Score scale: 0 (trivial) .. 100 (very hard). Buckets:
 *   0..33  -> beginner-friendly
 *   34..66 -> intermediate
 *   67..100-> advanced
 */

const HARD_KEYWORDS = [
  "refactor",
  "architecture",
  "breaking",
  "migration",
  "redesign",
  "performance",
  "concurrency",
  "race condition",
  "security",
  "deprecate",
];
const EASY_KEYWORDS = [
  "typo",
  "docs",
  "documentation",
  "readme",
  "comment",
  "rename",
  "update link",
  "broken link",
  "spelling",
  "grammar",
];
const CLAIM_PHRASES = [
  "working on this",
  "working on it",
  "i'll take this",
  "ill take this",
  "i will take this",
  "can i work on",
  "i'd like to work",
  "assign me",
  "taking this",
  "on it",
];

function daysBetween(from: string, to: Date) {
  return Math.floor((to.getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    console.log("[tool:assess_issue_difficulty] executed with input:", JSON.stringify(input));

    const [owner, repo] = (input.projectId || "").split("/");
    const issueNumber = parseInt(input.issueId, 10);
    const experienceLevel: string = input.experienceLevel || "beginner";

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

    const [issue, repoData, comments] = await Promise.all([
      getIssueDetail(owner, repo, issueNumber),
      getRepository(owner, repo),
      getIssueComments(owner, repo, issueNumber),
    ]);

    const now = new Date();
    const title = (issue.title || "").toLowerCase();
    const body = (issue.body || "").toLowerCase();
    const text = title + " " + body;
    const labels: string[] = (issue.labels || []).map((l: any) =>
      (typeof l === "string" ? l : l.name || "").toLowerCase()
    );

    let score = 50; // neutral baseline
    const signals: string[] = [];
    const redFlags: string[] = [];

    // --- Signals that RAISE difficulty ---
    if (issue.comments > 20) {
      score += 20;
      signals.push(`${issue.comments} comments suggest an unresolved or contentious discussion (+20)`);
    } else if (issue.comments > 8) {
      score += 8;
      signals.push(`${issue.comments} comments indicate some back-and-forth (+8)`);
    }

    const ageDays = daysBetween(issue.created_at, now);
    if (ageDays > 180) {
      score += 15;
      signals.push(`Open for ${ageDays} days without resolution — may be stuck or hard (+15)`);
    } else if (ageDays > 60) {
      score += 6;
      signals.push(`Open for ${ageDays} days (+6)`);
    }

    const hardHit = HARD_KEYWORDS.find((k) => text.includes(k));
    if (hardHit) {
      score += 20;
      signals.push(`Mentions "${hardHit}", which usually implies deeper changes (+20)`);
    }

    const bodyLen = (issue.body || "").trim().length;
    if (bodyLen < 40) {
      score += 10;
      signals.push(`Very short/empty description — unclear scope makes it riskier (+10)`);
    }

    // --- Signals that LOWER difficulty ---
    if (labels.some((l) => l.includes("good first issue") || l.includes("good-first-issue"))) {
      score -= 15;
      signals.push(`Labeled a good-first-issue by maintainers (-15)`);
    }
    if (labels.some((l) => l.includes("documentation") || l.includes("docs"))) {
      score -= 10;
      signals.push(`Documentation-labeled work tends to be more approachable (-10)`);
    }

    const easyHit = EASY_KEYWORDS.find((k) => text.includes(k));
    if (easyHit) {
      score -= 20;
      signals.push(`Mentions "${easyHit}", typically a smaller, self-contained change (-20)`);
    }

    if (bodyLen >= 200 && ageDays < 30) {
      score -= 8;
      signals.push(`Recent and well-described — clearer scope (-8)`);
    }

    // --- RED FLAGS (availability / contention), don't change score directly ---
    if (issue.assignee) {
      redFlags.push(`Already assigned to @${issue.assignee.login} — likely taken`);
    }
    const claimComment = (comments as any[]).find((c) =>
      CLAIM_PHRASES.some((p) => (c.body || "").toLowerCase().includes(p))
    );
    if (claimComment) {
      redFlags.push(
        `A comment from @${claimComment.user?.login || "someone"} suggests it may already be claimed`
      );
    }
    if ((issue as any).pull_request) {
      redFlags.push(`This item is actually a pull request, not an open issue`);
    }

    // Clamp and bucket
    score = Math.max(0, Math.min(100, score));
    const level =
      score <= 33 ? "beginner-friendly" : score <= 66 ? "intermediate" : "advanced";

    // Confidence: more signals + comments read => more confident
    const confidence =
      signals.length >= 3 ? "high" : signals.length >= 1 ? "medium" : "low";

    // Recommendation tailored to the asked experience level
    const levelRank: Record<string, number> = {
      "beginner-friendly": 1,
      intermediate: 2,
      advanced: 3,
    };
    const userRank: Record<string, number> = { beginner: 1, intermediate: 2, senior: 3 };
    const fits = (userRank[experienceLevel] ?? 1) >= levelRank[level];

    let recommendation: string;
    if (redFlags.length > 0) {
      recommendation = `Caution: ${redFlags[0]}. Even if the difficulty fits, confirm it's still available before starting.`;
    } else if (fits) {
      recommendation = `Looks like a reasonable match for a ${experienceLevel} contributor.`;
    } else {
      recommendation = `Assessed as ${level}, which may be a stretch for a ${experienceLevel} contributor. Consider pairing it with the codebase docs first.`;
    }

    return NextResponse.json({
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
      },
      assessment: {
        score,
        level,
        confidence,
        experienceLevel,
        fitsExperienceLevel: fits,
        signals,
        redFlags,
        recommendation,
        meta: {
          comments: issue.comments,
          ageDays,
          labels,
          isAssigned: !!issue.assignee,
          repoLanguage: repoData.language || null,
          repoStars: repoData.stargazers_count,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "ASSESS_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
