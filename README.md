# OpenSource Discovery Hub

> An AI-Agent Native Platform for Discovering and Contributing to Open Source Projects

**OpenSource Discovery Hub** is a WebMCP-powered web application that bridges the gap between developers who want to contribute to open source and projects that need contributors. By exposing structured tools to AI agents, we enable a collaborative experience where agents handle the tedious discovery and research while humans make meaningful decisions and contributions.

---

## The Problem

### For Developers
- **Discovery Paralysis**: 200M+ repos on GitHub, finding the right one is overwhelming
- **Skill Mismatch**: Hard to identify projects that actually need your specific skills
- **Onboarding Friction**: Understanding a new codebase before contributing takes hours
- **First-Contribution Anxiety**: Many want to contribute but don't know where to start

### For Maintainers
- **Contributor Drought**: Great projects struggle to find quality contributors
- **Onboarding Overhead**: Answering the same onboarding questions repeatedly
- **Visibility Gap**: Good first issues go unnoticed in the noise
### The Statistics
- **73%** of developers want to contribute to open source but cite finding the right project as a barrier
- **59%** of open source maintainers report burnout
- **Average time** to find a suitable first issue: **2-4 hours**

---

## Our Solution

Traditional: Developer -> Manual Search -> Hours of Reading -> Maybe Contribute

With Us: Developer <-> AI Agent <-> WebMCP Tools -> Minutes to Contribute

Agents handle discovery, filtering, summarization, and explanation. Humans make decisions and write code.

---

## Why WebMCP?

WebMCP enables websites to expose structured tools that AI agents can use directly. Instead of agents guessing how to navigate UI, we define exactly what they can do.

- **15 Structured Tools** exposed for comprehensive agent interaction
- **Composable Operations**: Tools chain naturally (search -> estimate responsiveness -> find issues -> check availability -> assess difficulty -> plan)
- **Type-Safe Inputs**: Schema-validated parameters prevent errors
- **Rich Outputs**: Structured responses agents can reason about
- **In-App Agent**: A built-in "Ask the Agent" chatbox (OpenAI) reads these tools and calls them for the user — no external agent browser required
- **Agent-Driven Visualization**: Some tools change what the human sees on screen (skill graph), so people and agents work on the same live page

---

## Architecture

### High-Level Overview

```
CLIENT LAYER
  Browser (Human UI)  |  ChatGPT Browser  |  Chrome + WebMCP Flag
         |                    |                     |
         |              WebMCP Interface (Tool Registry)
         |                    |
         v                    v
APPLICATION LAYER
  Next.js Application
    Pages/Routes  |  API Routes  |  WebMCP Tool Handlers
         |
    Service Layer
    ProjectService  |  IssueService  |  UserService
         |
DATA LAYER
  GitHub API (Primary)  |  Cache Layer (Redis/Memory)  |  Database (PostgreSQL/SQLite)
         |
    Curated Project Index (Pre-analyzed data)
```

### Component Details

#### 1. WebMCP Interface Layer
- Exposes 15 structured tools to AI agents
- Handles input validation via JSON Schema
- Routes tool calls to appropriate service handlers

#### 2. Next.js Application
- **Pages**: Server-rendered UI for human users
- **API Routes**: Backend endpoints for tool execution
- **WebMCP Handlers**: Bridge between modelContext and services

#### 3. Service Layer
- **ProjectService**: Search, filter, rank projects
- **IssueService**: Find, explain, categorize issues
- **UserService**: Track contributions, manage preferences

#### 4. Data Layer
- **GitHub API**: Primary data source for projects and issues
- **Cache**: Reduces API calls, improves response time (1hr projects, 15min issues)
- **Database**: Stores user data, contribution tracking, curated index

---

## WebMCP Tools

### Tool Overview

**Discovery & project vetting**

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `search_projects` | Find projects by criteria | technologies, domain, difficulty |
| `match_skills_to_projects` | Personalized recommendations (+ skill graph) | skills, interests, experience |
| `summarize_project` | Get project overview | projectId, includeContributionGuide |
| `estimate_first_response_time` | How responsive a project is to PRs | projectId, sampleSize |
| `check_contribution_requirements` | Get contribution checklist | projectId |
| `get_mentorship_projects` | Find mentorship programs | program, year |

