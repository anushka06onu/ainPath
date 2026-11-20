import { z } from "zod";
import { ok, fail, type Ctx } from "@/lib/api";
import { requireCase, toView } from "@/lib/cases";
import { deleteCase, saveCase } from "@/lib/db";
import type { Fact } from "@/lib/types";

const FACT_KEYS = [
  "item_ordered", "item_received", "seller", "order_date", "delivery_date", "delivery_date_alt",
  "rejection_reason", "prior_action", "has_receipt", "chat_context", "delivery_estimate_in_order",
] as const;

const Patch = z.object({
  story: z.string().max(4000).optional(),
  channel: z.enum(["daraz", "facebook", "other"]).optional(),
  lang: z.enum(["bn", "en"]).optional(),
  facts: z
    .array(
      z.object({
        key: z.enum(FACT_KEYS),
        value: z.string().max(300).optional(),
        status: z.enum(["candidate", "confirmed", "disputed", "unreadable"]).optional(),
        pick: z.boolean().optional(),
      })
    )
    .optional(),
  approved: z.boolean().optional(),
  reporter: z
    .object({
      fullName: z.string().trim().min(1).max(120),
      mobile: z.string().trim().min(6).max(20),
      email: z
        .string()
        .trim()
        .max(120)
        .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "bad-email")
        .optional(),
      address: z.string().trim().max(300).optional(),
      orderRef: z.string().trim().max(80).optional(),
    })
    .optional(),
});

export async function GET(_r: Request, { params }: Ctx) {
  try {
    return ok(toView(await requireCase((await params).id)));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const c = await requireCase((await params).id);
    const p = Patch.parse(await req.json());
    if (p.story !== undefined) c.story = p.story;
    if (p.channel) c.channel = p.channel;
    if (p.lang) c.lang = p.lang;
    for (const u of p.facts ?? []) {
      let f = c.facts.find((x) => x.key === u.key);
      if (!f) {
        f = { key: u.key, value: "", status: "candidate", evidenceIds: [], source: "user" } as Fact;
        c.facts.push(f);
      }
      if (u.pick && u.key === "delivery_date_alt") {
        const main = c.facts.find((x) => x.key === "delivery_date");
        if (main) {
          const old = main.value;
          main.value = f.value;
          main.source = "user";
          main.status = "confirmed";
          f.value = old;
        }
        continue;
      }
      if (u.value !== undefined && u.value !== f.value) {
        f.value = u.value;
        f.source = "user";
        if (u.status === undefined) f.status = "candidate";
      }
      if (u.status) f.status = u.status;
    }
    if (p.approved !== undefined) c.approvedAt = p.approved ? new Date().toISOString() : undefined;
    if (p.reporter) {
      c.reporter = {
        fullName: p.reporter.fullName,
        mobile: p.reporter.mobile,
        ...(p.reporter.email ? { email: p.reporter.email } : {}),
        ...(p.reporter.address ? { address: p.reporter.address } : {}),
        ...(p.reporter.orderRef ? { orderRef: p.reporter.orderRef } : {}),
      };
    }
    await saveCase(c);
    return ok(toView(c));
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "bad-request" }, { status: 400 });
    return fail(e);
  }
}

export async function DELETE(_r: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireCase(id);
    await deleteCase(id);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
