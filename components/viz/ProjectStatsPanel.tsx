"use client";

/**
 * Recharts-based project statistics panel (Stats_Chart_Module).
 *
 * Renders inside an expandable panel on a Result_Card (see Requirement 3,
 * option b). Lazily fetches project statistics from the existing
 * `summarize_project` tool path the first time the panel is opened and reuses
 * the fetched data on subsequent expand/collapse of the same project.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.5.
 */

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { VizLoading, VizEmpty, VizError } from "./states";
import type { LanguageSlice } from "@/lib/viz/languages";

/**
 * Shape of the successful `/api/tools/summarize-project` response, limited to
 * the fields this panel consumes. The route may instead return `{ error }`.
 */
interface SummarizeResponse {
  project: {
    id: string;
    name: string;
    purpose: string;
    techStack: string[];
    license: string;
    stars: number;
    forks: number;
    openIssues: number;
    languages?: LanguageSlice[];
  };
  community?: unknown;
  contribution?: unknown;
  recentActivity: {
    lastCommit: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
}

interface SummarizeError {
  error: { code?: string; message?: string };
}

type StatsState = {
  status: "loading" | "ready" | "error";
  data?: SummarizeResponse;
  error?: string;
};

/**
 * Module-level cache keyed by `projectId`. Persisting outside the component
 * means collapsing then re-expanding the same card reads from cache and never
 * refetches (Requirement 3.5).
 */
const statsCache = new Map<string, StatsState>();

/** Projects with a fetch currently in flight, so concurrent effect passes
 * (React Strict Mode double-invoke, or two cards of the same repo) don't kick
 * off duplicate requests. */
const inFlight = new Set<string>();

/** Neutral, tailwind-ish palette for pie slices and bars. */
const COLORS = [
  "#2563eb",
  "#16a34a",
  "#9333ea",
  "#eab308",
  "#dc2626",
  "#0891b2",
];

const DAY_MS = 1000 * 60 * 60 * 24;

/** Whole days between `iso` and now, or null when the timestamp is missing/invalid. */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const diff = Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
  return diff;
}

function ChartHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
      {children}
    </h4>
  );
}

export default function ProjectStatsPanel({
  projectId,
  open,
  initialStars,
  initialLanguage,
  initialTopics,
}: {
  projectId: string;
  open: boolean;
  initialStars?: number;
  initialLanguage?: string;
  initialTopics?: string[];
}) {
  // A monotonically increasing tick used purely to force a re-render after we
  // write into the module-level cache from an async callback.
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!open) return;

    const existing = statsCache.get(projectId);
    // Already have a terminal result (ready/error) — just show it.
    if (existing && existing.status !== "loading") {
      rerender();
      return;
    }
    // A fetch is already in flight for this project (e.g. Strict Mode's second
    // effect pass, or another card with the same repo) — don't start a second
    // one. When it resolves it writes to the shared cache; we re-read on the
    // next render. We still poll briefly so THIS instance re-renders once the
    // in-flight fetch (owned by another pass) completes.
    if (existing && existing.status === "loading" && inFlight.has(projectId)) {
      let done = false;
      const poll = setInterval(() => {
        const s = statsCache.get(projectId);
        if (s && s.status !== "loading") {
          done = true;
          clearInterval(poll);
          rerender();
        }
      }, 120);
      return () => {
        if (!done) clearInterval(poll);
      };
    }

    // We are the owner of this fetch.
    statsCache.set(projectId, { status: "loading" });
    inFlight.add(projectId);
    rerender();

    void (async () => {
      try {
        const res = await fetch("/api/tools/summarize-project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The charts only need repo data + language breakdown, so skip the two
          // slow calls (community profile metrics + CONTRIBUTING.md fetch) for a
          // much faster panel load.
          body: JSON.stringify({
            projectId,
            includeCommunityMetrics: false,
            includeContributionGuide: false,
          }),
        });
        const json: SummarizeResponse | SummarizeError = await res.json();

        if (json && typeof json === "object" && "error" in json && json.error) {
          statsCache.set(projectId, {
            status: "error",
            error: json.error?.message || "Failed to load stats.",
          });
        } else {
          statsCache.set(projectId, {
            status: "ready",
            data: json as SummarizeResponse,
          });
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load stats.";
        statsCache.set(projectId, { status: "error", error: message });
      } finally {
        // Write results unconditionally to the shared cache (do NOT gate on a
        // per-effect cancelled flag — Strict Mode's cleanup would otherwise
        // discard the only in-flight result and leave the panel stuck loading).
        inFlight.delete(projectId);
        rerender();
      }
    })();
    // Re-run when the panel opens or the target project changes.
  }, [open, projectId]);

  if (!open) return null;

  const state = statsCache.get(projectId);

  if (!state || state.status === "loading") {
    return (
      <div className="mt-3 border-t pt-3">
        <VizLoading label="Loading stats..." />
      </div>
    );
  }

  if (state.status === "error") {
    const handleRetry = () => {
      statsCache.delete(projectId);
      rerender();
    };
    return (
      <div className="mt-3 border-t pt-3">
        <VizError message={state.error} onRetry={handleRetry} />
      </div>
    );
  }

  const data = state.data!;

  // Chart 1: stars / forks / open issues.
  const countData = [
    { name: "Stars", value: data.project.stars ?? initialStars ?? 0 },
    { name: "Forks", value: data.project.forks ?? 0 },
    { name: "Open Issues", value: data.project.openIssues ?? 0 },
  ];

  // Chart 2: language/topic breakdown. Prefer real language slices; fall back
  // to topics (techStack minus the primary language) rendered as equal slices.
  let breakdownData: LanguageSlice[] = [];
  if (data.project.languages && data.project.languages.length > 0) {
    breakdownData = data.project.languages;
  } else {
    const topics =
      data.project.techStack && data.project.techStack.length > 1
        ? data.project.techStack.slice(1)
        : (initialTopics ?? []);
    if (topics.length > 0) {
      const share = 100 / topics.length;
      breakdownData = topics.map((name) => ({ name, percent: share }));
    }
  }

  // Chart 3: recent-activity recency in days.
  const age = daysSince(data.recentActivity?.createdAt);
  const sinceUpdate = daysSince(data.recentActivity?.updatedAt);
  const sinceCommit = daysSince(data.recentActivity?.lastCommit);
  const hasActivity = age !== null || sinceUpdate !== null || sinceCommit !== null;
  const activityData = [
    { name: "Repo age", value: age ?? 0 },
    { name: "Since update", value: sinceUpdate ?? 0 },
    { name: "Since commit", value: sinceCommit ?? 0 },
  ];

  return (
    <div className="mt-3 space-y-4 border-t pt-3">
      {/* Chart 1: Stars / Forks / Open Issues */}
      <div>
        <ChartHeading>Popularity</ChartHeading>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={countData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
              width={40}
              allowDecimals={false}
            />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {countData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Language / topic breakdown */}
      <div>
        <ChartHeading>Language &amp; Topics</ChartHeading>
        {breakdownData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={breakdownData}
                dataKey="percent"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {breakdownData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}%`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <VizEmpty title="No language data" />
        )}
      </div>

      {/* Chart 3: Recent activity recency (days) */}
      <div>
        <ChartHeading>Recent Activity (days)</ChartHeading>
        {hasActivity ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={activityData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
                width={40}
                allowDecimals={false}
              />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {activityData.map((_, i) => (
                  <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <VizEmpty title="No activity data" />
        )}
      </div>
    </div>
  );
}
