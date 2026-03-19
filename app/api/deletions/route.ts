import { NextResponse } from "next/server";
import { listDeletions } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await listDeletions();
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load deletion log.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
