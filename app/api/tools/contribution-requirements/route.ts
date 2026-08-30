import { NextRequest, NextResponse } from "next/server";
import { getContributingGuide, getCommunityProfile, getRepository } from "@/lib/github";

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    const [owner, repo] = input.projectId.split("/");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: { code: "INVALID_PROJECT_ID", message: "projectId must be in format owner/repo" } },
        { status: 400 }
      );
    }

    const [repoData, contributingGuide, community] = await Promise.all([
      getRepository(owner, repo),
      getContributingGuide(owner, repo),
      getCommunityProfile(owner, repo),
    ]);

    const requirements = {
      projectId: input.projectId,
      requirements: {
        hasContributingGuide: !!contributingGuide,
        contributingGuide: contributingGuide?.substring(0, 2000) || null,
        hasCodeOfConduct: !!community?.files?.code_of_conduct,
        license: repoData.license?.spdx_id || "Unknown",
        primaryLanguage: repoData.language,
        hasIssueTemplates: !!community?.files?.issue_template,
        hasPrTemplate: !!community?.files?.pull_request_template,
        defaultBranch: repoData.default_branch,
      },
    };

    return NextResponse.json(requirements);
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "REQUIREMENTS_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
