import { NextRequest, NextResponse } from "next/server";
import { getRepository, getContributingGuide, getCommunityProfile } from "@/lib/github";

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

    const repoData = await getRepository(owner, repo);
    const community = input.includeCommunityMetrics !== false ? await getCommunityProfile(owner, repo) : null;
    const contributingGuide = input.includeContributionGuide !== false ? await getContributingGuide(owner, repo) : null;

    const summary = {
      project: {
        id: repoData.full_name,
        name: repoData.name,
        purpose: repoData.description || "No description available",
        techStack: [repoData.language, ...(repoData.topics || [])].filter(Boolean),
        license: repoData.license?.spdx_id || "Unknown",
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
      },
      community: {
        communityHealth: community?.health_percentage ? community.health_percentage + "%" : "Unknown",
        hasCodeOfConduct: !!community?.files?.code_of_conduct,
        hasContributingGuide: !!community?.files?.contributing || !!contributingGuide,
        hasDiscussions: repoData.has_discussions || false,
      },
      contribution: {
        hasContributingGuide: !!contributingGuide,
        contributingGuideSummary: contributingGuide?.substring(0, 1000) || null,
      },
      recentActivity: {
        lastCommit: repoData.pushed_at,
        createdAt: repoData.created_at,
        updatedAt: repoData.updated_at,
      },
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "SUMMARY_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
