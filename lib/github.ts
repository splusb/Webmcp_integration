import { Octokit } from "@octokit/rest";
import { cache } from "./cache";
import type { Project, Issue, ProjectSummary, ContributionRequirements } from "./types";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function searchRepositories(
  query: string,
  options: { sort?: string; order?: string; perPage?: number } = {}
) {
  const cacheKey = `search:${query}:${JSON.stringify(options)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data } = await octokit.search.repos({
    q: query,
    sort: (options.sort as any) || "stars",
    order: (options.order as any) || "desc",
    per_page: options.perPage || 10,
  });

  cache.set(cacheKey, data, 3600); // 1 hour cache
  return data;
}

export async function getRepository(owner: string, repo: string) {
  const cacheKey = `repo:${owner}/${repo}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data } = await octokit.repos.get({ owner, repo });
  cache.set(cacheKey, data, 3600);
  return data;
}

export async function getIssues(
  owner: string,
  repo: string,
  options: { labels?: string; state?: string; perPage?: number } = {}
) {
  const cacheKey = `issues:${owner}/${repo}:${JSON.stringify(options)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data } = await octokit.issues.listForRepo({
    owner,
    repo,
    labels: options.labels,
    state: (options.state as any) || "open",
    per_page: options.perPage || 20,
  });

  cache.set(cacheKey, data, 900); // 15 min cache
  return data;
}

export async function getIssueDetail(owner: string, repo: string, issueNumber: number) {
  const cacheKey = `issue:${owner}/${repo}#${issueNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data } = await octokit.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  cache.set(cacheKey, data, 900);
  return data;
}

export async function getIssueComments(
  owner: string,
  repo: string,
  issueNumber: number,
  options: { perPage?: number } = {}
) {
  const cacheKey = `comments:${owner}/${repo}#${issueNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: options.perPage || 30,
    });
    cache.set(cacheKey, data, 900); // 15 min cache
    return data;
  } catch {
    return [];
  }
}

export async function searchIssueReferencingPRs(
  owner: string,
  repo: string,
  issueNumber: number
) {
  const cacheKey = `refprs:${owner}/${repo}#${issueNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    // Open PRs in this repo that mention the issue number (e.g. "Fixes #123").
    const q = `repo:${owner}/${repo} is:pr is:open ${issueNumber} in:body`;
    const { data } = await octokit.search.issuesAndPullRequests({
      q,
      per_page: 10,
    });
    // Filter to items that actually reference the exact issue number, and are PRs.
    const prs = (data.items || []).filter(
      (it: any) => it.pull_request && it.number !== issueNumber
    );
    cache.set(cacheKey, prs, 900); // 15 min cache
    return prs;
  } catch {
    return [];
  }
}

export async function getContributingGuide(owner: string, repo: string) {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: "CONTRIBUTING.md",
    });
    if ("content" in data) {
      return Buffer.from(data.content, "base64").toString();
    }
    return null;
  } catch {
    return null;
  }
}

export async function getReadme(owner: string, repo: string) {
  try {
    const { data } = await octokit.repos.getReadme({ owner, repo });
    if ("content" in data) {
      return Buffer.from(data.content, "base64").toString();
    }
    return null;
  } catch {
    return null;
  }
}

export async function getRepositoryLanguages(owner: string, repo: string) {
  const cacheKey = `languages:${owner}/${repo}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await octokit.repos.listLanguages({ owner, repo });
    cache.set(cacheKey, data, 3600); // 1 hour cache
    return data;
  } catch {
    return null;
  }
}

export async function getCommunityProfile(owner: string, repo: string) {
  try {
    const { data } = await octokit.repos.getCommunityProfileMetrics({ owner, repo });
    return data;
  } catch {
    return null;
  }
}

export { octokit };
