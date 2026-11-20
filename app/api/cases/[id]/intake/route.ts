import { ok, fail, type Ctx } from "@/lib/api";
import { requireCase, toView } from "@/lib/cases";
import { saveCase } from "@/lib/db";
import { runIntake } from "@/lib/pipeline/intake";

/** Re-run intake only (story / documents changed). Confirmed facts that still match are kept. */
export async function POST(_r: Request, { params }: Ctx) {
  try {
    const c = requireCase((await params).id);
    const { facts } = await runIntake(c);
    c.facts = facts;
    saveCase(c);
    return ok(toView(c));
  } catch (e) {
    return fail(e);
  }
}
