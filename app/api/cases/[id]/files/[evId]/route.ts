import { fail } from "@/lib/api";
import { HttpError, requireCase } from "@/lib/cases";
import { getFile } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string; evId: string }> }) {
  try {
    const { id, evId } = await params;
    const c = await requireCase(id);
    const ev = c.evidence.find((e) => e.id === evId);
    if (!ev) throw new HttpError(404, "evidence-not-found");
    const file = await getFile(c.id, ev.id);
    if (!file) throw new HttpError(404, "file-missing");
    return new Response(new Uint8Array(file.data), {
      headers: {
        "content-type": ev.mime || file.mime,
        "content-disposition": `inline; filename="${ev.filename}"`,
        "x-content-type-options": "nosniff",
        "cache-control": "private, max-age=60",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
