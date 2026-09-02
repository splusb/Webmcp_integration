# Demo Guide — OpenSource Discovery Hub (WebMCP + in-app agent)

This app exposes **15 WebMCP tools** and includes an in-app AI agent (OpenAI)
that reads those tools and calls them on the user's behalf. A human asks in
plain language; the agent chains the tools to do the tedious work. This guide
is the reproducible script for demoing it.

---

## 0. One-time setup

### Environment (`.env`)
```
GITHUB_TOKEN=<your GitHub PAT>        # read-only public access is enough
OPENAI_API_KEY=<your OpenAI key>      # NOT the placeholder "xy"
OPENAI_MODEL=gpt-4o-mini              # any function-calling model works
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
> `.env` is git-ignored. Never commit real keys. Rotate the GitHub PAT if it
> was ever pasted into a shared chat/editor.

### Install & run
```
npm install
npm run dev        # serves http://localhost:3000
```
> Next.js reads `.env` only at startup. If you change a key, restart the server.

### Browser (required for the WebMCP part)
WebMCP is behind a flag. Use **Edge or Chrome 150+**:
1. Go to `edge://flags` (or `chrome://flags`)
2. Search `webmcp`
3. Enable **WebMCP for testing** (and optionally **WebMCP support in DevTools**)
4. Restart the browser
> A plain browser still runs the site fine — the agent/tools just won't be
> available (graceful degradation).

---

## 1. The 15 tools

**Discovery & project vetting**
- `search_projects` — search projects by tech/domain/stars (broad filters)
- `match_skills_to_projects` — personalized matches for named skills; populates the skill graph
- `summarize_project` — purpose, tech stack, community health
- `estimate_first_response_time` — samples recent closed PRs → responsiveness rating ("will my PR get reviewed?")
- `check_contribution_requirements` — CLA, code style, testing, PR process
- `get_mentorship_projects` — GSoC / Outreachy / MLH / Hacktoberfest projects

**Issue vetting**
- `find_issues` — open issues (falls back to a broader set if default filters return nothing; sets `relaxedFilters`)
- `check_issue_availability` — available | likely-taken | taken, with evidence (assignee, claim comments, referencing PRs)
- `assess_issue_difficulty` — real difficulty score beyond the label (comments, age, keywords, red flags)
- `explain_issue` — beginner-friendly explanation

**Action / guidance**
- `draft_contribution_plan` — AI-synthesized step-by-step first-contribution plan (setup, files, tests, PR checklist)
- `track_contribution` — save to the tracker/dashboard (also localStorage)

**Visualization (agent drives the on-screen skill graph)**
- `highlight_project` — glow a project node (by name or "most-starred/forked/issues")
- `focus_skill` — focus the graph on one skill
- `reset_graph` — restore full graph

### Confirm they registered (30 seconds)
1. Open `http://localhost:3000` in the WebMCP-enabled browser.
2. Console (Mac: `Option+Cmd+J`; F12 may trigger volume on Mac laptops).
3. Run:
   ```js
   await document.modelContext.getTools()
   ```
   Expect an **Array(15)**. On load you'll also see:
   ```
   [WebMCP] All 15 tools registered successfully
   ```

### Manual tool call (you act as the agent)
This build's `executeTool` takes the **tool object** + args as a **JSON string**:
```js
const tools = await document.modelContext.getTools();
const t = tools.find(x => x.name === "search_projects");
const r = await document.modelContext.executeTool(t, JSON.stringify({ technologies: ["TypeScript"], limit: 3 }));
console.log(r);   // live GitHub data
```

---

## 2. The main demo — the in-app agent

Click **"Ask the Agent"** (bottom-right). Keep the **Console** open and the
**server terminal** visible — both show tool calls happening.

### Test 1 — Single tool
> find me beginner TypeScript projects

Expect `calling: search_projects`, then a list of real repos.

### Test 2 — Responsiveness (project vetting)
> Is vercel/next.js a responsive project? Will my PR get reviewed?

Expect `calling: estimate_first_response_time`, then a responsiveness verdict
(median time to first response / merge).

### Test 3 — Issue vetting chain (strong demo)
> In microsoft/vscode, find some issues and tell me which are actually free to work on

