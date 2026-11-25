import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { DatabaseSync } from "node:sqlite";
import type { Authority, CaseRecord } from "./types";
import { AUTHORITIES } from "../corpus/authorities";
import { HttpError } from "./http-error";

type Sql = NeonQueryFunction<false, false>;
type CaseRow = { json: CaseRecord | string; revision: number | string };
type FileRow = { evidence_id: string; filename: string; mime: string; data_b64: string };

export type PendingFile = { evidenceId: string; filename: string; mime: string; data: Buffer };

const g = globalThis as typeof globalThis & {
  __ainpathSql?: Sql;
  __ainpathReady?: Promise<void>;
  __ainpathLocal?: { path: string; db: DatabaseSync };
};

const revisions = new WeakMap<CaseRecord, number>();
const weekMs = 7 * 86_400_000;

function localDb() {
  const path = process.env.AINPATH_SQLITE_PATH?.trim();
  if (!path) return undefined;
  if (process.env.VERCEL) throw new Error("SQLite storage requires a persistent local filesystem.");
  if (g.__ainpathLocal?.path === path) return g.__ainpathLocal.db;
  const sqlite = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite") | undefined;
  if (!sqlite) throw new Error("SQLite storage requires Node.js 22.13 or newer.");
  const db = new sqlite.DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA secure_delete = ON;
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS cases_expires_at_idx ON cases (expires_at);
    CREATE TABLE IF NOT EXISTS files (
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      evidence_id TEXT NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL,
      data_b64 TEXT NOT NULL, PRIMARY KEY (case_id, evidence_id)
    );
  `);
  g.__ainpathLocal?.db.close();
  g.__ainpathLocal = { path, db };
  return db;
}

function sql(): Sql {
  if (!g.__ainpathSql) {
    const url = process.env.DATABASE_URL_POOLED?.trim() || process.env.DATABASE_URL?.trim();
    if (!url) throw new Error("Set DATABASE_URL, DATABASE_URL_POOLED or AINPATH_SQLITE_PATH.");
    const parsed = new URL(url);
    if (parsed.searchParams.get("channel_binding") === "require") parsed.searchParams.delete("channel_binding");
    g.__ainpathSql = neon(parsed.toString());
  }
  return g.__ainpathSql;
}

async function ensureSchema() {
  if (!g.__ainpathReady) {
    g.__ainpathReady = (async () => {
      const q = sql();
      await q`CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY, json JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await q`ALTER TABLE cases ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;
      await q`UPDATE cases SET expires_at = COALESCE(
        NULLIF(json->>'retentionExpiresAt', '')::timestamptz, updated_at + INTERVAL '7 days'
      ) WHERE expires_at IS NULL`;
      await q`CREATE INDEX IF NOT EXISTS cases_expires_at_idx ON cases (expires_at)`;
      await q`CREATE TABLE IF NOT EXISTS files (
        case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        evidence_id TEXT NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL,
        data_b64 TEXT NOT NULL, PRIMARY KEY (case_id, evidence_id)
      )`;
    })().catch((err) => {
      g.__ainpathReady = undefined;
      g.__ainpathSql = undefined;
      throw err;
    });
  }
  await g.__ainpathReady;
}

export async function purgeExpiredCases(now = new Date()): Promise<number> {
  const cutoff = now.toISOString();
  const local = localDb();
  if (local) return Number(local.prepare("DELETE FROM cases WHERE expires_at <= ?").run(cutoff).changes);
  await ensureSchema();
  const [row] = await sql()`WITH removed AS (
    DELETE FROM cases WHERE expires_at <= ${cutoff} RETURNING id
  ) SELECT count(*)::int AS count FROM removed`;
  return Number(row.count);
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  const local = localDb();
  const now = new Date().toISOString();
  let row: CaseRow | undefined;
  if (local) {
    local.prepare("DELETE FROM cases WHERE id = ? AND expires_at <= ?").run(id, now);
    row = local.prepare("SELECT json, revision FROM cases WHERE id = ? AND expires_at > ?").get(id, now) as CaseRow | undefined;
  } else {
    await ensureSchema();
    [row] = await sql()`WITH expired AS (
      DELETE FROM cases WHERE id = ${id} AND expires_at <= NOW()
    ) SELECT json, revision FROM cases WHERE id = ${id} AND expires_at > NOW()` as CaseRow[];
  }
  if (!row) return null;
  const c = typeof row.json === "string" ? JSON.parse(row.json) as CaseRecord : row.json;
  c.paymentChannel ??= "UNKNOWN";
  c.processingMode ??= "LOCAL_OFFLINE";
  c.runs ??= [];
  if (c.consent?.version === "pdpa2026-v1.0") c.consent.cloudRegion = null;
  c.caseCode ??= `AP-2026-${c.id.slice(0, 4).toUpperCase()}`;
  c.retentionExpiresAt ??= new Date(Date.parse(c.updatedAt) + weekMs).toISOString();
  revisions.set(c, Number(row.revision));
  return c;
}

export async function saveCase(c: CaseRecord, additions: PendingFile[] = []): Promise<void> {
  const revision = revisions.get(c);
  const expiresAt = c.retentionExpiresAt ?? new Date(Date.now() + weekMs).toISOString();
  const now = new Date().toISOString();
  const payload = JSON.stringify({ ...c, retentionExpiresAt: expiresAt, updatedAt: now });
  const ids = JSON.stringify(c.evidence.map((e) => e.id));
  const files: FileRow[] = additions.map((f) => ({
    evidence_id: f.evidenceId, filename: f.filename, mime: f.mime, data_b64: f.data.toString("base64"),
  }));
  const conflict = () => new HttpError(409, "case-changed-refresh");
  const local = localDb();

  if (local) {
    local.exec("BEGIN IMMEDIATE");
    try {
      if (revision === undefined) {
        local.prepare("INSERT INTO cases (id, json, updated_at, expires_at) VALUES (?, ?, ?, ?)")
          .run(c.id, payload, now, expiresAt);
      } else {
        const result = local.prepare(
          "UPDATE cases SET json = ?, updated_at = ?, expires_at = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND expires_at > ?"
        ).run(payload, now, expiresAt, c.id, revision, now);
        if (!result.changes) throw conflict();
        local.prepare("DELETE FROM files WHERE case_id = ? AND evidence_id NOT IN (SELECT value FROM json_each(?))").run(c.id, ids);
      }
      const add = local.prepare("INSERT INTO files (case_id, evidence_id, filename, mime, data_b64) VALUES (?, ?, ?, ?, ?)");
      for (const f of files) add.run(c.id, f.evidence_id, f.filename, f.mime, f.data_b64);
      local.exec("COMMIT");
    } catch (error) {
      local.exec("ROLLBACK");
      throw error;
    }
  } else {
    await ensureSchema();
    const statement = revision === undefined
      ? "INSERT INTO cases (id, json, updated_at, expires_at) VALUES ($1, $2::jsonb, $3, $4) RETURNING id"
      : "UPDATE cases SET json = $2::jsonb, updated_at = $3, expires_at = $4, revision = revision + 1 WHERE id = $1 AND revision = $7 AND expires_at > NOW() RETURNING id";
    const params = [c.id, payload, now, expiresAt, ids, JSON.stringify(files)];
    const rows = await sql().query(`WITH written AS (${statement}), removed AS (
      DELETE FROM files USING written WHERE case_id = written.id AND NOT ($5::jsonb ? evidence_id)
    ), added AS (
      INSERT INTO files (case_id, evidence_id, filename, mime, data_b64)
      SELECT w.id, f.evidence_id, f.filename, f.mime, f.data_b64 FROM written w
      CROSS JOIN jsonb_to_recordset($6::jsonb)
        AS f(evidence_id text, filename text, mime text, data_b64 text)
    ) SELECT id FROM written`, revision === undefined ? params : [...params, String(revision)]);
    if (!rows.length) throw conflict();
  }

  c.updatedAt = now;
  c.retentionExpiresAt = expiresAt;
  revisions.set(c, revision === undefined ? 0 : revision + 1);
}

export async function deleteCase(id: string): Promise<void> {
  const local = localDb();
  if (local) {
    local.prepare("DELETE FROM cases WHERE id = ?").run(id);
    return;
  }
  await ensureSchema();
  await sql()`DELETE FROM cases WHERE id = ${id}`;
}

export async function getFile(caseId: string, evidenceId: string) {
  const local = localDb();
  let row: FileRow | undefined;
  if (local) {
    row = local.prepare(`SELECT f.* FROM files f JOIN cases c ON c.id = f.case_id
      WHERE f.case_id = ? AND f.evidence_id = ? AND c.expires_at > ?
      AND json_extract(c.json, '$.consent.grantedAt') IS NOT NULL
      AND json_extract(c.json, '$.consent.withdrawnAt') IS NULL`).get(caseId, evidenceId, new Date().toISOString()) as FileRow | undefined;
  } else {
    await ensureSchema();
    [row] = await sql()`SELECT f.* FROM files f JOIN cases c ON c.id = f.case_id
      WHERE f.case_id = ${caseId} AND f.evidence_id = ${evidenceId} AND c.expires_at > NOW()
      AND c.json->'consent'->>'grantedAt' IS NOT NULL
      AND c.json->'consent'->>'withdrawnAt' IS NULL` as FileRow[];
  }
  return row && { data: Buffer.from(row.data_b64, "base64"), mime: row.mime, filename: row.filename };
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
