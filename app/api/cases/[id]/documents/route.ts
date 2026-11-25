import { z } from "zod";
import { ok, fail, type Ctx } from "@/lib/api";
import { HttpError, addEvidence, invalidateAnalysis, limits, removeEvidence, requireCase, requireConsent, resetEvidenceFacts, toView } from "@/lib/cases";
import { saveCase, type PendingFile } from "@/lib/db";
import { looksLikeInjection } from "@/lib/extract";
import { runIntake } from "@/lib/pipeline/intake";
import type { EvidenceKind } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const KINDS = ["terms", "order", "chat", "receipt", "rejection", "delivery", "other"] as const;

export async function POST(req: Request, { params }: Ctx) {
  try {
    const c = await requireCase((await params).id);
    requireConsent(c);
    const form = await req.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (!files.length) throw new HttpError(400, "no-file");
    const kindRaw = String(form.get("kind") ?? "");
    const kind = (KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as EvidenceKind) : undefined;
    if (c.evidence.length + files.length > limits().maxFiles) throw new HttpError(400, "too-many-files");
    const pending: PendingFile[] = [];
    const added = [];
    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer());
      added.push(await addEvidence(c, { filename: f.name, mime: f.type, buf, kind }, pending));
    }
    c.demoModelEligible = false;
    invalidateAnalysis(c);
    c.facts = (await runIntake(c)).facts;
    await saveCase(c, pending);
    return ok({ added: added.map((a) => a.id), case: toView(c) }, 201);
  } catch (e) {
    return fail(e);
  }
}

const Correct = z.object({ evidenceId: z.string(), page: z.number().int(), text: z.string().max(50000) });
const Kind = z.object({ evidenceId: z.string(), kind: z.enum(KINDS) });

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const c = await requireCase((await params).id);
    requireConsent(c);
    const body = await req.json();
    if (!body || typeof body !== "object") throw new HttpError(400, "bad-request");
    if ("kind" in body) {
      const k = Kind.parse(body);
      const ev = c.evidence.find((e) => e.id === k.evidenceId);
      if (!ev) throw new HttpError(404, "evidence-not-found");
      if (ev.kind === k.kind) return ok(toView(c));
      ev.kind = k.kind;
      resetEvidenceFacts(c, ev.id);
    } else {
      const k = Correct.parse(body);
      const ev = c.evidence.find((e) => e.id === k.evidenceId);
      const pg = ev?.pages.find((p) => p.page === k.page);
      if (!ev || !pg) throw new HttpError(404, "evidence-not-found");
      if (pg.text === k.text) return ok(toView(c));
      pg.text = k.text;
      pg.confidence = 1;
      ev.corrected = true;
      resetEvidenceFacts(c, ev.id);
      ev.injectionFlag = ev.pages.some((p) => looksLikeInjection(p.text));
    }
    c.demoModelEligible = false;
    invalidateAnalysis(c, true);
    c.facts = (await runIntake(c)).facts;
    await saveCase(c);
    return ok(toView(c));
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "bad-request" }, { status: 400 });
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const c = await requireCase((await params).id);
    const evId = new URL(req.url).searchParams.get("evidenceId") ?? "";
    removeEvidence(c, evId);
    c.demoModelEligible = false;
    invalidateAnalysis(c, true);
    c.facts = (await runIntake(c)).facts;
    await saveCase(c);
    return ok(toView(c));
  } catch (e) {
    return fail(e);
  }
}