Expect `calling: find_issues` → `calling: check_issue_availability` (often several
in parallel), then an answer sorted into "free" vs "taken" with evidence. This
shows the agent doing per-issue investigation a human would never do by hand.

### Test 4 — Difficulty beyond the label
> Find good-first-issues in vercel/next.js and tell me which are actually doable for a beginner

Expect `find_issues` → `assess_issue_difficulty`. The tell that it adds value:
the agent's answer **disagrees with the label** (e.g. flags a "good-first-issue"
as actually intermediate or already claimed).

### Test 5 — AI-synthesized plan (the finale)
> Draft me a step-by-step contribution plan for vercel/next.js

Expect `calling: draft_contribution_plan`, then a real setup → files → tests →
PR plan. Note it is HONEST about undocumented steps (e.g. "test command not
documented — check the repo") instead of inventing them.

### Test 6 — Hierarchical journey
> I know Python and I'm a beginner. Help me find a first issue to work on.

Expect a chain: `match_skills_to_projects` → `find_issues` →
`check_issue_availability` / `assess_issue_difficulty` → a specific recommendation.

---

## 3. Where to point during the demo (3 sources of proof)

1. **Chatbox** — blue `calling: <tool>` labels show tools being invoked.
2. **Server terminal** — the strongest proof:
   - `[agent] model requested tools: ...`  (the brain decided)
   - `[tool:<name>] executed with input: ...` (the tool actually ran)
   - `POST /api/tools/<name> 200` (real backend responded)
   - Note: visualization tools (highlight/focus/reset) run in the browser only,
     so they show a `calling:` label + a graph change, but no `/api/tools/*` call.
3. **Browser Network tab** — `POST /api/agent` then `POST /api/tools/*`.

---

## 4. Architecture (one paragraph)

The browser holds the WebMCP tools (`document.modelContext`) and executes them.
The OpenAI key stays server-side in `app/api/agent/route.ts` (the "brain").
`components/AgentChat.tsx` runs the loop: read `getTools()` -> POST `/api/agent`
-> if the model returns `tool_calls`, run `executeTool()` for each in the browser
-> send results back -> repeat until a final answer. Same backend tool routes
(`app/api/tools/*`) serve both the agent and the human UI.

Two tools are "tools that think": `draft_contribution_plan` (and the planned
`draft_pr_description`) fetch GitHub data, then make their OWN server-side
OpenAI call to synthesize guidance — distinct from the agent-loop call that
chose them.

Key files:
- `components/webmcp/ToolRegistry.tsx` — registers all 15 tools
- `app/api/tools/*/route.ts` — tool implementations (real GitHub data)
- `app/api/agent/route.ts` — OpenAI function-calling (server-side) + system prompt
- `components/AgentChat.tsx` — chatbox + browser agent loop
- `lib/github.ts` — GitHub (Octokit) data layer, cached
- `lib/webmcp.d.ts` — shared `document.modelContext` type

---

## 5. The contributor journey (the "better together" story)

```
search / match_skills  →  estimate_first_response_time  →  find_issues
   →  check_issue_availability  →  assess_issue_difficulty  →  draft_contribution_plan  →  track_contribution
      "is it free?"              "is it doable?"             "how do I start?"
```
A human types one goal; the agent chains these to go from "I want to contribute"
to a specific, available, doable issue in a responsive project — with a plan.

---

## 6. Troubleshooting

- **"missing_openai_key"** — `.env` still has `OPENAI_API_KEY=xy`, or server not
  restarted after adding the key.
- **`document.modelContext` is `undefined`** — WebMCP flag off, or non-Chromium
  browser. Re-check step 0.
- **`getTools()` returns `undefined` / `[]`** — hard-reload (`Cmd+Shift+R`); tools
  register on every page via `app/layout.tsx`.
- **Tool "Failed to parse input arguments"** — args must be a JSON **string** to
  `executeTool` (the agent loop already does this).
- **Duplicate tool name error** — idempotent registration in `ToolRegistry.tsx`;
  hard-reload if you see a stale one.
- **Agent says "no issues" for a big repo** — fixed: `find_issues` relaxes its
  filters and the agent falls back + verifies with `check_issue_availability`.
- **`good-first-issue` labels are volatile** — a repo that has them today may not
  tomorrow. `vercel/next.js` and `facebook/react-native` are usually good bets;
  re-check counts before demoing.
