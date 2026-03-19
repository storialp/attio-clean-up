import postgres from "postgres";
import { DeletionLogItem, SimplifiedCompany } from "@/lib/types";

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
