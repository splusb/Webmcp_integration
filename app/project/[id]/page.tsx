import { WebMCPToolRegistry } from "@/components/webmcp/ToolRegistry";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return (
    <main className="min-h-screen bg-gray-50">
      <WebMCPToolRegistry />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-bold">Project: {decodeURIComponent(params.id)}</h1>
        <p className="mt-2 text-gray-600">
          Project details will be displayed here. Use the AI agent to summarize this project.
        </p>
      </div>
    </main>
  );
}
