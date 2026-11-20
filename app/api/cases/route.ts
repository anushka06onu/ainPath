import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { createCase } from "@/lib/cases";
import { toView } from "@/lib/cases";

const Body = z.object({
  lang: z.enum(["bn", "en"]).default("bn"),
  channel: z.enum(["daraz", "facebook", "other"]).default("daraz"),
  paymentChannel: z
    .enum([
      "MFS_BKASH",
      "MFS_NAGAD",
      "MFS_ROCKET",
      "CARD_DEBIT_CREDIT",
      "CASH_ON_DELIVERY",
      "PLATFORM_WALLET",
      "UNKNOWN",
    ])
    .optional(),
  processingMode: z.enum(["LOCAL_OFFLINE", "CLOUD_REGIONAL"]).optional(),
  retentionDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).optional(),
  story: z.string().max(4000).optional(),
  fixture: z.enum(["daraz", "facebook"]).optional(),
  variant: z.enum(["address", "substitution"]).optional(),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json().catch(() => ({})));
    const c = await createCase(body);
    return ok(toView(c), 201);
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "bad-request" }, { status: 400 });
    return fail(e);
  }
}
