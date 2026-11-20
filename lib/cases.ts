import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  CaseRecord,
  CaseView,
  Channel,
  Evidence,
  EvidenceKind,
  Lang,
  PaymentChannel,
  ProcessingMode,
} from "./types";
import { FILES_DIR, allAuthorities, getCase, saveCase } from "./db";
import { extractImage, extractPdf, extractPlain, looksLikeInjection } from "./extract";
import { sha, llmInfo } from "./llm";
import { buildRoadmap } from "./rules";
import { buildFixture, fixtureStory, readFixtureFile, type ChatVariant } from "./fixtures";
import { runIntake } from "./pipeline/intake";

export function limits() {
  return {
    maxMb: Number(process.env.MAX_UPLOAD_MB || 8),
    maxPages: Number(process.env.MAX_PDF_PAGES || 12),
    maxFiles: Number(process.env.MAX_FILES || 8),
  };
}

export const newId = () => crypto.randomBytes(6).toString("hex");

export function toView(c: CaseRecord): CaseView {
  return { ...c, roadmap: buildRoadmap(c), authorities: allAuthorities(), limits: limits(), llm: llmInfo() };
}

export function requireCase(id: string): CaseRecord {
  const c = getCase(id);
  if (!c) throw new HttpError(404, "case-not-found");
  return c;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function guessKind(filename: string): EvidenceKind {
  const n = filename.toLowerCase();
  if (/term|condition|policy/.test(n)) return "terms";
  if (/reject|return/.test(n)) return "rejection";
  if (/chat|messenger|whatsapp|conversation/.test(n)) return "chat";
  if (/receipt|bkash|nagad|payment/.test(n)) return "receipt";
  if (/deliver|courier/.test(n)) return "delivery";
  if (/order|invoice/.test(n)) return "order";
  return "other";
}

const IMG = /\.(png|jpe?g|webp|bmp)$/i;

export async function addEvidence(
  c: CaseRecord,
  input: { filename: string; mime?: string; buf: Buffer; kind?: EvidenceKind }
): Promise<Evidence> {
  const lim = limits();
  if (c.evidence.length >= lim.maxFiles) throw new HttpError(400, "too-many-files");
  if (input.buf.length > lim.maxMb * 1024 * 1024) throw new HttpError(400, "file-too-large");
  const name = input.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "file";
  const isPdf = /\.pdf$/i.test(name) || input.mime === "application/pdf";
  const isImg = IMG.test(name) || (input.mime ?? "").startsWith("image/");
  const isTxt = /\.(txt|md|csv)$/i.test(name) || (input.mime ?? "").startsWith("text/");
  if (!isPdf && !isImg && !isTxt) throw new HttpError(400, "unsupported-type");

  let pages;
  let extraction: Evidence["extraction"] = "text";
  try {
    if (isPdf) {
      const r = await extractPdf(input.buf, lim.maxPages);
      pages = r.pages;
      if (r.truncated) pages = pages.slice(0, lim.maxPages);
    } else if (isImg) {
      pages = await extractImage(input.buf);
      extraction = "ocr";
    } else {
      pages = extractPlain(input.buf.toString("utf8"));
    }
  } catch {
    pages = [{ page: 1, text: "", confidence: 0 }];
    extraction = "failed";
  }

  const id = "E" + newId().slice(0, 5);
  const ext = path.extname(name) || (isPdf ? ".pdf" : ".txt");
  const dir = path.join(FILES_DIR, c.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + ext), input.buf);

  const ev: Evidence = {
    id,
    kind: input.kind ?? guessKind(name),
    filename: name,
    mime: isPdf ? "application/pdf" : isImg ? input.mime || "image/png" : "text/plain",
    sha256: sha(input.buf),
    bytes: input.buf.length,
    pages,
    extraction,
    injectionFlag: pages.some((p) => looksLikeInjection(p.text)),
    createdAt: new Date().toISOString(),
  };
  c.evidence.push(ev);
  return ev;
}

export function filePathFor(c: CaseRecord, ev: Evidence): string | null {
  const dir = path.join(FILES_DIR, c.id);
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).find((x) => x.startsWith(ev.id + "."));
  return f ? path.join(dir, f) : null;
}

export function removeEvidence(c: CaseRecord, evId: string) {
  const ev = c.evidence.find((e) => e.id === evId);
  if (!ev) return;
  const p = filePathFor(c, ev);
  if (p) fs.rmSync(p, { force: true });
  c.evidence = c.evidence.filter((e) => e.id !== evId);
  for (const f of c.facts) f.evidenceIds = f.evidenceIds.filter((i) => i !== evId);
}

export async function createCase(opts: {
  lang: Lang;
  channel: Channel;
  paymentChannel?: PaymentChannel;
  processingMode?: ProcessingMode;
  retentionDays?: number;
  story?: string;
  fixture?: "daraz" | "facebook";
  variant?: ChatVariant;
}): Promise<CaseRecord> {
  const now = new Date().toISOString();
  const retentionDays = opts.retentionDays ?? 7;
  const expires = new Date(Date.now() + retentionDays * 86400000).toISOString();
  const id = newId();
  const c: CaseRecord = {
    id,
    caseCode: `AP-2026-${id.slice(0, 4).toUpperCase()}`,
    lang: opts.lang,
    channel: opts.fixture ? (opts.fixture as Channel) : opts.channel,
    paymentChannel: opts.paymentChannel ?? (opts.fixture === "facebook" ? "MFS_BKASH" : "PLATFORM_WALLET"),
    processingMode: opts.processingMode ?? "LOCAL_OFFLINE",
    retentionExpiresAt: expires,
    story: opts.story ?? "",
    facts: [],
    evidence: [],
    runs: [],
    fixture: opts.fixture,
    createdAt: now,
    updatedAt: now,
  };
  if (opts.fixture) {
    // Fixtures auto-grant local consent so the demo path isn't blocked by the PDPA modal
    c.consent = {
      version: "pdpa2026-v1.0",
      processingMode: "LOCAL_OFFLINE",
      cloudRegion: null,
      purposes: ["ocr_extraction", "legal_triage", "draft_generation"],
      sensitiveDataAck: true,
      retentionDays,
      grantedAt: now,
    };
    c.story = opts.story || fixtureStory(opts.fixture, opts.lang);
    const fx = buildFixture(opts.fixture, opts.variant ?? "address");
    for (const d of fx.docs)
      await addEvidence(c, { filename: d.name, mime: d.mime, buf: readFixtureFile(d), kind: d.kind });
  }
  const { facts } = await runIntake(c);
  c.facts = facts;
  saveCase(c);
  return c;
}

/** Replace the chat evidence with the other fixture variant (demo of evidence sensitivity). */
export async function swapChat(c: CaseRecord, variant: ChatVariant) {
  for (const e of c.evidence.filter((x) => x.kind === "chat")) removeEvidence(c, e.id);
  const ch = c.channel === "facebook" ? "facebook" : "daraz";
  const fx = buildFixture(ch, variant);
  const d = fx.docs.find((x) => x.kind === "chat")!;
  await addEvidence(c, { filename: d.name, mime: d.mime, buf: readFixtureFile(d), kind: "chat" });
  // the chat reading is the only fact the new document changes; drop any stale confirmation of it
  const f = c.facts.find((x) => x.key === "chat_context");
  if (f) {
    f.value = "";
    f.status = "candidate";
    f.source = "model";
  }
}
