import { NextRequest, NextResponse } from "next/server";
import { getRecentClosedPRs, getPRFirstResponseAt } from "@/lib/github";

/**
 * estimate_first_response_time
 *
 * Answers "if I contribute here, will anyone respond?" — a project-level
 * responsiveness signal. Samples recent CLOSED pull requests and computes:
 *   - median time to first response (first activity from a NON-author:
 *     comment or review) — the key "will I be ignored?" metric
 *   - median time to merge/close
 *
 * Uses medians (robust to outliers) over a small sample to stay fast.
 *
 * Honesty note: "first response" is approximated as first activity from
 * someone other than the PR author (maintainer OR community member), because
 * reliably identifying maintainers isn't always possible. Labeled as an
 * estimate in the output.
 */

const HOUR = 1000 * 60 * 60;

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function hoursBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / HOUR;
}

function humanizeHours(h: number | null): string {
  if (h === null) return "unknown";
  if (h < 1) return "under an hour";
  if (h < 48) return `${Math.round(h)} hours`;
  return `${Math.round(h / 24)} days`;
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    console.log("[tool:estimate_first_response_time] executed with input:", JSON.stringify(input));

    const [owner, repo] = (input.projectId || "").split("/");
    if (!owner || !repo) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PROJECT_ID",
            message: "projectId must be in format owner/repo",
          },
        },
        { status: 400 }
      );
    }

    const sampleSize = Math.max(3, Math.min(15, Number(input.sampleSize) || 10));
    const prs = (await getRecentClosedPRs(owner, repo, { perPage: sampleSize })) as any[];

    if (!prs || prs.length === 0) {
      return NextResponse.json({
        project: `${owner}/${repo}`,
        responsiveness: {
          rating: "unknown",
          note: "No recent closed pull requests found to sample.",
          sampleSize: 0,
        },
      });
    }

    // For each PR, compute time-to-first-response (non-author) and time-to-merge/close.
    const firstResponseHours: number[] = [];
    const mergeHours: number[] = [];

    await Promise.all(
      prs.map(async (pr) => {
        const created = pr.created_at;
        const closed = pr.merged_at || pr.closed_at;
        if (created && closed) {
          mergeHours.push(hoursBetween(created, closed));
        }
        const firstAt = await getPRFirstResponseAt(
          owner,
          repo,
          pr.number,
          pr.user?.login ?? null
        );
        if (firstAt) {
          firstResponseHours.push(hoursBetween(created, firstAt));
        }
      })
    );

    const medFirst = median(firstResponseHours);
    const medMerge = median(mergeHours);

    // Rating buckets based on median time to first response.
    let rating: "very-responsive" | "responsive" | "slow" | "very-slow" | "unknown";
    if (medFirst === null) {
      rating = "unknown";
    } else if (medFirst <= 24) {
      rating = "very-responsive";
    } else if (medFirst <= 24 * 3) {
      rating = "responsive";
    } else if (medFirst <= 24 * 14) {
      rating = "slow";
    } else {
      rating = "very-slow";
    }

    const recommendationByRating: Record<string, string> = {
      "very-responsive":
        "Maintainers typically respond within a day. Your PR is unlikely to be ignored.",
      responsive:
        "Maintainers usually respond within a few days. A reasonable place to contribute.",
      slow:
        "Responses can take one to two weeks. Be patient and consider pinging politely if it stalls.",
      "very-slow":
        "First responses often take longer than two weeks. Your PR may sit for a while — factor that in.",
      unknown:
        "Not enough non-author activity in the sample to estimate responsiveness reliably.",
    };

    return NextResponse.json({
      project: `${owner}/${repo}`,
      responsiveness: {
        rating,
        medianHoursToFirstResponse: medFirst === null ? null : Math.round(medFirst),
        medianTimeToFirstResponse: humanizeHours(medFirst),
        medianHoursToMerge: medMerge === null ? null : Math.round(medMerge),
        medianTimeToMerge: humanizeHours(medMerge),
        sampleSize: prs.length,
        respondedCount: firstResponseHours.length,
        note: "First response = first comment or review by someone other than the PR author (maintainer or community). This is an estimate.",
        recommendation: recommendationByRating[rating],
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "RESPONSE_TIME_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
