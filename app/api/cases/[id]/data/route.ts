import { fail, noStore, type Ctx } from "@/lib/api";
import { requireCase } from "@/lib/cases";

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const c = await requireCase((await params).id);
    const { pipelineCache, demoModelEligible, ...data } = c;
    void pipelineCache;
    void demoModelEligible;
    return Response.json(data, {
      headers: {
        ...noStore,
        "content-disposition": 'attachment; filename="ainpath-case.json"',
      },
    });
  } catch (error) {
    return fail(error);
  }
}
