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
        /** "pick" resolves a date conflict: swap the competing date into place */
        pick: z.boolean().optional(),
      })
    )
    .optional(),
  approved: z.boolean().optional(),
});

export async function GET(_r: Request, { params }: Ctx) {
  try {
    return ok(toView(requireCase((await params).id)));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const c = requireCase((await params).id);
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
        // the user chose the other date as the trigger: swap, keep the former value as the recorded alternative
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
    // a confirmed trigger date resolves the date conflict
    const dd = c.facts.find((x) => x.key === "delivery_date");
    if (dd?.status === "confirmed") {
      /* keep delivery_date_alt on record; the roadmap uses the confirmed trigger */
    }
    if (p.approved !== undefined) c.approvedAt = p.approved ? new Date().toISOString() : undefined;
    saveCase(c);
    return ok(toView(c));
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "bad-request" }, { status: 400 });
    return fail(e);
  }
}

export async function DELETE(_r: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    requireCase(id);
    deleteCase(id);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