**Issue vetting**

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `find_issues` | Discover contribution opportunities | projectId, labels, difficulty |
| `check_issue_availability` | Is it free? available / likely-taken / taken | projectId, issueId |
| `assess_issue_difficulty` | Real difficulty beyond the label | projectId, issueId, experienceLevel |
| `explain_issue` | Understand an issue deeply | issueId, detailLevel |

**Action / guidance**

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `draft_contribution_plan` | AI-synthesized step-by-step first-contribution plan | projectId, issueId, experienceLevel |
| `track_contribution` | Save progress | projectId, issueId, status |

**Visualization (agent drives the on-screen skill graph)**

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `highlight_project` | Glow a project node in the graph | project (name or superlative) |
| `focus_skill` | Focus the graph on one skill | skill |
| `reset_graph` | Restore the full graph | — |

> The `## Tool Specifications` below show detailed schemas for the original
> eight tools. The seven newer tools (`estimate_first_response_time`,
> `check_issue_availability`, `assess_issue_difficulty`,
> `draft_contribution_plan`, `highlight_project`, `focus_skill`, `reset_graph`)
> follow the same registration pattern — see `components/webmcp/ToolRegistry.tsx`.

### Tool Specifications

#### 1. search_projects

```javascript
document.modelContext.registerTool({
  name: "search_projects",
  description: "Search open-source projects by technology, domain, activity level, and contributor-friendliness.",
  inputSchema: {
    type: "object",
    properties: {
      technologies: {
        type: "array",
        items: { type: "string" },
        description: "Programming languages or frameworks"
      },
      domain: {
        type: "string",
        enum: ["web", "mobile", "ml", "devtools", "gaming", "data", "security", "other"]
      },
      difficulty: {
        type: "string",
        enum: ["beginner", "intermediate", "advanced"]
      },
      minStars: { type: "number" },
      maxStars: { type: "number" },
      hasGoodFirstIssues: { type: "boolean" },
      activelyMaintained: { type: "boolean" },
      limit: { type: "number", default: 10 }
    }
  },
  execute: async (input) => {
    const response = await fetch("/api/tools/search-projects", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return response.json();
  }
});
```

#### 2. match_skills_to_projects

```javascript
document.modelContext.registerTool({
  name: "match_skills_to_projects",
  description: "Given developer skills and interests, find personalized project matches.",
  inputSchema: {
    type: "object",
    properties: {
      skills: { type: "array", items: { type: "string" } },
      interests: { type: "array", items: { type: "string" } },
      experienceLevel: { type: "string", enum: ["beginner", "intermediate", "senior"] },
      timeCommitment: { type: "string", enum: ["one-time", "occasional", "regular"] },
      preferredContributionType: {
        type: "array",
        items: { type: "string", enum: ["code", "documentation", "testing", "design", "translation"] }
      }
    },
    required: ["skills"]
  },
  execute: async (input) => {
    const response = await fetch("/api/tools/match-skills", {
      method: "POST", body: JSON.stringify(input)
    });
    return response.json();
  }
});
```

#### 3. find_issues

```javascript
document.modelContext.registerTool({
  name: "find_issues",
  description: "Find open issues in a project filtered by labels, difficulty, or skill requirements.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "e.g. facebook/react" },
      labels: { type: "array", items: { type: "string" } },
      difficulty: { type: "string", enum: ["good-first-issue", "medium", "complex"] },
      skills: { type: "array", items: { type: "string" } },
      issueType: { type: "string", enum: ["bug", "feature", "documentation", "testing"] },
      excludeAssigned: { type: "boolean", default: true },
      excludeStale: { type: "boolean", default: true }
    },
    required: ["projectId"]
  },
  execute: async (input) => {
    const response = await fetch("/api/tools/find-issues", {
      method: "POST", body: JSON.stringify(input)
    });
    return response.json();
  }
});
```

#### 4. summarize_project

