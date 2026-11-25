import { fail, noStore } from "@/lib/api";
import { HttpError, requireCase, requireConsent } from "@/lib/cases";
import { getFile } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string; evId: string }> }) {
  try {
    const { id, evId } = await params;
    const c = await requireCase(id);
    requireConsent(c);
    const ev = c.evidence.find((e) => e.id === evId);
    if (!ev) throw new HttpError(404, "evidence-not-found");
    const file = await getFile(c.id, ev.id);
    if (!file) throw new HttpError(404, "file-missing");
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/bmp"];
    const mime = allowed.includes(file.mime) ? file.mime : "text/plain; charset=utf-8";
    return new Response(new Uint8Array(file.data), {
      headers: {
        "content-type": mime,
        "content-disposition": `inline; filename="${ev.filename}"`,
        "x-content-type-options": "nosniff",
        ...noStore,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
