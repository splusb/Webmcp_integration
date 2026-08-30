import { NextRequest, NextResponse } from "next/server";

// In-memory store for MVP (replace with database later)
const contributions: Map<string, any> = new Map();

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();

    if (!input.projectId) {
      return NextResponse.json(
        { error: { code: "MISSING_PROJECT_ID", message: "projectId is required" } },
        { status: 400 }
      );
    }

    const id = input.projectId + (input.issueId ? "#" + input.issueId : "");
    const now = new Date().toISOString();

    const contribution = {
      id,
      projectId: input.projectId,
      issueId: input.issueId || null,
      status: input.status || "interested",
      notes: input.notes || null,
      targetDate: input.targetDate || null,
      createdAt: contributions.has(id) ? contributions.get(id).createdAt : now,
      updatedAt: now,
    };

    contributions.set(id, contribution);

    return NextResponse.json({
      success: true,
      contribution,
      message: "Contribution tracked successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "TRACK_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