```javascript
document.modelContext.registerTool({
  name: "summarize_project",
  description: "Get comprehensive project summary including purpose, tech stack, and community health.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      includeContributionGuide: { type: "boolean", default: true },
      includeCodeStructure: { type: "boolean", default: false },
      includeCommunityMetrics: { type: "boolean", default: true },
      includeRecentActivity: { type: "boolean", default: true }
    },
    required: ["projectId"]
  },
  execute: async (input) => {
    const response = await fetch("/api/tools/summarize-project", {
      method: "POST", body: JSON.stringify(input)
    });
    return response.json();
  }
});
```

#### 5. explain_issue

```javascript
document.modelContext.registerTool({
  name: "explain_issue",
  description: "Get beginner-friendly explanation of an issue with context and suggested approach.",
  inputSchema: {
    type: "object",
    properties: {
      issueId: { type: "string" },
      projectId: { type: "string" },
      detailLevel: { type: "string", enum: ["brief", "detailed", "step-by-step"], default: "detailed" }
    },
    required: ["issueId", "projectId"]
  },
  execute: async (input) => {
    const response = await fetch("/api/tools/explain-issue", {
      method: "POST", body: JSON.stringify(input)
    });
    return response.json();
  }
});
```

#### 6. check_contribution_requirements

```javascript
document.modelContext.registerTool({
  name: "check_contribution_requirements",
  description: "Get contribution requirements including CLA, code style, testing, and PR process.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" }
    },
    required: ["projectId"]
  },
  execute: async (input) => {
    const response = await fetch("/api/tools/contribution-requirements", {
      method: "POST", body: JSON.stringify(input)
    });
    return response.json();
  }
});
```

#### 7. track_contribution

```javascript
document.modelContext.registerTool({
  name: "track_contribution",
  description: "Save a project or issue to the user contribution tracker.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      issueId: { type: "string" },
      status: { type: "string", enum: ["interested", "in-progress", "pr-submitted", "merged", "abandoned"] },
      notes: { type: "string" },
      targetDate: { type: "string", format: "date" }
    },
    required: ["projectId"]
  },
  execute: async (input) => {
    const response = await fetch("/api/tools/track-contribution", {
      method: "POST", body: JSON.stringify(input)
    });
    return response.json();
  }
});
```

#### 8. get_mentorship_projects

```javascript
document.modelContext.registerTool({
  name: "get_mentorship_projects",
  description: "Find projects in mentorship programs like GSoC, Outreachy, MLH, or Hacktoberfest.",
  inputSchema: {
    type: "object",
    properties: {
      program: { type: "string", enum: ["gsoc", "outreachy", "mlh", "hacktoberfest", "lfx", "all"] },
      year: { type: "number" },
      technologies: { type: "array", items: { type: "string" } },
      acceptingApplications: { type: "boolean" }
    }
  },
  execute: async (input) => {
    const response = await fetch("/api/tools/mentorship-projects", {
      method: "POST", body: JSON.stringify(input)
    });
    return response.json();
  }
});
```

---

## Features

### For Human Users (Web UI)

| Feature | Description |
|---------|-------------|
| **Project Browser** | Visual interface to explore projects with filters |
| **Skill Profile** | Set up your skills for personalized recommendations |
| **Contribution Dashboard** | Track your open source journey |
| **Saved Projects** | Bookmark projects for later |
| **Issue Board** | Kanban-style view of issues you are working on |
| **Progress Stats** | Visualize your contribution history |

### For AI Agents (WebMCP)

| Feature | Description |
|---------|-------------|
| **15 Structured Tools** | Complete coverage of discovery to contribution flow |
| **Smart Matching** | AI-ready skill-to-project matching |
| **Issue Vetting** | Difficulty, availability, and responsiveness signals beyond raw labels |
| **AI-Synthesized Plans** | `draft_contribution_plan` turns repo docs into concrete first steps |
| **Rich Context** | Detailed explanations agents can relay to users |
| **Composable Operations** | Tools designed to chain naturally |
| **Agent-Driven UI** | Visualization tools let the agent change what the human sees live |

---

## Use Cases

### 1. First-Time Contributor Journey

