import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

/**
 * Secret agent route.
 *
 * The browser owns the WebMCP tools (document.modelContext) and executes them.
 * This server route owns the OpenAI key and the "brain": given the conversation
 * so far plus the list of available tools, it asks OpenAI what to do next.
 *
 * Flow (one HTTP call = one model turn):
 *   1. Browser sends { messages, tools }.
 *   2. We call OpenAI with function-calling enabled.
 *   3. OpenAI replies either:
 *        - with tool_calls  -> we return them; the browser runs executeTool()
 *          for each, appends the results as "tool" messages, and calls us again.
 *        - with plain text  -> we return the final assistant message.
 *
 * This keeps the OpenAI key on the server while tool execution stays in the
 * browser where document.modelContext lives.
 */

const SYSTEM_PROMPT = `You are an assistant embedded in "OpenSource Discovery Hub", a web app that helps developers find open-source projects and issues to contribute to.

You have access to the page's WebMCP tools. Use them to answer the user's request.
- Prefer calling tools over guessing. Chain tools when useful: e.g. match_skills_to_projects -> summarize_project -> find_issues -> assess_issue_difficulty -> explain_issue.
- When a tool returns a projectId (like "owner/repo") or an issueId, reuse it as input to the next tool.
- When the user is choosing between projects or asks whether a project is worth contributing to (e.g. "is it active/responsive", "will my PR get reviewed"), use estimate_first_response_time to report how quickly maintainers respond, and factor it into your recommendation.
- Finding beginner-doable issues: do NOT rely only on the "good-first-issue" label (many active repos have few or none, and labels are often inaccurate). When the user asks for beginner-friendly or "doable" issues, call find_issues WITHOUT a restrictive difficulty filter to get a broader set, then call assess_issue_difficulty on the promising ones and recommend those scored "beginner-friendly" (or matching the user's level) with NO red flags. Briefly mention any that look mislabeled or already taken.
- Before recommending a specific issue to work on, use check_issue_availability to make sure it isn't already assigned, claimed in comments, or covered by an open PR. Prefer issues that are "available" and warn about ones that are "taken" or "likely-taken".
- When the user has settled on a project/issue and asks how to get started (setup, first steps, "what do I do"), use draft_contribution_plan to give them a concrete step-by-step plan.
- If find_issues returns no issues, do NOT tell the user the repo has no open issues (large repos always do — the default filters may have hidden assigned/stale ones). Retry find_issues with excludeAssigned:false and excludeStale:false, then use check_issue_availability to identify which of those are actually free. If the response has relaxedFilters:true, the filters were already loosened, so verify availability before recommending.
- IMPORTANT: Once you have already found/searched projects in this conversation, do NOT run search_projects or match_skills_to_projects again for follow-up requests about those same results. For requests like "highlight the most-starred one", "focus on Python", or "point out X", call the visualization tools (highlight_project, focus_skill, reset_graph) DIRECTLY. Re-searching would reset the on-screen graph.
- highlight_project accepts superlatives: pass "most-starred", "most-forked", or "most-issues" directly, or a specific project name. Do not re-search to figure out which is most-starred.
- Keep replies concise and friendly. After using tools, summarize the results for a developer audience.`;

interface AgentRequestBody {
  messages: ChatCompletionMessageParam[];
  // Tools as returned (in shape) by document.modelContext.getTools():
  // { name, description, inputSchema } where inputSchema may be a JSON string.
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
  }>;
}

function toOpenAITools(
  tools: AgentRequestBody["tools"]
): ChatCompletionTool[] {
  return tools.map((t) => {
    // inputSchema can arrive as a JSON string (this WebMCP build) or an object.
    let parameters: Record<string, unknown> = {
      type: "object",
      properties: {},
    };
    if (typeof t.inputSchema === "string") {
      try {
        parameters = JSON.parse(t.inputSchema);
      } catch {
        /* keep default empty-object schema */
      }
    } else if (t.inputSchema && typeof t.inputSchema === "object") {
      parameters = t.inputSchema as Record<string, unknown>;
    }

    return {
      type: "function",
      function: {
        name: t.name,
        description: t.description ?? "",
        parameters,
      },
    };
  });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "xy") {
    return NextResponse.json(
      {
        error: {
          code: "missing_openai_key",
          message:
            "OPENAI_API_KEY is not set (still the placeholder 'xy'). Add a real key to .env and restart the dev server.",
        },
      },
      { status: 500 }
    );
  }

  let body: AgentRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  const { messages, tools } = body;
  if (!Array.isArray(messages)) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`messages` must be an array." } },
      { status: 400 }
    );
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // Ensure the system prompt is always first.
  const fullMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: fullMessages,
      tools: tools && tools.length ? toOpenAITools(tools) : undefined,
      tool_choice: tools && tools.length ? "auto" : undefined,
    });

    const choice = completion.choices[0];
    const message = choice.message;

    // Server-side proof: log which tools the model decided to call this turn.
    if (message.tool_calls?.length) {
      const names = message.tool_calls
        .map((c) => (c.type === "function" ? `${c.function.name}(${c.function.arguments})` : c.type))
        .join(" , ");
      console.log("[agent] model requested tools:", names);
    } else {
      console.log("[agent] model returned final text (no tool calls)");
    }

    // Return the raw assistant message. The browser inspects tool_calls:
    //  - if present, it executes them via executeTool() and calls back;
    //  - otherwise, message.content is the final answer.
    return NextResponse.json({
      message: {
        role: message.role,
        content: message.content ?? "",
        tool_calls: message.tool_calls ?? undefined,
      },
      finishReason: choice.finish_reason,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          code: "openai_error",
          message: err?.message || "OpenAI request failed.",
        },
      },
      { status: 502 }
    );
  }
}
