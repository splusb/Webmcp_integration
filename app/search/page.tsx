"use client";

import { useState } from "react";
import { WebMCPToolRegistry } from "@/components/webmcp/ToolRegistry";
import { ProjectCard } from "@/components/ProjectCard";

const LANGUAGES = [
  "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust",
  "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin",
];

const DOMAINS = [
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "ml", label: "Machine Learning" },
  { value: "devtools", label: "Dev Tools" },
  { value: "data", label: "Data" },
  { value: "security", label: "Security" },
  { value: "gaming", label: "Gaming" },
];

const SORT_OPTIONS = [
  { value: "stars", label: "Most Stars" },
  { value: "forks", label: "Most Forked" },
  { value: "updated", label: "Recently Updated" },
  { value: "match", label: "Best Match" },
];

type SearchMode = "search" | "skills";

export default function SearchPage() {
  // Mode
  const [mode, setMode] = useState<SearchMode>("skills");

  // Skill match filters
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
  const [experience, setExperience] = useState("beginner");

  // Search filters
  const [language, setLanguage] = useState("");
  const [domain, setDomain] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [minStars, setMinStars] = useState("");
  const [goodFirstIssues, setGoodFirstIssues] = useState(true);
  const [activelyMaintained, setActivelyMaintained] = useState(true);

  // Results
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState("stars");
  const [searched, setSearched] = useState(false);

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  function addCustomSkill() {
    const trimmed = customSkill.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      setSelectedSkills((prev) => [...prev, trimmed]);
      setCustomSkill("");
    }
  }

  async function handleSkillMatch() {
    if (selectedSkills.length === 0) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/tools/match-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: selectedSkills,
          experienceLevel: experience,
        }),
      });
      const data = await res.json();
      setResults(data.projects || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/tools/search-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technologies: language ? [language] : undefined,
          domain: domain || undefined,
          difficulty: difficulty || undefined,
          minStars: minStars ? parseInt(minStars) : undefined,
          hasGoodFirstIssues: goodFirstIssues,
          activelyMaintained: activelyMaintained,
          limit: 20,
        }),
      });
      const data = await res.json();
      setResults(data.projects || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function sortedResults() {
    const sorted = [...results];
    switch (sortBy) {
      case "stars":
        return sorted.sort((a, b) => b.stars - a.stars);
      case "forks":
        return sorted.sort((a, b) => b.forks - a.forks);
      case "updated":
        return sorted.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
      case "match":
        return sorted.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      default:
        return sorted;
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <WebMCPToolRegistry />
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Discover Projects</h1>
            <p className="mt-1 text-gray-600">Find your next open source contribution</p>
          </div>
          <a href="/" className="text-sm text-gray-500 hover:text-gray-900">Home</a>
        </div>

        {/* Mode Toggle */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setMode("skills")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "skills"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            Match by Skills
          </button>
          <button
            onClick={() => setMode("search")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "search"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            Search with Filters
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Sidebar Filters */}
          <div className="space-y-6">
            {mode === "skills" ? (
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Your Skills</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => toggleSkill(lang)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selectedSkills.includes(lang)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom skill..."
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSkill())}
                    className="flex-1 rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addCustomSkill}
                    className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-300"
                  >
                    Add
                  </button>
                </div>
                {selectedSkills.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">Selected:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedSkills.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                        >
                          {s}
                          <button onClick={() => toggleSkill(s)} className="hover:text-blue-600">x</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <h3 className="mt-5 text-sm font-semibold text-gray-900 uppercase tracking-wide">Experience Level</h3>
                <div className="mt-2 flex flex-col gap-1.5">
                  {["beginner", "intermediate", "senior"].map((level) => (
                    <label key={level} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="experience"
                        value={level}
                        checked={experience === level}
                        onChange={() => setExperience(level)}
                        className="accent-blue-600"
                      />
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleSkillMatch}
                  disabled={selectedSkills.length === 0 || loading}
                  className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Finding matches..." : "Find Matching Projects"}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any language</option>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Domain</label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any domain</option>
                    {DOMAINS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any difficulty</option>
                    <option value="beginner">Beginner Friendly</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Min Stars</label>
                  <input
                    type="number"
                    value={minStars}
                    onChange={(e) => setMinStars(e.target.value)}
                    placeholder="e.g. 100"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={goodFirstIssues}
                      onChange={(e) => setGoodFirstIssues(e.target.checked)}
                      className="accent-blue-600"
                    />
                    Has good first issues
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={activelyMaintained}
                      onChange={(e) => setActivelyMaintained(e.target.checked)}
                      className="accent-blue-600"
                    />
                    Actively maintained
                  </label>
                </div>

                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Searching..." : "Search Projects"}
                </button>
              </div>
            )}
          </div>

          {/* Results */}
          <div>
            {results.length > 0 && (
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">{results.length} projects found</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Sort by:</span>
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSortBy(opt.value)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        sortBy === opt.value
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-600 border hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {loading && (
                <div className="py-16 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                  <p className="mt-3 text-sm text-gray-500">Searching GitHub...</p>
                </div>
              )}

              {!loading && sortedResults().map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}

              {!loading && searched && results.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-lg text-gray-500">No projects found</p>
                  <p className="mt-1 text-sm text-gray-400">Try broadening your filters or adding different skills.</p>
                </div>
              )}

              {!loading && !searched && (
                <div className="py-16 text-center">
                  <p className="text-lg text-gray-400">
                    {mode === "skills"
                      ? "Select your skills and click Find Matching Projects"
                      : "Set your filters and click Search Projects"}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    Or open this page in ChatGPT to let an AI agent find projects for you.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
