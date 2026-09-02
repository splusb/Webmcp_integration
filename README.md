# OpenSource Discovery Hub

Finding your first (or next) open-source contribution is tedious: searching repos, vetting issues, checking if a project even reviews PRs. This app turns that into a conversation. You talk to an AI agent in plain language, and it does the digging — while you watch the results appear as an interactive skill graph and a contribution tracker.

It's built on **WebMCP**: the app exposes a set of tools that an AI agent can call directly in the browser. Humans and the agent work on the same screen, at the same time.

---

## What you can do

**Ask the agent things like:**
- "Find me beginner Rust projects" → matches appear as a skill→project graph
- "In microsoft/vscode, which good-first-issues are actually free to work on?" → it checks each one for assignees, claim comments, and linked PRs
- "Is vercel/next.js responsive? Will my PR get reviewed?" → samples recent PRs for real response/merge times
- "Draft me a contribution plan for excalidraw" → setup steps, files to read, test commands, PR checklist
- "Track facebook/react" / "mark it as merged" → updates your dashboard live
- "Remember I know Rust and like developer tools" → the app remembers you; later just ask "what should I work on?"
- "Highlight the most-starred one" → that node glows in the graph

**Or do it yourself** — the search page, filters, project cards, stats charts, and dashboard all work without the agent. Whatever the agent does shows up in the same UI you can drive by hand.

---

## The tools (19)

**Discovery**
- `search_projects` — search by tech, domain, stars, activity
- `match_skills_to_projects` — personalized matches; populates the skill graph
- `get_mentorship_projects` — GSoC, Outreachy, MLH, Hacktoberfest
- `summarize_project` — purpose, tech stack, community health
- `estimate_first_response_time` — how fast a project reviews PRs

**Issue vetting**
- `find_issues` — open issues, filtered by label / difficulty / skill
- `check_issue_availability` — is it free, claimed, or taken? (with evidence)
- `assess_issue_difficulty` — real difficulty beyond the label
- `explain_issue` — a beginner-friendly breakdown
- `check_contribution_requirements` — CLA, tests, code style, PR process

**Guidance & tracking**
- `draft_contribution_plan` — AI-written step-by-step first-contribution plan
- `track_contribution` — save / update status on your dashboard
- `summarize_my_progress` — your stats: top languages, fastest merge, completion rate

**Remember me (personalization)**
- `set_skill_profile` — add/remove skills & interests, or clear them
- `get_skill_profile` — "what do you remember about me?"
- `get_recommendations` — suggestions from your saved profile

**Drive the graph (agent changes what you see)**
- `highlight_project` — glow a node (by name or "most-starred/forked")
- `focus_skill` — isolate one skill's cluster
- `reset_graph` — restore the full view

---

## Run it locally

**1. Environment** — create `.env.local`:
```
GITHUB_TOKEN=your_github_pat        # read-only public access is enough
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**2. Install and start:**
```
npm install
npm run dev        # http://localhost:3000
```
Next.js reads env vars at startup — restart if you change a key.

**3. Use the agent (needs WebMCP):** WebMCP is behind a browser flag.
- **Chrome/Edge:** enable `chrome://flags/#enable-webmcp-testing`, restart the browser
- **ChatGPT's in-app browser:** supports WebMCP out of the box

Without WebMCP the site still works — you just drive the UI yourself instead of via the agent.

---

## How it works

The browser holds the WebMCP tools (`document.modelContext`). The OpenAI key stays server-side in `app/api/agent/route.ts`. When you type a message, `AgentChat` reads the tools, asks the model what to do, runs the chosen tools in the browser, and feeds results back until there's an answer.

The same backend routes (`app/api/tools/*`) serve both the agent and the human UI, so there's one source of truth. Tracked projects and your skill profile live in the browser's localStorage — no login, no database.

```
components/webmcp/ToolRegistry.tsx   register the 19 WebMCP tools
app/api/agent/route.ts               OpenAI function-calling (server-side)
components/AgentChat.tsx             the chat + browser tool loop
app/api/tools/*/route.ts             tool backends (live GitHub data via Octokit)
lib/tracker.ts, lib/profile.ts       localStorage stores (dashboard + memory)
components/viz/*                      skill graph (D3), stats (Recharts), journey (React Flow)
```

---

## Tech stack

Next.js 14 · TypeScript · Tailwind · Octokit (GitHub API) · OpenAI · D3, Recharts, React Flow, Framer Motion for the visualizations.

For a full demo walkthrough, see [DEMO.md](DEMO.md).

## License

MIT — see [LICENSE](LICENSE).
