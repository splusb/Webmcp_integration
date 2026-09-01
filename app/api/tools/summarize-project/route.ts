import { NextRequest, NextResponse } from "next/server";
import { getRepository, getContributingGuide, getCommunityProfile, getRepositoryLanguages } from "@/lib/github";
import { normalizeLanguages } from "@/lib/viz/languages";

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    console.log("[tool:summarize_project] executed with input:", JSON.stringify(input));
    const [owner, repo] = input.projectId.split("/");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: { code: "INVALID_PROJECT_ID", message: "projectId must be in format owner/repo" } },
        { status: 400 }
      );
    }

    // The stats panel only needs repo data + language breakdown, so it can pass
    // includeCommunityMetrics:false / includeContributionGuide:false to skip the
    // two slow calls (getCommunityProfileMetrics is one of GitHub's slowest
    // endpoints, and reading CONTRIBUTING.md is an extra round trip). The agent's
    // summarize_project tool still gets the full picture by default.
    const wantCommunity = input.includeCommunityMetrics !== false;
    const wantGuide = input.includeContributionGuide !== false;

    // Run every needed call in PARALLEL instead of sequentially. Optional calls
    // resolve to null when not requested so the response shape is unchanged.
    const [repoData, community, contributingGuide, langMap] = await Promise.all([
      getRepository(owner, repo),
      wantCommunity ? getCommunityProfile(owner, repo) : Promise.resolve(null),
      wantGuide ? getContributingGuide(owner, repo) : Promise.resolve(null),
      getRepositoryLanguages(owner, repo),
    ]);

    const languages = langMap ? normalizeLanguages(langMap) : [];

    const project: {
      id: string;
      name: string;
      purpose: string;
      techStack: string[];
      license: string;
      stars: number;
      forks: number;
      openIssues: number;
      languages?: { name: string; percent: number }[];
    } = {
      id: repoData.full_name,
      name: repoData.name,
      purpose: repoData.description || "No description available",
      techStack: [repoData.language, ...(repoData.topics || [])].filter(Boolean),
      license: repoData.license?.spdx_id || "Unknown",
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
    };

    if (languages.length > 0) {
      project.languages = languages;
    }

    const summary = {
      project,
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