```
User: "I know Python and want to start contributing to open source"

Agent Actions:
1. match_skills_to_projects({skills: ["Python"], experienceLevel: "beginner"})
2. [User selects a project]
3. summarize_project({projectId: "...", includeContributionGuide: true})
4. find_issues({projectId: "...", difficulty: "good-first-issue"})
5. [User selects an issue]
6. explain_issue({issueId: "...", detailLevel: "step-by-step"})
7. track_contribution({projectId: "...", issueId: "...", status: "interested"})

Result: User has clear path to first contribution in < 5 minutes
```

### 2. Skill-Based Discovery

```
User: "Find React projects that need help with accessibility"

Agent Actions:
1. search_projects({technologies: ["React"], domain: "web", hasGoodFirstIssues: true})
2. find_issues({projectId: "...", labels: ["accessibility", "a11y"]})

Result: Targeted list of accessibility issues in React projects
```

### 3. Mentorship Program Preparation

```
User: "I want to apply to GSoC, what projects should I look at?"

Agent Actions:
1. get_mentorship_projects({program: "gsoc", year: 2024})
2. match_skills_to_projects({skills: user_skills})
3. summarize_project({...}) for top matches

Result: Personalized GSoC project recommendations with full context
```

### 4. Deep Dive Before Contributing

```
User: "Tell me everything I need to know before contributing to Next.js"

Agent Actions:
1. summarize_project({projectId: "vercel/next.js", includeContributionGuide: true, includeCodeStructure: true})
2. check_contribution_requirements({projectId: "vercel/next.js"})
3. find_issues({projectId: "vercel/next.js", difficulty: "good-first-issue"})

Result: Complete contributor onboarding package
```

### Advanced Use Cases

| Use Case | Description |
|----------|-------------|
| **Portfolio Building** | Agent helps find diverse projects across different technologies |
| **Team Onboarding** | Lead finds issues suitable for junior team members |
| **Learning Path** | Agent suggests progressively harder issues to build skills |
| **Contribution Sprint** | Find multiple quick-win issues for a contribution marathon |
| **Technology Exploration** | Use contributions to learn a new language/framework |

---

## Edge Cases and Handling

| Edge Case | Challenge | Our Solution |
|-----------|-----------|--------------|
| **Stale Issues** | Issue labeled good-first-issue but actually claimed/outdated | Check issue activity, last comment date, linked PRs |
| **Abandoned Projects** | Project looks active but maintainer is MIA | Show last-maintainer-response metric, warn if > 30 days |
| **Skill Mismatch** | User over/underestimates their skill level | Offer difficulty calibration, learn from contribution history |
| **No Results** | Very niche skill combination returns nothing | Suggest broadening criteria, show closest matches |
| **Rate Limiting** | Too many GitHub API calls | Aggressive caching (1hr projects, 15min issues), request batching |
| **Private/Archived Repos** | User tries to access inaccessible project | Graceful error with similar public alternatives |
| **Ambiguous Skills** | I know JavaScript (React? Node? Vanilla?) | Follow-up questions or sub-skill expansion |
| **Overwhelming Results** | 500 matching projects | Smart ranking, progressive disclosure, pagination |
| **Non-GitHub Projects** | GitLab, Bitbucket, self-hosted | Extensible data layer, GitHub-first for MVP |
| **Issue Claimed After Search** | Someone else claims it first | Real-time availability check before starting work |
| **Language Barriers** | Non-English contribution guides | Auto-detect language, offer translation hints |
| **Timezone Differences** | Maintainers in different timezone | Show maintainer timezone, typical response hours |

