"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { upsertTracked } from "@/lib/tracker";
import ProjectStatsPanel from "@/components/viz/ProjectStatsPanel";
import { VizErrorBoundary } from "@/components/viz/VizErrorBoundary";

interface ProjectCardProps {
  project: Project;
  onTrack?: (project: Project) => void;
  isTracked?: boolean;
}

export function ProjectCard({ project, onTrack, isTracked = false }: ProjectCardProps) {
  const [tracked, setTracked] = useState(isTracked);
  const [saving, setSaving] = useState(false);
  // Per-card expand state — each ProjectCard instance owns its own flag (Req 3.6).
  const [expanded, setExpanded] = useState(false);

  async function handleTrack() {
    setSaving(true);
    try {
      const id = project.id || project.fullName;
      // Best-effort server log (keeps demo console output).
      fetch("/api/tools/track-contribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, status: "interested" }),
      }).catch(() => {});

      // Shared tracker store — same one the agent and dashboard use.
      upsertTracked({
        id,
        name: project.name,
        fullName: project.fullName,
        description: project.description,
        url: project.url,
        stars: project.stars,
        language: project.language,
        status: "interested",
      });

      setTracked(true);
      onTrack?.(project);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">
            <a href={project.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
              {project.fullName || project.name}
            </a>
          </h3>
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{project.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {project.matchScore !== undefined && project.matchScore > 0 && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              {Math.round(project.matchScore * 100)}% match
            </span>
          )}
          <button
            onClick={handleTrack}
            disabled={tracked || saving}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tracked
                ? "bg-green-100 text-green-700 cursor-default"
                : "bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700"
            }`}
          >
            {saving ? "Saving..." : tracked ? "Tracked" : "Track"}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {project.language && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{project.language}</span>
        )}
        {(project.topics || []).slice(0, 4).map((topic) => (
          <span key={topic} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{topic}</span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span>&#9733; {(project.stars || 0).toLocaleString()}</span>
        <span>{(project.forks || 0).toLocaleString()} forks</span>
        <span>{project.openIssueCount || 0} issues</span>
        {project.license && <span>{project.license}</span>}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700"
        >
          {expanded ? "\u25BE" : "\u25B8"} Stats
        </button>
      </div>
      {expanded && (
        <VizErrorBoundary>
          <ProjectStatsPanel
            projectId={project.fullName || project.id}
            open={expanded}
            initialStars={project.stars}
            initialLanguage={project.language}
            initialTopics={project.topics}
          />
        </VizErrorBoundary>
      )}
    </div>
  );
}
