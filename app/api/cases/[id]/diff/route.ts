import { fail, ok } from "@/lib/api";
import { HttpError, requireCase } from "@/lib/cases";
import { diffRuns } from "@/lib/engines/diff";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const c = requireCase(id);
    const url = new URL(req.url);
    let base = url.searchParams.get("base_run_id") ?? undefined;
    let target = url.searchParams.get("target_run_id") ?? undefined;
    if (!base || !target) {
      const runs = c.runs ?? [];
      if (runs.length < 2) throw new HttpError(404, "diff-unavailable");
      target = target ?? runs[runs.length - 1].id;
      base = base ?? runs[runs.length - 1].parentRunId ?? runs[runs.length - 2].id;
    }
    const diff = diffRuns(c, base, target);
    if (!diff) throw new HttpError(404, "diff-unavailable");
    return ok(diff);
  } catch (e) {
    return fail(e);
  }
}
