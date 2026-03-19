import { SimplifiedCompany } from "@/lib/types";

const ATTIO_BASE_URL = "https://api.attio.com/v2";
const PAGE_SIZE = 25;

function unwrapPrimaryValue(input: unknown): string {
  if (Array.isArray(input) && input.length > 0) {
    const first = input[0];
    if (typeof first === "string") {
      return first;
    }
    if (first && typeof first === "object") {
      const candidate = first as Record<string, unknown>;
      const nestedOption = candidate.option as Record<string, unknown> | undefined;
      return String(
        candidate.value ??
          candidate.title ??
          candidate.domain ??
          candidate.email_address ??
          nestedOption?.title ??
          "",
      );
    }
  }

  if (input && typeof input === "object") {
    const candidate = input as Record<string, unknown>;
    return String(candidate.value ?? candidate.title ?? "");
  }

  return typeof input === "string" ? input : "";
}

function extractTags(values: Record<string, unknown>): string[] {
  const rawTags = values.categories;
  if (!Array.isArray(rawTags)) {
    return [];
  }

  return rawTags
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (!item || typeof item !== "object") {
        return "";
      }
      const candidate = item as Record<string, unknown>;
      const option = candidate.option as Record<string, unknown> | undefined;
      return String(option?.title ?? candidate.title ?? candidate.value ?? "");
    })
    .filter(Boolean)
    .slice(0, 4);
}

export async function queryCompanies(apiKey: string, offset?: string | null) {
  const payload: Record<string, unknown> = { limit: PAGE_SIZE };
  if (offset) {
    payload.offset = offset;
  }

  const response = await fetch(`${ATTIO_BASE_URL}/objects/companies/records/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok) {
    throw new Error(json?.message ?? json?.error ?? `Attio returned ${response.status}`);
  }

  const data = Array.isArray(json.data) ? json.data : [];
  const companies: SimplifiedCompany[] = data.map((record: Record<string, any>) => {
    const values = (record.values ?? {}) as Record<string, unknown>;

    return {
      id:
        record?.id?.record_id ??
        record?.id?.workspace_record_id ??
        record?.id?.object_record_id ??
        "",
      name: unwrapPrimaryValue(values.name) || "Untitled company",
      domain:
        unwrapPrimaryValue(values.domains) ||
        unwrapPrimaryValue(values.primary_domain) ||
        unwrapPrimaryValue(values.website),
      description: unwrapPrimaryValue(values.description),
      employeeRange: unwrapPrimaryValue(values.employee_range) || "Unknown",
      tags: extractTags(values),
      webUrl: String(record.web_url ?? ""),
      raw: record,
    };
  });

  return {
    companies: companies.filter((company) => company.id),
    nextOffset:
      json?.pagination?.next_cursor ??
      json?.pagination?.next_offset ??
      json?.next_offset ??
      null,
  };
}

export async function fetchAllCompanies(apiKey: string) {
  const companies: SimplifiedCompany[] = [];
  const seenIds = new Set<string>();
  let offset: string | null = null;

  for (;;) {
    const page = await queryCompanies(apiKey, offset);
    for (const company of page.companies) {
      if (!seenIds.has(company.id)) {
        seenIds.add(company.id);
        companies.push(company);
      }
    }

    if (!page.nextOffset) {
      break;
    }
    offset = page.nextOffset;
  }

  return companies;
}

export async function deleteCompany(apiKey: string, recordId: string) {
  const response = await fetch(`${ATTIO_BASE_URL}/objects/companies/records/${recordId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as Record<string, any>;
    throw new Error(json?.message ?? json?.error ?? `Attio returned ${response.status}`);
  }
}