### Error Response Format

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "The project xyz/abc could not be found or is not accessible",
    "suggestions": [
      "Check if the repository name is correct",
      "The repository might be private or deleted"
    ],
    "alternatives": [
      { "id": "similar/project", "name": "Similar Project", "matchReason": "Similar name and tech" }
    ]
  }
}
```

---

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Query / Zustand** - Data fetching and client state
- **react-markdown** - Renders the agent's markdown replies
- **D3 / React Flow** - Skill-graph visualization

### Backend
- **Next.js API Routes** - Backend endpoints for WebMCP tool execution
- **OpenAI API** - Powers both the in-app agent (function calling) and the
  AI-synthesis tools like `draft_contribution_plan`
- **In-memory cache** (`lib/cache.ts`) - Reduces GitHub API calls (1hr projects, 15min issues)
- **localStorage** (`lib/tracker.ts`) - Client-side contribution tracking (no login required)

### External APIs
- **GitHub REST API** (via Octokit) - Primary data source (GitHub only)

### Deployment
- **Vercel** - Hosting (suggested)

> Note: earlier drafts mentioned Redis, PostgreSQL, GitHub GraphQL, and shadcn/ui.
> The current implementation uses an in-memory cache, localStorage, the GitHub
> REST API, and Tailwind — those others are potential future enhancements.

---

## Implementation Guide

### Phase 1: Foundation (Day 1)
- Project setup (Next.js + TypeScript + Tailwind)
- Basic page structure (Home, Search, Project Detail)
- GitHub API integration
- Simple search functionality
- WebMCP tool registration scaffold

### Phase 2: Core Tools (Day 1-2)
- Implement search_projects tool + API
- Implement find_issues tool + API
- Implement summarize_project tool + API
- Basic caching layer
- Test with ChatGPT browser

### Phase 3: Advanced Tools (Day 2)
- Implement match_skills_to_projects
- Implement explain_issue
- Implement check_contribution_requirements
- Implement track_contribution (with local storage / simple DB)
- Implement get_mentorship_projects

### Phase 4: Polish (Day 2-3)
- Human UI improvements
- Error handling and edge cases
- Response formatting for agents
- Demo flow preparation
- Documentation

### File Structure

```
/
├── app/
│   ├── layout.tsx                       # Root layout (mounts tools + agent)
│   ├── page.tsx                         # Home page
│   ├── search/page.tsx                  # Search + skill-match interface
│   ├── dashboard/page.tsx               # Contribution tracker dashboard
│   └── api/
│       ├── agent/route.ts               # OpenAI agent (server-side brain)
│       └── tools/
│           ├── search-projects/route.ts
│           ├── match-skills/route.ts
│           ├── summarize-project/route.ts
│           ├── estimate-first-response-time/route.ts
│           ├── find-issues/route.ts
│           ├── check-issue-availability/route.ts
│           ├── assess-issue-difficulty/route.ts
│           ├── explain-issue/route.ts
│           ├── draft-contribution-plan/route.ts   # "tool that thinks" (calls OpenAI)
│           ├── contribution-requirements/route.ts
│           ├── track-contribution/route.ts
│           └── mentorship-projects/route.ts
│           # (visualization tools highlight/focus/reset run in the browser,
│           #  no backend route — see ToolRegistry.tsx + lib/viz)
├── components/
│   ├── webmcp/ToolRegistry.tsx          # Registers all 15 WebMCP tools
│   ├── AgentChat.tsx                    # In-app agent chat (browser hands)
│   ├── MarkdownMessage.tsx              # Renders agent markdown replies
│   └── ProjectCard.tsx                  # Project result card + Track button
├── lib/
│   ├── github.ts                        # GitHub API client (Octokit)
│   ├── cache.ts                         # In-memory TTL cache
│   ├── matching.ts                      # Skill matching logic
│   ├── tracker.ts                       # Shared localStorage tracker store
│   ├── types.ts                         # TypeScript types
│   └── webmcp.d.ts                      # document.modelContext typings
└── public/
```

### WebMCP Registration Pattern

```typescript
// components/webmcp/ToolRegistry.tsx
"use client";

import { useEffect } from "react";

// Module-level guard: React Strict Mode mounts twice in dev; register once.
let toolsRegistered = false;

export function WebMCPToolRegistry() {
  useEffect(() => {
    if (typeof document !== "undefined" && document.modelContext && !toolsRegistered) {
      registerAllTools();
      toolsRegistered = true;
    }
  }, []);

  return null;
}

