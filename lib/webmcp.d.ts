// Shared global type for the experimental WebMCP browser API.
// Centralized here so multiple components can reference the same shape
// without conflicting `declare global` blocks.

export interface WebMCPRegisteredTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  origin?: string;
  title?: string;
}

export interface WebMCPModelContext {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: any) => Promise<any>;
  }) => void;
  unregisterTool?: (name: string) => void;
  getTools: () => Promise<WebMCPRegisteredTool[]>;
  // This build takes the RegisteredTool object + a JSON string of arguments.
  executeTool: (tool: WebMCPRegisteredTool, args: string) => Promise<unknown>;
}

declare global {
  interface Document {
    modelContext?: WebMCPModelContext;
  }
}

export {};
