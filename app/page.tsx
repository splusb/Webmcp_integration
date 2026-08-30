import { WebMCPToolRegistry } from "@/components/webmcp/ToolRegistry";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <WebMCPToolRegistry />
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900">
            OpenSource Discovery Hub
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Find your next open source contribution in minutes, not hours.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Powered by WebMCP — AI agents and humans collaborating on the open web.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="text-3xl">&#x1F50D;</div>
            <h3 className="mt-3 text-lg font-semibold">Discover</h3>
            <p className="mt-2 text-sm text-gray-600">
              Search projects by technology, domain, and difficulty level.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="text-3xl">&#x1F3AF;</div>
            <h3 className="mt-3 text-lg font-semibold">Match</h3>
            <p className="mt-2 text-sm text-gray-600">
              Get personalized project recommendations based on your skills.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="text-3xl">&#x1F680;</div>
            <h3 className="mt-3 text-lg font-semibold">Contribute</h3>
            <p className="mt-2 text-sm text-gray-600">
              Find beginner-friendly issues with step-by-step guidance.
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <a href="/search" className="inline-flex items-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800">
            Start Exploring
          </a>
          <a href="/dashboard" className="ml-4 inline-flex items-center rounded-lg border px-6 py-3 text-sm font-medium hover:bg-gray-50">
            My Dashboard
          </a>
        </div>

        <div className="mt-16 rounded-xl border bg-blue-50 p-6">
          <h3 className="text-lg font-semibold text-blue-900">AI Agent Ready</h3>
          <p className="mt-2 text-sm text-blue-800">
            This app exposes 8 WebMCP tools. Open it in ChatGPT browser or Chrome with WebMCP enabled,
            and your AI agent can search projects, find issues, and track contributions for you.
          </p>
        </div>
      </div>
    </main>
  );
}
