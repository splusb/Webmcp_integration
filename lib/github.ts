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
