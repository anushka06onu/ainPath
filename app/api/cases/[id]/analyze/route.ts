import { fail, type Ctx } from "@/lib/api";
import { HttpError, requireCase, requireConsent, toView } from "@/lib/cases";
import { saveCase } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Streams one JSON object per line: agent progress events, then a final {done:true, case}. */
export async function POST(_r: Request, { params }: Ctx) {
  try {
    const c = await requireCase((await params).id);
    requireConsent(c);
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(ctrl) {
        const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        try {
          await runPipeline(c, (e) => send(e));
          await saveCase(c);
          send({ done: true, case: toView(c) });
        } catch (error) {
          send({ done: true, error: error instanceof HttpError ? error.message : "pipeline-failed" });
        }
        ctrl.close();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
