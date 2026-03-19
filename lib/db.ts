import postgres from "postgres";
import { CachedCompanyStatus, DeletionLogItem, SimplifiedCompany } from "@/lib/types";

let initialized = false;
let sqlClient: ReturnType<typeof postgres> | null = null;

function getSql() {
  if (sqlClient) {
    return sqlClient;
  }

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing POSTGRES_URL or DATABASE_URL. Add a Postgres database in Vercel.");
  }

  sqlClient = postgres(connectionString, {
    ssl: "require",
    max: 1,
  });

  return sqlClient;
}

export async function ensureDeletionLogTable() {
  if (initialized) {
    return;
  }

  const sql = getSql();
  await sql`
    create table if not exists cached_companies (
      record_id text primary key,
      company_name text not null,
      primary_domain text,
      description text,
      employee_range text,
      tags jsonb not null default '[]'::jsonb,
      attio_url text,
      status text not null default 'pending',
      raw_payload jsonb not null,
      synced_at timestamptz not null default now()
    )
  `;
  await sql`
    create index if not exists cached_companies_status_idx
    on cached_companies (status)
  `;
  await sql`
    create table if not exists deleted_companies (
      id bigserial primary key,
      record_id text not null,
      company_name text,
      primary_domain text,
      deleted_at timestamptz not null default now(),
      attio_url text,
      raw_payload jsonb not null
    )
  `;
  initialized = true;
}

export async function upsertCachedCompanies(companies: SimplifiedCompany[]) {
  await ensureDeletionLogTable();
  if (!companies.length) {
    return;
  }

  const sql = getSql();
  for (const company of companies) {
    const rawPayload = JSON.parse(JSON.stringify(company.raw)) as Parameters<typeof sql.json>[0];
    await sql`
      insert into cached_companies (
        record_id,
        company_name,
        primary_domain,
        description,
        employee_range,
        tags,
        attio_url,
        raw_payload
      ) values (
        ${company.id},
        ${company.name},
        ${company.domain || null},
        ${company.description || null},
        ${company.employeeRange || null},
        ${sql.json(company.tags)},
        ${company.webUrl || null},
        ${sql.json(rawPayload)}
      )
      on conflict (record_id) do update set
        company_name = excluded.company_name,
        primary_domain = excluded.primary_domain,
        description = excluded.description,
        employee_range = excluded.employee_range,
        tags = excluded.tags,
        attio_url = excluded.attio_url,
        raw_payload = excluded.raw_payload,
        synced_at = now()
    `;
  }
}

export async function listPendingCompanies(limit = 25, excludeIds: string[] = []): Promise<SimplifiedCompany[]> {
  await ensureDeletionLogTable();
  const sql = getSql();
  const exclusionClause = excludeIds.length
    ? sql`and record_id not in ${sql(excludeIds)}`
    : sql``;

  const rows = await sql<
    Array<{
      record_id: string;
      company_name: string;
      primary_domain: string | null;
      description: string | null;
      employee_range: string | null;
      tags: string[] | null;
      attio_url: string | null;
      raw_payload: Record<string, unknown>;
    }>
  >`
    select
      record_id,
      company_name,
      primary_domain,
      description,
      employee_range,
      tags,
      attio_url,
      raw_payload
    from cached_companies
    where status = 'pending'
      ${exclusionClause}
    order by random()
    limit ${limit}
  `;

  return rows.map((row) => ({
    id: row.record_id,
    name: row.company_name,
    domain: row.primary_domain || "",
    description: row.description || "",
    employeeRange: row.employee_range || "Unknown",
    tags: Array.isArray(row.tags) ? row.tags : [],
    webUrl: row.attio_url || "",
    raw: row.raw_payload || {},
  }));
}

export async function updateCachedCompanyStatus(recordId: string, status: CachedCompanyStatus) {
  await ensureDeletionLogTable();
  const sql = getSql();

  await sql`
    update cached_companies
    set status = ${status}
    where record_id = ${recordId}
  `;
}

export async function insertDeletion(company: SimplifiedCompany) {
  await ensureDeletionLogTable();
  const sql = getSql();
  const rawPayload = JSON.parse(JSON.stringify(company.raw)) as Parameters<typeof sql.json>[0];

  await sql`
    insert into deleted_companies (
      record_id,
      company_name,
      primary_domain,
      attio_url,
      raw_payload
    ) values (
      ${company.id},
      ${company.name},
      ${company.domain || null},
      ${company.webUrl || null},
      ${sql.json(rawPayload)}
    )
  `;
}

export async function listDeletions(limit = 12): Promise<DeletionLogItem[]> {
  await ensureDeletionLogTable();
  const sql = getSql();

  const rows = await sql<DeletionLogItem[]>`
    select
      id,
      record_id as "recordId",
      company_name as "companyName",
      primary_domain as "primaryDomain",
      deleted_at as "deletedAt",
      attio_url as "attioUrl"
    from deleted_companies
    order by id desc
    limit ${limit}
  `;

  return rows;
}
