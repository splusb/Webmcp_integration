# Demo Guide — OpenSource Discovery Hub (WebMCP + in-app agent)

This app exposes 8 WebMCP tools and includes an in-app AI agent (OpenAI) that
reads those tools and calls them on the user's behalf. This guide is the
reproducible script for demoing it.

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

## 1. Confirm tools are registered (30 seconds)

1. Open `http://localhost:3000` in the WebMCP-enabled browser.
2. Open the Console (Mac: `Option+Cmd+J`; F12 may trigger volume on Mac laptops).
3. Run:
   ```js
   await document.modelContext.getTools()
   ```
   Expect an **Array(8)** — all tools with `name`, `description`, `inputSchema`.
4. (Optional) You'll also see this on page load:
   ```
   [WebMCP] All 8 tools registered successfully
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
Prompt:
> find me beginner TypeScript projects

Expect:
- Chatbox shows `calling: search_projects`
- Terminal shows:
  ```
  [agent] model requested tools: search_projects({"technologies":["TypeScript"],...})
  [tool:search_projects] executed with input: {"technologies":["TypeScript"],...}
  POST /api/tools/search-projects 200
  ```

### Test 2 — Tool that needs an argument
Prompt:
> summarize the facebook/react project

Expect `calling: summarize_project` with `projectId: "facebook/react"`, then a summary.

### Test 3 — Hierarchical chaining (the headline demo)
Prompt:
> I know Python and I'm a beginner. Help me find a first issue to work on.

Expect a **sequence** of tool calls, each feeding the next:
```
[agent] model requested tools: match_skills_to_projects({"skills":["Python"],...})
POST /api/tools/match-skills 200
[agent] model requested tools: find_issues({"projectId":"...","difficulty":"good-first-issue"}) , ... (parallel across projects)
POST /api/tools/find-issues 200   (xN)
[agent] model returned final text (no tool calls)
```
The agent chains `match_skills_to_projects -> find_issues -> (explain_issue)`
autonomously and returns a specific issue with guidance.

---

## 3. Where to point during the demo (3 sources of proof)

1. **Chatbox** — blue `calling: <tool>` labels show tools being invoked.
2. **Server terminal** — the strongest proof:
   - `[agent] model requested tools: ...`  (the brain decided)
   - `[tool:<name>] executed with input: ...` (the tool actually ran)
   - `POST /api/tools/<name> 200` (real backend responded)
3. **Browser Network tab** — `POST /api/agent` then `POST /api/tools/*`.

---

## 4. Architecture (one paragraph)

The browser holds the WebMCP tools (`document.modelContext`) and executes them.
The OpenAI key stays server-side in `app/api/agent/route.ts` (the "brain").
`components/AgentChat.tsx` runs the loop: read `getTools()` -> POST `/api/agent`
-> if the model returns `tool_calls`, run `executeTool()` for each in the browser
-> send results back -> repeat until a final answer. Same backend tool routes
(`app/api/tools/*`) serve both the agent and the human UI.

Key files:
- `components/webmcp/ToolRegistry.tsx` — registers the 8 tools
- `app/api/tools/*/route.ts` — the 8 tool implementations (real GitHub data)
- `app/api/agent/route.ts` — OpenAI function-calling (server-side)
- `components/AgentChat.tsx` — chatbox + browser agent loop
- `lib/webmcp.d.ts` — shared `document.modelContext` type

---

## 5. Troubleshooting

- **"missing_openai_key"** — `.env` still has `OPENAI_API_KEY=xy`, or server not
  restarted after adding the key.
- **`document.modelContext` is `undefined`** — WebMCP flag off, or non-Chromium
  browser. Re-check step 0.
- **`getTools()` returns `undefined` / `[]`** — you're not on a page where tools
  registered. They now register on every page via `app/layout.tsx`; hard-reload
  (`Cmd+Shift+R`).
- **Tool "Failed to parse input arguments"** — args must be a JSON **string** to
  `executeTool` (the agent loop already does this).
- **Duplicate tool name error** — fixed via idempotent registration in
  `ToolRegistry.tsx`; hard-reload if you see a stale one.
