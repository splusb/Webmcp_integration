import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getRepository,
  getReadme,
  getContributingGuide,
  getIssueDetail,
} from "@/lib/github";

/**
 * draft_contribution_plan
 *
 * A "tool that thinks": it fetches real GitHub context (repo metadata, README,
 * CONTRIBUTING guide, and optionally a specific issue), then calls OpenAI to
 * SYNTHESIZE a concrete step-by-step first-contribution plan.
 *
 * Unlike the deterministic tools, this one uses the OpenAI key on the server
 * to generate guidance. It reuses the existing GitHub data layer (GitHub only).
 */

// Keep the prompt bounded: docs can be huge, so send only the leading portion.
function clip(text: string | null, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "\n...[truncated]" : text;
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    console.log("[tool:draft_contribution_plan] executed with input:", JSON.stringify(input));

    const [owner, repo] = (input.projectId || "").split("/");
    if (!owner || !repo) {
      return NextResponse.json(
        { error: { code: "INVALID_PROJECT_ID", message: "projectId must be in format owner/repo" } },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "xy") {
      return NextResponse.json(
        {
          error: {
            code: "missing_openai_key",
            message:
              "OPENAI_API_KEY is not set (still the placeholder 'xy'). This tool needs OpenAI to synthesize the plan.",
          },
        },
        { status: 500 }
      );
    }

    const experienceLevel: string = input.experienceLevel || "beginner";
    const issueNumber = input.issueId ? parseInt(input.issueId, 10) : NaN;
    const wantIssue = !isNaN(issueNumber);

    // Gather real GitHub context (in parallel). All reuse existing helpers.
    const [repoData, readme, contributing, issue] = await Promise.all([
      getRepository(owner, repo).catch(() => null),
      getReadme(owner, repo).catch(() => null),
      getContributingGuide(owner, repo).catch(() => null),
      wantIssue ? getIssueDetail(owner, repo, issueNumber).catch(() => null) : Promise.resolve(null),
    ]);

    if (!repoData) {
      return NextResponse.json(
        { error: { code: "REPO_NOT_FOUND", message: `Could not load ${owner}/${repo}` } },
        { status: 404 }
      );
    }

    // Build a focused context block for the model.
    const contextParts: string[] = [
      `Repository: ${owner}/${repo}`,
      `Description: ${(repoData as any).description || "n/a"}`,
      `Primary language: ${(repoData as any).language || "n/a"}`,
      `Topics: ${((repoData as any).topics || []).join(", ") || "n/a"}`,
    ];
    if (issue) {
      contextParts.push(
        `\nISSUE #${(issue as any).number}: ${(issue as any).title}`,
        `Issue body:\n${clip((issue as any).body, 1500)}`
      );
    }
    contextParts.push(`\nREADME (excerpt):\n${clip(readme, 3000) || "n/a"}`);
    contextParts.push(`\nCONTRIBUTING (excerpt):\n${clip(contributing, 2500) || "n/a"}`);

    const systemPrompt = `You help developers make their first contribution to an open-source project.
Given real repository context, produce a concrete, actionable step-by-step plan for a ${experienceLevel} contributor.
Structure the plan with these sections:
1. Setup — exact clone/install commands you can infer from the README (use fenced code blocks).
2. Where to look — likely files/directories relevant to the task (based on language/topics/issue).
3. Make the change — a short approach.
4. Run tests — the test command if the README/CONTRIBUTING mentions one.
5. Open the PR — branch naming and PR checklist from the CONTRIBUTING guide.
Rules: Be specific but HONEST. If the docs don't state something (e.g. the test command), say "not documented — check the repo" rather than inventing it. Keep it concise and skimmable.`;

    const userPrompt = `Here is the repository context:\n\n${contextParts.join("\n")}\n\nWrite the first-contribution plan now.`;

    const openai = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    });

    const plan = completion.choices[0]?.message?.content?.trim() || "No plan could be generated.";

    return NextResponse.json({
      project: `${owner}/${repo}`,
      issue: issue
        ? { number: (issue as any).number, title: (issue as any).title, url: (issue as any).html_url }
        : null,
      plan,
      sources: {
        hasReadme: !!readme,
        hasContributing: !!contributing,
        usedIssue: !!issue,
      },
      note: "This plan is AI-generated from the repo's README, CONTRIBUTING guide, and (if given) the issue. Verify commands against the latest project docs before running.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "PLAN_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
