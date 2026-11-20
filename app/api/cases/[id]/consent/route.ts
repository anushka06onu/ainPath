import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { HttpError, requireCase, toView } from "@/lib/cases";
import { saveCase } from "@/lib/db";

const Body = z.object({
  processingMode: z.enum(["LOCAL_OFFLINE", "CLOUD_REGIONAL"]).default("LOCAL_OFFLINE"),
  retentionDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7),
  purposes: z.array(z.string()).default(["ocr_extraction", "legal_triage", "draft_generation"]),
  sensitiveDataAck: z.boolean(),
  withdraw: z.boolean().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const c = requireCase(id);
    const body = Body.parse(await req.json());

    if (body.withdraw) {
      if (!c.consent) throw new HttpError(400, "no-consent");
      c.consent = { ...c.consent, withdrawnAt: new Date().toISOString() };
      saveCase(c);
      return ok(toView(c));
    }

    if (!body.sensitiveDataAck) throw new HttpError(400, "sensitive-ack-required");

    const now = new Date().toISOString();
    c.processingMode = body.processingMode;
    c.retentionExpiresAt = new Date(Date.now() + body.retentionDays * 86400000).toISOString();
    c.consent = {
      version: "pdpa2026-v1.0",
      processingMode: body.processingMode,
      cloudRegion: body.processingMode === "CLOUD_REGIONAL" ? "asia-south1" : null,
      purposes: body.purposes,
      sensitiveDataAck: true,
      retentionDays: body.retentionDays,
      grantedAt: now,
    };
    saveCase(c);
    return ok(toView(c));
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "bad-request" }, { status: 400 });
    return fail(e);
  }
}
