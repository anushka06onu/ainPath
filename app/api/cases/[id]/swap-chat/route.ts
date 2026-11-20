import { z } from "zod";
import { ok, fail, type Ctx } from "@/lib/api";
import { requireCase, swapChat, toView } from "@/lib/cases";
import { saveCase } from "@/lib/db";
import { runIntake } from "@/lib/pipeline/intake";

const Body = z.object({ variant: z.enum(["address", "substitution"]) });

export async function POST(req: Request, { params }: Ctx) {
  try {
    const c = await requireCase((await params).id);
    const { variant } = Body.parse(await req.json());
    const wasConfirmed = c.facts.find((f) => f.key === "chat_context")?.status === "confirmed";
    await swapChat(c, variant);
    const { facts } = await runIntake(c);
    c.facts = facts;
    const f = c.facts.find((x) => x.key === "chat_context");
    if (f && wasConfirmed && f.value) f.status = "confirmed";
    await saveCase(c);
    return ok(toView(c));
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "bad-request" }, { status: 400 });
    return fail(e);
  }
}
