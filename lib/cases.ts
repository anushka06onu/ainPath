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
import {
  allAuthorities,
  getCase,
  purgeExpiredCases,
  type PendingFile,
  saveCase,
} from "./db";
import { extractImage, extractPdf, extractPlain, looksLikeInjection } from "./extract";
import { sha, llmInfo } from "./llm";
import { buildRoadmap } from "./rules";
import { buildFixture, fixtureStory, readFixtureFile, type ChatVariant } from "./fixtures";
import { runIntake } from "./pipeline/intake";
import { HttpError } from "./http-error";

export { HttpError } from "./http-error";

export function limits() {
  return {
    maxMb: Number(process.env.MAX_UPLOAD_MB || 8),
    maxPages: Number(process.env.MAX_PDF_PAGES || 12),
    maxFiles: Number(process.env.MAX_FILES || 8),
  };
}

export const newId = () => crypto.randomBytes(16).toString("hex");

export function toView(c: CaseRecord): CaseView {
  const { pipelineCache, demoModelEligible, ...view } = c;
  void pipelineCache;
  void demoModelEligible;
  return { ...view, roadmap: buildRoadmap(c), authorities: allAuthorities(), limits: limits(), llm: llmInfo(c) };
}

export async function requireCase(id: string): Promise<CaseRecord> {
  const c = await getCase(id);
  if (!c) throw new HttpError(404, "case-not-found");
  return c;
}

export function requireConsent(c: CaseRecord) {
  if (!c.consent?.sensitiveDataAck || c.consent.withdrawnAt) {
    throw new HttpError(403, "consent-required");
  }
}

export function invalidateAnalysis(c: CaseRecord, clearHistory = false) {
  c.analysis = undefined;
  c.approvedAt = undefined;
  if (clearHistory) {
    c.runs = [];
    c.activeRunId = undefined;
    c.pipelineCache = undefined;
  }
}

export function resetEvidenceFacts(c: CaseRecord, evidenceId: string) {
  for (const fact of c.facts) {
    if (!fact.evidenceIds.includes(evidenceId)) continue;
    fact.evidenceIds = fact.evidenceIds.filter((id) => id !== evidenceId);
    if (fact.source !== "user") {
      fact.value = "";
      fact.status = "candidate";
    }
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

function sniffMime(buf: Buffer, name: string, declared?: string): string {
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (buf.subarray(0, 3).toString("hex") === "ffd8ff") return "image/jpeg";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (/\.bmp$/i.test(name) && buf.subarray(0, 2).toString("ascii") === "BM") return "image/bmp";
  if (/\.(txt|md|csv)$/i.test(name) || ["text/plain", "text/markdown", "text/csv"].includes(declared ?? "")) {
    if (!buf.includes(0)) {
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(buf);
        return "text/plain";
      } catch { /* Reject binary data presented as text. */ }
    }
  }
  throw new HttpError(400, "unsupported-type");
}

export async function addEvidence(
  c: CaseRecord,
  input: { filename: string; mime?: string; buf: Buffer; kind?: EvidenceKind },
  files: PendingFile[],
): Promise<Evidence> {
  const lim = limits();
  if (c.evidence.length >= lim.maxFiles) throw new HttpError(400, "too-many-files");
  if (input.buf.length > lim.maxMb * 1024 * 1024) throw new HttpError(400, "file-too-large");
  const name = input.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "file";
  if (!input.buf.length) throw new HttpError(400, "empty-file");
  const mime = sniffMime(input.buf, name, input.mime);

  let pages;
  let extraction: Evidence["extraction"] = "text";
  try {
    if (mime === "application/pdf") {
      const r = await extractPdf(input.buf, lim.maxPages);
      pages = r.pages;
      if (pages.every((page) => !page.confidence)) extraction = "failed";
    } else if (mime.startsWith("image/")) {
      pages = await extractImage(input.buf);
      extraction = "ocr";
    } else {
      pages = extractPlain(input.buf.toString("utf8"));
    }
  } catch {
    pages = [{ page: 1, text: "", confidence: 0 }];
    extraction = "failed";
  }

  const id = "E" + newId().slice(0, 12);
  files.push({ evidenceId: id, filename: name, mime, data: input.buf });

  const ev: Evidence = {
    id,
    kind: input.kind ?? guessKind(name),
    filename: name,
    mime,
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

export function removeEvidence(c: CaseRecord, evId: string) {
  if (!c.evidence.some((e) => e.id === evId)) throw new HttpError(404, "evidence-not-found");
  c.evidence = c.evidence.filter((e) => e.id !== evId);
  resetEvidenceFacts(c, evId);
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
    paymentChannel: opts.paymentChannel ?? (opts.fixture === "facebook" ? "MFS_BKASH" : opts.fixture === "daraz" ? "CASH_ON_DELIVERY" : "UNKNOWN"),
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
  const files: PendingFile[] = [];

  if (opts.fixture) {
    c.demoModelEligible = !opts.story;
    c.consent = {
      version: "demo-synthetic-v1",
      processingMode: "LOCAL_OFFLINE",
      cloudRegion: null,
      purposes: ["ocr_extraction", "legal_triage", "draft_generation"],
      sensitiveDataAck: true,
      retentionDays,
      grantedAt: now,
    };
    c.story = opts.story || fixtureStory(opts.fixture, opts.lang);
    const fx = buildFixture(opts.fixture, opts.variant ?? "address", new Date(now));
    for (const d of fx.docs)
      await addEvidence(c, { filename: d.name, mime: d.mime, buf: readFixtureFile(d), kind: d.kind }, files);
  }
  const { facts } = await runIntake(c);
  c.facts = facts;
  await purgeExpiredCases();
  await saveCase(c, files);
  return c;
}

/** Replace the chat evidence with the other fixture variant (demo of evidence sensitivity). */
export async function swapChat(c: CaseRecord, variant: ChatVariant) {
  if (!c.fixture) throw new HttpError(403, "sample-only");
  for (const e of c.evidence.filter((x) => x.kind === "chat")) removeEvidence(c, e.id);
  const ch = c.channel === "facebook" ? "facebook" : "daraz";
  const fx = buildFixture(ch, variant, new Date(c.createdAt));
  const d = fx.docs.find((x) => x.kind === "chat")!;
  const files: PendingFile[] = [];
  await addEvidence(c, { filename: d.name, mime: d.mime, buf: readFixtureFile(d), kind: "chat" }, files);
  invalidateAnalysis(c);
  const f = c.facts.find((x) => x.key === "chat_context");
  if (f) {
    f.value = "";
    f.status = "candidate";
    f.source = "model";
  }
  return files;
}
