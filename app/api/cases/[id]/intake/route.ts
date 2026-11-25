import { ok, fail, type Ctx } from "@/lib/api";
import { invalidateAnalysis, requireCase, requireConsent, toView } from "@/lib/cases";
import { saveCase } from "@/lib/db";
import { runIntake } from "@/lib/pipeline/intake";

export async function POST(_r: Request, { params }: Ctx) {
  try {
    const c = await requireCase((await params).id);
    if (c.consent?.withdrawnAt) requireConsent(c);
    const { facts } = await runIntake(c);
    if (JSON.stringify(c.facts) !== JSON.stringify(facts)) invalidateAnalysis(c);
    c.facts = facts;
    await saveCase(c);
    return ok(toView(c));
  } catch (e) {
    return fail(e);
  }
}
