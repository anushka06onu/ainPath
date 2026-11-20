import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Authority, CaseRecord } from "./types";
import { AUTHORITIES } from "../corpus/authorities";

const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const g = globalThis as unknown as { __ainpathDb?: DatabaseSync };

function open(): DatabaseSync {
  const db = new DatabaseSync(path.join(DATA_DIR, "ainpath.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS authorities (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS authorities_fts USING fts5(
      id UNINDEXED, title, section, passage, neighbours
    );
  `);
  // (Re)seed the pinned corpus on every boot so the file is the single source of truth.
  db.exec("DELETE FROM authorities; DELETE FROM authorities_fts;");
  const ins = db.prepare("INSERT INTO authorities (id, json) VALUES (?, ?)");
  const fts = db.prepare(
    "INSERT INTO authorities_fts (id, title, section, passage, neighbours) VALUES (?, ?, ?, ?, ?)"
  );
  for (const a of AUTHORITIES) {
    ins.run(a.id, JSON.stringify(a));
    fts.run(a.id, `${a.title.en} ${a.title.bn}`, a.section, a.passage, a.neighbours ?? "");
  }
  return db;
}

export function db(): DatabaseSync {
  if (!g.__ainpathDb) g.__ainpathDb = open();
  return g.__ainpathDb;
}

function migrateCase(c: CaseRecord): CaseRecord {
  if (!c.paymentChannel) c.paymentChannel = "UNKNOWN";
  if (!c.processingMode) c.processingMode = "LOCAL_OFFLINE";
  if (!c.runs) c.runs = [];
  if (!c.caseCode) c.caseCode = `AP-2026-${c.id.slice(0, 4).toUpperCase()}`;
  return c;
}

export function getCase(id: string): CaseRecord | null {
  const row = db().prepare("SELECT json FROM cases WHERE id = ?").get(id) as
    | { json: string }
    | undefined;
  return row ? migrateCase(JSON.parse(row.json) as CaseRecord) : null;
}

export function saveCase(c: CaseRecord): void {
  c.updatedAt = new Date().toISOString();
  db()
    .prepare(
      "INSERT INTO cases (id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at"
    )
    .run(c.id, JSON.stringify(c), c.updatedAt);
}

export function deleteCase(id: string): void {
  db().prepare("DELETE FROM cases WHERE id = ?").run(id);
  const dir = path.join(DATA_DIR, "files", id);
  fs.rmSync(dir, { recursive: true, force: true });
}

export function getAuthority(id: string): Authority | null {
  const row = db().prepare("SELECT json FROM authorities WHERE id = ?").get(id) as
    | { json: string }
    | undefined;
  return row ? (JSON.parse(row.json) as Authority) : null;
}

export function allAuthorities(): Authority[] {
  return (db().prepare("SELECT json FROM authorities").all() as { json: string }[]).map(
    (r) => JSON.parse(r.json) as Authority
  );
}

/** FTS5 retrieval over the pinned corpus. Terms are sanitised into a safe OR query. */
export function searchAuthorities(query: string, limit = 6): Authority[] {
  const terms = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 12);
  if (!terms.length) return [];
  const match = terms.map((t) => `"${t}"`).join(" OR ");
  const rows = db()
    .prepare(
      "SELECT id FROM authorities_fts WHERE authorities_fts MATCH ? ORDER BY rank LIMIT ?"
    )
    .all(match, limit) as { id: string }[];
  return rows.map((r) => getAuthority(r.id)).filter((a): a is Authority => !!a);
}

export const FILES_DIR = path.join(DATA_DIR, "files");
