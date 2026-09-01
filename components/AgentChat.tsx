"use client";

import { useEffect, useRef, useState } from "react";
import type { WebMCPRegisteredTool } from "@/lib/webmcp";

/**
 * AgentChat — an in-app agent chatbox.
 *
 * The "brain" (OpenAI) lives server-side behind /api/agent. The "hands"
 * (WebMCP tools) live here in the browser via document.modelContext. This
 * component runs the loop between them:
 *
 *   user text
 *     -> POST /api/agent { messages, tools }         (ask the model what to do)
 *     -> if model returns tool_calls:
 *          run document.modelContext.executeTool() for each,
 *          append results as "tool" messages, POST /api/agent again
 *     -> if model returns text: show it as the final answer.
 *
 * Note on this WebMCP build: executeTool takes the RegisteredTool OBJECT (from
 * getTools()) as the first arg, and the arguments as a JSON STRING as the
 * second arg. Both quirks were confirmed empirically in Edge.
 */

// Alias to keep the rest of the file readable.
type RegisteredTool = WebMCPRegisteredTool;

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  // UI-only: names of tools invoked in this assistant turn (for display).
  _toolNames?: string[];
};

// The global `Document.modelContext` type lives in lib/webmcp.d.ts.

const MAX_TOOL_ROUNDS = 6; // safety cap on hierarchical chaining per user turn

export function AgentChat() {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Detect whether WebMCP tools are available in this browser.
  useEffect(() => {
    setAvailable(typeof document !== "undefined" && !!document.modelContext);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function callAgent(
    history: ChatMessage[],
    tools: RegisteredTool[]
  ): Promise<ChatMessage> {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // strip UI-only fields before sending
        messages: history.map(({ _toolNames, ...m }) => m),
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Agent error");
    return data.message as ChatMessage;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const mc = document.modelContext;
    let working: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(working);

    try {
      const tools = mc ? await mc.getTools() : [];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const assistant = await callAgent(working, tools);

        // Attach display names for any tool calls in this turn.
        const toolNames = assistant.tool_calls?.map((c) => c.function.name);
        const assistantForUi: ChatMessage = { ...assistant, _toolNames: toolNames };
        working = [...working, assistantForUi];
        setMessages(working);

        // No tool calls -> this is the final answer.
        if (!assistant.tool_calls || assistant.tool_calls.length === 0) break;

        // Execute each requested tool in the browser via WebMCP.
        for (const call of assistant.tool_calls) {
          const tool = tools.find((t) => t.name === call.function.name);
          let resultStr: string;
          try {
            if (!tool) throw new Error(`Tool "${call.function.name}" not found on page`);
            // executeTool wants the tool OBJECT + args as a JSON STRING.
            const argsString =
              typeof call.function.arguments === "string"
                ? call.function.arguments
                : JSON.stringify(call.function.arguments ?? {});
            const result = await mc!.executeTool(tool, argsString);
            resultStr =
              typeof result === "string" ? result : JSON.stringify(result);
          } catch (e: any) {
            resultStr = JSON.stringify({ error: e?.message || "tool failed" });
          }

          working = [
            ...working,
            { role: "tool", tool_call_id: call.id, content: resultStr },
          ];
          setMessages(working);
        }
        // loop back: send tool results to the model for the next step
      }
    } catch (e: any) {
      working = [
        ...working,
        { role: "assistant", content: `Error: ${e?.message || "something went wrong"}` },
      ];
      setMessages(working);
    } finally {
      setBusy(false);
    }
  }

  // Floating button + panel
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-gray-800"
        aria-label="Toggle agent chat"
      >
        {open ? "Close Agent" : "Ask the Agent"}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[32rem] w-[26rem] max-w-[92vw] flex-col overflow-hidden rounded-xl border bg-white shadow-2xl">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">Agent</div>
            <div className="text-xs text-gray-500">
              {available === false
                ? "WebMCP not detected — tools unavailable in this browser."
                : "Ask me to find projects, issues, or make your first contribution."}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="text-xs text-gray-400">
                Try: &ldquo;I know Python and I&rsquo;m a beginner, help me find a first issue.&rdquo;
              </div>
            )}
            {messages.map((m, i) => {
              if (m.role === "tool") {
                return (
                  <div key={i} className="rounded-md bg-gray-50 px-3 py-2 text-[11px] font-mono text-gray-500">
                    tool result received
                  </div>
                );
              }
              const isUser = m.role === "user";
              return (
                <div key={i} className={isUser ? "text-right" : "text-left"}>
                  {m._toolNames && m._toolNames.length > 0 && (
                    <div className="mb-1 text-[11px] text-blue-600">
                      calling: {m._toolNames.join(", ")}
                    </div>
                  )}
                  {m.content && (
                    <div
                      className={
                        "inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm " +
                        (isUser ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900")
                      }
                    >
                      {m.content}
                    </div>
                  )}
                </div>
              );
            })}
            {busy && <div className="text-xs text-gray-400">thinking&hellip;</div>}
          </div>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask the agent…"
                disabled={busy}
                className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
              <button
                onClick={handleSend}
                disabled={busy || !input.trim()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
