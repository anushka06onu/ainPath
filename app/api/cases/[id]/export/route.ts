import { fail, type Ctx } from "@/lib/api";
import { HttpError, requireCase } from "@/lib/cases";
import { buyerDraft, evidenceIndex, memo, render } from "@/lib/export";
import { buildCasePdf } from "@/lib/pdf-report";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: Ctx) {
  try {
    const c = await requireCase((await params).id);
    if (!c.approvedAt) throw new HttpError(403, "not-approved");
    const u = new URL(req.url).searchParams;
    const type = u.get("type") ?? "report";
    const format = u.get("format") ?? "pdf";
    const lang: Lang =
      u.get("lang") === "en" ? "en" : u.get("lang") === "bn" ? "bn" : c.lang;
    const redact = u.get("redact") !== "0";
    const sel = u.get("attach");
    const selected = sel ? sel.split(",").filter(Boolean) : null;
    if (format === "pdf" || type === "report") {
      const pdf = await buildCasePdf(c, lang, redact);
      const inline = u.get("download") === "0";
      return new Response(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": inline
            ? `inline; filename="ainpath-report-${c.id}.pdf"`
            : `attachment; filename="ainpath-report-${c.id}.pdf"`,
          "cache-control": "no-store",
        },
      });
    }

    if (format !== "md" && format !== "html") {
      throw new HttpError(400, "bad-format");
    }

    const download = u.get("download") === "1";
    let blocks;
    if (type === "buyer") blocks = buyerDraft(c, lang, redact);
    else if (type === "index") blocks = evidenceIndex(c, lang, selected);
    else if (type === "memo") blocks = memo(c, lang, redact);
    else throw new HttpError(400, "bad-type");
    const body = render(blocks, format, lang, `AinPath ${type}`);
    return new Response(body, {
      headers: {
        "content-type":
          format === "md" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8",
        ...(download
          ? { "content-disposition": `attachment; filename="ainpath-${type}-${c.id}.${format}"` }
          : {}),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
