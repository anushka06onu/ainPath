import { ok, fail, type Ctx } from "@/lib/api";
import { requireCase, toView } from "@/lib/cases";
import { saveCase } from "@/lib/db";
import { runIntake } from "@/lib/pipeline/intake";

export async function POST(_r: Request, { params }: Ctx) {
  try {
    const c = await requireCase((await params).id);
    const { facts } = await runIntake(c);
    c.facts = facts;
    await saveCase(c);
    return ok(toView(c));
  } catch (e) {
    return fail(e);
  }
}
