"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { WebMCPToolRegistry } from "@/components/webmcp/ToolRegistry";
import { VizErrorBoundary } from "@/components/viz/VizErrorBoundary";
import {
  readTracked,
  updateTracked,
  removeTracked,
  TRACKER_EVENT,
  type TrackedProject,
} from "@/lib/tracker";

// In a "use client" file, next/dynamic with ssr:false is allowed. The journey
// uses @xyflow/react and must render client-side only.
const ContributionJourney = dynamic(
  () => import("@/components/viz/ContributionJourney"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
        Loading journey…
      </div>
    ),
  }
);

const STATUS_COLORS: Record<string, string> = {
  interested: "bg-blue-100 text-blue-700",
  "in-progress": "bg-yellow-100 text-yellow-700",
  "pr-submitted": "bg-purple-100 text-purple-700",
  merged: "bg-green-100 text-green-700",
  abandoned: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  interested: "Interested",
  "in-progress": "In Progress",
  "pr-submitted": "PR Submitted",
  merged: "Merged",
  abandoned: "Abandoned",
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<TrackedProject[]>([]);
  // Local draft of notes per project id, so typing feels instant.
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({});

  const refresh = useCallback(() => {
    const list = readTracked();
    setProjects(list);
    setNoteDrafts((prev) => {
      const next = { ...prev };
      for (const p of list) if (next[p.id] === undefined) next[p.id] = p.notes || "";
      return next;
    });
  }, []);

  useEffect(() => {
    refresh();
    // Live update when the agent (or the Track button) writes to the store.
    const onUpdate = () => refresh();
    window.addEventListener(TRACKER_EVENT, onUpdate);
    // Also refresh when returning to this tab.
    window.addEventListener("focus", onUpdate);
    return () => {
      window.removeEventListener(TRACKER_EVENT, onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, [refresh]);

  function changeStatus(id: string, status: string) {
    updateTracked(id, { status: status as TrackedProject["status"] });
    refresh();
  }

  function saveNote(id: string) {
    updateTracked(id, { notes: noteDrafts[id] ?? "" });
    refresh();
    setSavedFlash((f) => ({ ...f, [id]: true }));
    setTimeout(() => setSavedFlash((f) => ({ ...f, [id]: false })), 1500);
  }

  function remove(id: string) {
    removeTracked(id);
    refresh();
  }

  const interested = projects.filter((p) => p.status === "interested").length;
  const inProgress = projects.filter((p) => p.status === "in-progress").length;
  const prSubmitted = projects.filter((p) => p.status === "pr-submitted").length;
  const merged = projects.filter((p) => p.status === "merged").length;

  return (
    <main className="min-h-screen bg-gray-50">
      <WebMCPToolRegistry />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
            <p className="mt-1 text-gray-600">Track your open source contribution journey.</p>
          </div>
          <a href="/search" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            Find Projects
          </a>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm text-center">
            <div className="text-3xl font-bold text-blue-600">{interested}</div>
            <div className="mt-1 text-sm text-gray-500">Interested</div>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm text-center">
            <div className="text-3xl font-bold text-yellow-600">{inProgress}</div>
            <div className="mt-1 text-sm text-gray-500">In Progress</div>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm text-center">
            <div className="text-3xl font-bold text-purple-600">{prSubmitted}</div>
            <div className="mt-1 text-sm text-gray-500">PRs Submitted</div>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm text-center">
            <div className="text-3xl font-bold text-green-600">{merged}</div>
            <div className="mt-1 text-sm text-gray-500">Merged</div>
          </div>
        </div>

        {/* Contribution Journey pipeline (progressive enhancement; reads the
            same tracker store, so it stays live on its own). */}
        <div className="mt-8">
          <VizErrorBoundary>
            <ContributionJourney />
          </VizErrorBoundary>
        </div>

        {/* Tracked Projects */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900">Tracked Projects</h2>
          {projects.length === 0 ? (
            <div className="mt-4 rounded-xl border bg-white p-12 shadow-sm text-center">
              <p className="text-gray-500">No contributions tracked yet.</p>
              <p className="mt-1 text-sm text-gray-400">
                Search for projects and click &ldquo;Track&rdquo;, or ask the agent to track one for you.
              </p>
              <a href="/search" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Discover Projects
              </a>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {projects.map((project) => (
                <div key={project.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-blue-700 hover:underline"
                        >
                          {project.fullName}
                        </a>
                        {project.issueId && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-mono text-gray-600">
                            #{project.issueId}
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[project.status]}`}>
                          {STATUS_LABELS[project.status]}
                        </span>
                      </div>
                      {project.description && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-1">{project.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                        {project.language && <span>{project.language}</span>}
                        {project.stars > 0 && <span>&#9733; {project.stars.toLocaleString()}</span>}
                        <span>Tracked {new Date(project.trackedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={project.status}
                        onChange={(e) => changeStatus(project.id, e.target.value)}
                        className="rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="interested">Interested</option>
                        <option value="in-progress">In Progress</option>
                        <option value="pr-submitted">PR Submitted</option>
                        <option value="merged">Merged</option>
                        <option value="abandoned">Abandoned</option>
                      </select>
                      <button
                        onClick={() => remove(project.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        title="Remove"
                      >
                        &#10005;
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mt-3 border-t pt-3">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      My Notes
                    </label>
                    <textarea
                      value={noteDrafts[project.id] ?? ""}
                      onChange={(e) =>
                        setNoteDrafts((d) => ({ ...d, [project.id]: e.target.value }))
                      }
                      placeholder="Log your findings, links, blockers, PR URL..."
                      rows={2}
                      className="mt-1 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                    <div className="mt-1 flex items-center justify-end gap-2">
                      {savedFlash[project.id] && (
                        <span className="text-xs text-green-600">Saved</span>
                      )}
                      <button
                        onClick={() => saveNote(project.id)}
                        disabled={(noteDrafts[project.id] ?? "") === (project.notes ?? "")}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-40"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
