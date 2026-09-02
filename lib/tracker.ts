"use client";

/**
 * Shared client-side tracker store.
 *
 * The app has no login/database, so localStorage is the single source of truth
 * for tracked contributions. BOTH the human "Track" button and the agent's
 * track_contribution WebMCP tool write here, so the dashboard stays in sync
 * no matter who did the tracking.
 *
 * We also dispatch a "tracker:updated" event so an already-open dashboard
 * re-renders live without a manual refresh.
 */

export const TRACKER_KEY = "tracked_projects";
export const TRACKER_EVENT = "tracker:updated";

export type TrackStatus =
  | "interested"
  | "in-progress"
  | "pr-submitted"
  | "merged"
  | "abandoned";

export interface TrackedProject {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  language: string;
  status: TrackStatus;
  notes: string;
  issueId?: string | null;
  trackedAt: string;
  updatedAt: string;
}

export function readTracked(): TrackedProject[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(TRACKER_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeTracked(list: TrackedProject[]) {
  localStorage.setItem(TRACKER_KEY, JSON.stringify(list));
  // Notify any open views (dashboard) in this tab.
  window.dispatchEvent(new CustomEvent(TRACKER_EVENT));
}

/**
 * Normalize a project identifier for fuzzy matching. The agent doesn't always
 * reproduce the exact stored id (e.g. "Auto-GPT" vs "AutoGPT", different case,
 * or "autogpt" without the owner), which would otherwise create a duplicate
 * tracker entry. We compare on a normalized key: lowercased, hyphens/dots/
 * underscores stripped, and — for owner/repo strings — the repo portion.
 */
function normalizeKey(id: string): string {
  if (!id) return "";
  const base = id.split("#")[0]; // drop any #issue suffix
  const repo = base.includes("/") ? base.split("/").pop()! : base;
  return repo.toLowerCase().replace(/[-_.\s]/g, "");
}

/**
 * Find an existing tracked entry that matches `id` either exactly or fuzzily
 * (same normalized repo key). Exact matches win; otherwise the first normalized
 * match is returned.
 */
function findExisting(list: TrackedProject[], id: string): TrackedProject | undefined {
  const exact = list.find((p) => p.id === id);
  if (exact) return exact;
  const key = normalizeKey(id);
  if (!key) return undefined;
  return list.find((p) => normalizeKey(p.id) === key || normalizeKey(p.fullName) === key);
}

/**
 * Upsert a tracked entry. If it already exists (matched exactly OR fuzzily by
 * normalized repo name), we update status / notes / issueId and bump updatedAt;
 * otherwise we create a new entry. Partial project metadata is fine — the agent
 * often only knows the projectId.
 */
export function upsertTracked(
  entry: {
    id: string;
    status?: TrackStatus;
    notes?: string;
    issueId?: string | null;
  } & Partial<Omit<TrackedProject, "id" | "status" | "notes" | "issueId">>
): TrackedProject {
  const list = readTracked();
  const now = new Date().toISOString();
  const existing = findExisting(list, entry.id);

  if (existing) {
    if (entry.status) existing.status = entry.status;
    if (entry.notes !== undefined) existing.notes = entry.notes;
    if (entry.issueId !== undefined) existing.issueId = entry.issueId;
    if (entry.fullName) existing.fullName = entry.fullName;
    if (entry.name) existing.name = entry.name;
    if (entry.description) existing.description = entry.description;
    if (entry.url) existing.url = entry.url;
    if (entry.stars !== undefined) existing.stars = entry.stars as number;
    if (entry.language) existing.language = entry.language;
    existing.updatedAt = now;
    writeTracked(list);
    return existing;
  }

  const created: TrackedProject = {
    id: entry.id,
    name: entry.name || entry.fullName || entry.id,
    fullName: entry.fullName || entry.id,
    description: entry.description || "",
    url: entry.url || `https://github.com/${entry.id.split("#")[0]}`,
    stars: (entry.stars as number) || 0,
    language: entry.language || "",
    status: entry.status || "interested",
    notes: entry.notes || "",
    issueId: entry.issueId ?? null,
    trackedAt: now,
    updatedAt: now,
  };
  list.push(created);
  writeTracked(list);
  return created;
}

export function updateTracked(id: string, patch: Partial<TrackedProject>) {
  const list = readTracked();
  const next = list.map((p) =>
    p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
  );
  writeTracked(next);
  return next;
}

export function removeTracked(id: string) {
  const next = readTracked().filter((p) => p.id !== id);
  writeTracked(next);
  return next;
}

/**
 * Aggregate stats about the user's tracked contributions, computed purely from
 * the tracker store. Consumed by the `summarize_my_progress` WebMCP tool so the
 * agent can tell the user how their open-source journey is going.
 */
export interface ProgressSummary {
  total: number;
  statusCounts: Record<TrackStatus, number>;
  /** Tech stacks (languages) ranked by how many tracked projects use them. */
  topLanguages: { language: string; count: number }[];
  /** The single most-used language, or null when none is recorded. */
  mostUsedLanguage: string | null;
  /** Projects that reached "merged", ordered by how quickly they got there. */
  fastestMerged: {
    fullName: string;
    language: string;
    /** Whole days between first tracked and last update. */
    days: number;
  }[];
  /** Average days-to-merge across merged projects, or null when none merged. */
  averageDaysToMerge: number | null;
  /** The earliest-tracked project (start of the journey), or null when empty. */
  firstTracked: { fullName: string; trackedAt: string } | null;
  /** The most recently updated project, or null when empty. */
  mostRecent: { fullName: string; updatedAt: string } | null;
  /** Completion rate = merged / total, as a 0..1 fraction. */
  completionRate: number;
}

const ALL_STATUSES: TrackStatus[] = [
  "interested",
  "in-progress",
  "pr-submitted",
  "merged",
  "abandoned",
];

const DAY_MS = 1000 * 60 * 60 * 24;

/** Whole days between two ISO timestamps (>= 0), or null if either is invalid. */
function daysBetween(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

/**
 * Compute a progress summary from the tracked-projects store. Pure and
 * deterministic — pass an explicit list, or omit to read the live store.
 */
export function summarizeProgress(
  projects: TrackedProject[] = readTracked()
): ProgressSummary {
  const statusCounts = ALL_STATUSES.reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<TrackStatus, number>
  );

  const languageCounts = new Map<string, number>();

  for (const p of projects) {
    if (p.status && statusCounts[p.status as TrackStatus] !== undefined) {
      statusCounts[p.status as TrackStatus] += 1;
    }
    const lang = (p.language || "").trim();
    if (lang) {
      languageCounts.set(lang, (languageCounts.get(lang) ?? 0) + 1);
    }
  }

  const topLanguages = Array.from(languageCounts.entries())
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language));

  const mostUsedLanguage = topLanguages.length > 0 ? topLanguages[0].language : null;

  // Merged projects ranked by how quickly they went from tracked -> updated.
  const merged = projects.filter((p) => p.status === "merged");
  const fastestMerged = merged
    .map((p) => ({
      fullName: p.fullName || p.id,
      language: p.language || "",
      days: daysBetween(p.trackedAt, p.updatedAt) ?? 0,
    }))
    .sort((a, b) => a.days - b.days);

  const averageDaysToMerge =
    fastestMerged.length > 0
      ? Math.round(
          fastestMerged.reduce((sum, m) => sum + m.days, 0) / fastestMerged.length
        )
      : null;

  // Earliest tracked (journey start) and most recently touched.
  let firstTracked: ProgressSummary["firstTracked"] = null;
  let mostRecent: ProgressSummary["mostRecent"] = null;
  for (const p of projects) {
    if (!firstTracked || Date.parse(p.trackedAt) < Date.parse(firstTracked.trackedAt)) {
      firstTracked = { fullName: p.fullName || p.id, trackedAt: p.trackedAt };
    }
    if (!mostRecent || Date.parse(p.updatedAt) > Date.parse(mostRecent.updatedAt)) {
      mostRecent = { fullName: p.fullName || p.id, updatedAt: p.updatedAt };
    }
  }

  const total = projects.length;
  const completionRate = total > 0 ? statusCounts.merged / total : 0;

  return {
    total,
    statusCounts,
    topLanguages,
    mostUsedLanguage,
    fastestMerged,
    averageDaysToMerge,
    firstTracked,
    mostRecent,
    completionRate,
  };
}
