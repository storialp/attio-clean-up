import { NextRequest, NextResponse } from "next/server";
import { queryCompanies } from "@/lib/attio";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { offset?: string | null };
    const apiKey = process.env.ATTIO_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({ error: "Missing ATTIO_API_KEY in server environment." }, { status: 500 });
    }

    const result = await queryCompanies(apiKey, body.offset);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load companies.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
