import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Authority, CaseRecord } from "./types";
import { AUTHORITIES } from "../corpus/authorities";

type Sql = NeonQueryFunction<false, false>;

const g = globalThis as unknown as {
  __ainpathSql?: Sql;
  __ainpathReady?: Promise<void>;
};

function connectionString(): string {
  const pooled = process.env.DATABASE_URL_POOLED?.trim();
  const direct = process.env.DATABASE_URL?.trim();
  const url = pooled || direct;
  if (!url) {
    throw new Error(
      "DATABASE_URL (or DATABASE_URL_POOLED) is required. Set it in .env.local / Vercel env."
    );
  }
  // Neon serverless HTTP driver is happier without channel_binding
  return url.replace(/([?&])channel_binding=require&?/, "$1").replace(/[?&]$/, "");
}

function sql(): Sql {
  if (!g.__ainpathSql) g.__ainpathSql = neon(connectionString());
  return g.__ainpathSql;
}

async function ensureSchema() {
  if (!g.__ainpathReady) {
    g.__ainpathReady = (async () => {
      const q = sql();
      await q`
        CREATE TABLE IF NOT EXISTS cases (
          id TEXT PRIMARY KEY,
          json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await q`
        CREATE TABLE IF NOT EXISTS files (
          case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
          evidence_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          mime TEXT NOT NULL,
          data_b64 TEXT NOT NULL,
          PRIMARY KEY (case_id, evidence_id)
        )
      `;
      await q`CREATE INDEX IF NOT EXISTS cases_updated_at_idx ON cases (updated_at DESC)`;
    })().catch((err) => {
      // Allow the next request to retry after a transient Neon / env failure
      g.__ainpathReady = undefined;
      g.__ainpathSql = undefined;
      throw err;
    });
  }
  await g.__ainpathReady;
}

function migrateCase(c: CaseRecord): CaseRecord {
  if (!c.paymentChannel) c.paymentChannel = "UNKNOWN";
  if (!c.processingMode) c.processingMode = "LOCAL_OFFLINE";
  if (!c.runs) c.runs = [];
  if (!c.caseCode) c.caseCode = `AP-2026-${c.id.slice(0, 4).toUpperCase()}`;
  return c;
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  await ensureSchema();
  const rows = await sql()`SELECT json FROM cases WHERE id = ${id} LIMIT 1`;
  const row = rows[0] as { json: CaseRecord } | undefined;
  if (!row) return null;
  const raw = typeof row.json === "string" ? (JSON.parse(row.json) as CaseRecord) : row.json;
  return migrateCase(raw);
}

export async function saveCase(c: CaseRecord): Promise<void> {
  await ensureSchema();
  c.updatedAt = new Date().toISOString();
  // Pass a plain object — Neon serializes JSONB parameters.
  const payload = JSON.parse(JSON.stringify(c)) as CaseRecord;
  await sql()`
    INSERT INTO cases (id, json, updated_at)
    VALUES (${c.id}, ${payload as never}, ${c.updatedAt})
    ON CONFLICT (id) DO UPDATE
    SET json = EXCLUDED.json, updated_at = EXCLUDED.updated_at
  `;
}

export async function deleteCase(id: string): Promise<void> {
  await ensureSchema();
  // files cascade via FK
  await sql()`DELETE FROM cases WHERE id = ${id}`;
}

export async function putFile(input: {
  caseId: string;
  evidenceId: string;
  filename: string;
  mime: string;
  data: Buffer;
}): Promise<void> {
  await ensureSchema();
  // Ensure parent row exists for FK — caller should have saved the case first when creating.
  // For addEvidence we store file before saveCase; upsert case stub if needed.
  const existing = await sql()`SELECT id FROM cases WHERE id = ${input.caseId} LIMIT 1`;
  if (!existing[0]) {
    const stub = {
      id: input.caseId,
      lang: "en",
      channel: "other",
      paymentChannel: "UNKNOWN",
      processingMode: "LOCAL_OFFLINE",
      story: "",
      facts: [],
      evidence: [],
      runs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await sql()`
      INSERT INTO cases (id, json, updated_at)
      VALUES (${input.caseId}, ${stub as never}, NOW())
      ON CONFLICT (id) DO NOTHING
    `;
  }

  const dataB64 = input.data.toString("base64");
  await sql()`
    INSERT INTO files (case_id, evidence_id, filename, mime, data_b64)
    VALUES (
      ${input.caseId},
      ${input.evidenceId},
      ${input.filename},
      ${input.mime},
      ${dataB64}
    )
    ON CONFLICT (case_id, evidence_id) DO UPDATE
    SET filename = EXCLUDED.filename,
        mime = EXCLUDED.mime,
        data_b64 = EXCLUDED.data_b64
  `;
}

export async function getFile(
  caseId: string,
  evidenceId: string
): Promise<{ data: Buffer; mime: string; filename: string } | null> {
  await ensureSchema();
  const rows = await sql()`
    SELECT data_b64, mime, filename
    FROM files
    WHERE case_id = ${caseId} AND evidence_id = ${evidenceId}
    LIMIT 1
  `;
  const row = rows[0] as { data_b64: string; mime: string; filename: string } | undefined;
  if (!row) return null;
  return {
    data: Buffer.from(row.data_b64, "base64"),
    mime: row.mime,
    filename: row.filename,
  };
}

export async function deleteFile(caseId: string, evidenceId: string): Promise<void> {
  await ensureSchema();
  await sql()`DELETE FROM files WHERE case_id = ${caseId} AND evidence_id = ${evidenceId}`;
}

/** Pinned corpus lives in code — no DB round-trip on Vercel cold starts. */
export function getAuthority(id: string): Authority | null {
  return AUTHORITIES.find((a) => a.id === id) ?? null;
}

export function allAuthorities(): Authority[] {
  return AUTHORITIES;
}

/** Lightweight keyword retrieval over the pinned corpus (replaces SQLite FTS5). */
export function searchAuthorities(query: string, limit = 6): Authority[] {
  const terms = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 12);
  if (!terms.length) return [];

  const scored = AUTHORITIES.map((a) => {
    const hay = `${a.title.en} ${a.title.bn} ${a.section} ${a.passage} ${a.neighbours ?? ""}`.toLowerCase();
    let score = 0;
    for (const t of terms) if (hay.includes(t)) score += 1;
    return { a, score };
  })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);

  return scored.map((x) => x.a);
}
