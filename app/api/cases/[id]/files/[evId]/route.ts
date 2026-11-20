import fs from "node:fs";
import { fail } from "@/lib/api";
import { HttpError, filePathFor, requireCase } from "@/lib/cases";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string; evId: string }> }) {
  try {
    const { id, evId } = await params;
    const c = requireCase(id);
    const ev = c.evidence.find((e) => e.id === evId);
    if (!ev) throw new HttpError(404, "evidence-not-found");
    const p = filePathFor(c, ev);
    if (!p) throw new HttpError(404, "file-missing");
    return new Response(fs.readFileSync(p), {
      headers: {
        "content-type": ev.mime,
        "content-disposition": `inline; filename="${ev.filename}"`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
