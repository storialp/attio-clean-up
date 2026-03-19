import { NextRequest, NextResponse } from "next/server";
import { deleteCompany } from "@/lib/attio";
import { insertDeletion, updateCachedCompanyStatus } from "@/lib/db";
import { SimplifiedCompany } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action?: "keep" | "delete";
      company?: SimplifiedCompany;
    };

    const apiKey = process.env.ATTIO_API_KEY?.trim();
    const company = body.company;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing ATTIO_API_KEY in server environment." }, { status: 500 });
    }

    if (!company?.id) {
      return NextResponse.json({ error: "Company record id is required." }, { status: 400 });
    }

    if (body.action === "keep") {
      await updateCachedCompanyStatus(company.id, "kept");
      return NextResponse.json({ ok: true, action: "keep" });
    }

    if (body.action !== "delete") {
      return NextResponse.json({ error: "Action must be keep or delete." }, { status: 400 });
    }

    await deleteCompany(apiKey, company.id);
    await updateCachedCompanyStatus(company.id, "deleted");
    await insertDeletion(company);

    return NextResponse.json({ ok: true, action: "delete" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process swipe.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
