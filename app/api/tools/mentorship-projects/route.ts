import { NextRequest, NextResponse } from "next/server";
import { searchRepositories } from "@/lib/github";

// Curated list of mentorship program topics
const PROGRAM_TOPICS: Record<string, string[]> = {
  gsoc: ["gsoc", "google-summer-of-code"],
  outreachy: ["outreachy"],
  hacktoberfest: ["hacktoberfest"],
  mlh: ["mlh", "mlh-fellowship"],
  lfx: ["lfx-mentorship", "linux-foundation"],
};

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    console.log("[tool:get_mentorship_projects] executed with input:", JSON.stringify(input));
    const program = input.program || "all";

    let topics: string[] = [];
    if (program === "all") {
      topics = Object.values(PROGRAM_TOPICS).flat();
    } else {
      topics = PROGRAM_TOPICS[program] || [];
    }

    const queryParts: string[] = [];
    if (topics.length > 0) {
      queryParts.push(topics.map((t) => "topic:" + t).join(" "));
    }
    if (input.technologies?.length) {
      queryParts.push("language:" + input.technologies[0]);
    }
    queryParts.push("stars:>50");

    const query = queryParts.join(" ");
    const data = await searchRepositories(query, { perPage: 20 });

    const projects = data.items.map((repo: any) => ({
      id: repo.full_name,
      name: repo.name,
      program: program,
      url: repo.html_url,
      technologies: [repo.language, ...(repo.topics || [])].filter(Boolean),
      description: repo.description || "",
      stars: repo.stargazers_count,
    }));

    return NextResponse.json({ projects, totalCount: projects.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "MENTORSHIP_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
