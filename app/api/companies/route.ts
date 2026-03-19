import { NextRequest, NextResponse } from "next/server";
import { fetchAllCompanies } from "@/lib/attio";
import { listPendingCompanies, upsertCachedCompanies } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sync?: boolean; excludeIds?: string[] };
    const apiKey = process.env.ATTIO_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({ error: "Missing ATTIO_API_KEY in server environment." }, { status: 500 });
    }

    if (body.sync) {
      const companies = await fetchAllCompanies(apiKey);
      await upsertCachedCompanies(companies);
    }

    const companies = await listPendingCompanies(25, body.excludeIds ?? []);
    return NextResponse.json({
      companies,
      nextOffset: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load companies.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