function registerAllTools() {
  // All 15 tools are registered here via an idempotent registerTool() wrapper
  // (unregisters a same-named tool first to survive hot-reloads):
  //   search_projects, match_skills_to_projects, summarize_project,
  //   estimate_first_response_time, find_issues, check_issue_availability,
  //   assess_issue_difficulty, explain_issue, draft_contribution_plan,
  //   check_contribution_requirements, track_contribution,
  //   get_mentorship_projects, highlight_project, focus_skill, reset_graph
}
```

---

## API Reference

### Base URL

```
Production:  https://your-app.vercel.app/api/tools
Development: http://localhost:3000/api/tools
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /search-projects | POST | Search projects |
| /match-skills | POST | Skill-based matching |
| /find-issues | POST | Find issues |
| /summarize-project | POST | Get project summary |
| /explain-issue | POST | Get issue explanation |
| /contribution-requirements | POST | Get requirements |
| /track-contribution | POST | Track progress |
| /mentorship-projects | POST | Find mentorship programs |

### Rate Limits
- **Anonymous**: 30 requests/minute
- **Authenticated**: 100 requests/minute
- **Cached responses**: Do not count against limits

---

## Demo Flow

> For a full, up-to-date, step-by-step demo script (setup, browser flag, and the
> exact prompts to run), see **[DEMO.md](DEMO.md)**.

### Recommended Demo Script (3 minutes)

**Setup**: Open the app in a WebMCP-enabled browser (Edge/Chrome 150+ with the
"WebMCP for testing" flag) and use the built-in **"Ask the Agent"** chatbox — no
external agent browser required.

**Scene 1 - Introduction (30s)**

> I have built an app that helps developers find open source projects to contribute to. Let me show you how it works with AI.

**Scene 2 - Discovery (60s)**

```
You: I know TypeScript and React, intermediate level. Find me a project.

ChatGPT: *uses match_skills_to_projects*
Here are the top 3 matches:
1. Excalidraw - A whiteboard app
2. Cal.com - Scheduling infrastructure
3. Docusaurus - Documentation framework

You: Tell me more about Excalidraw

ChatGPT: *uses summarize_project*
Excalidraw is a virtual whiteboard for sketching diagrams...
```

**Scene 3 - Finding Contribution (60s)**

```
You: Find me a good first issue

ChatGPT: *uses find_issues*
Here are 3 beginner-friendly issues...

You: Explain issue #5234 to me

ChatGPT: *uses explain_issue*
This issue asks for adding keyboard shortcuts...
```

**Scene 4 - Tracking (30s)**

```
You: Save this, I will work on it this weekend

ChatGPT: *uses track_contribution*
Saved! Added Excalidraw #5234 to your tracker.
```

**Closing**

> In 2 minutes, we went from "I want to contribute" to having a specific issue with step-by-step guidance. That is the power of WebMCP.

---

## Impact and Vision

### Immediate Impact
- **Reduce time to first contribution** from hours to minutes
- **Lower barrier to entry** for open source
- **Better matches** between contributors and projects
- **Reduce maintainer burden** through better-prepared contributors

### Broader Vision
- **Strengthen the open source ecosystem** by increasing quality contributions
- **Democratize open source access** for developers worldwide
- **Create a new standard** for agent-native developer tools

### Success Metrics

| Metric | Target |
|--------|--------|
| Time to find first issue | < 5 minutes |
| User satisfaction (NPS) | > 50 |
| Projects discovered per session | > 3 |
| Issues explained per session | > 2 |

### Why This Matters for WebMCP

This project demonstrates WebMCP potential to create genuinely collaborative human-AI experiences:
- Agents do what they are good at (searching, filtering, summarizing)
- Humans do what they are good at (deciding, creating, connecting)
- Together, they achieve what neither could alone

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- GitHub Personal Access Token (for API access)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/opensource-discovery-hub.git
cd opensource-discovery-hub

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your GitHub token

# Start development server
npm run dev
```

### Environment Variables

```env
GITHUB_TOKEN=your_github_personal_access_token
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Testing WebMCP

1. **ChatGPT Browser**: Deploy to Vercel/Cloudflare and open in ChatGPT
2. **Chrome**: Enable chrome://flags/#enable-webmcp-testing

---

## Development Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run linter
npm run test     # Run tests
```

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [WebMCP Specification](https://spec.webmcp.dev)
- [OpenAI WebMCP Guide](https://developers.openai.com)
- [GitHub API](https://docs.github.com/en/rest)
- [Chrome WebMCP Documentation](https://developer.chrome.com/docs/extensions/webmcp)

---

**Built for the WebMCP Hackathon** | Where humans and agents build the open web together
