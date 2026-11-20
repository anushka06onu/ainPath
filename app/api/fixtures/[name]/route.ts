import { fail } from "@/lib/api";
import { HttpError } from "@/lib/cases";
import { buildFixture, INJECTION_DOC, readFixtureFile } from "@/lib/fixtures";

/** Sample files so a tester can try the manual upload path. Fictional content only. */
export async function GET(_r: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    if (name === "injection_test.txt")
      return new Response(INJECTION_DOC, { headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="${name}"` } });
    const docs = [
      ...buildFixture("daraz", "address").docs,
      ...buildFixture("facebook", "address").docs,
      ...buildFixture("daraz", "substitution").docs,
    ];
    const d = docs.find((x) => x.name === name);
    if (!d) throw new HttpError(404, "not-found");
    return new Response(new Uint8Array(readFixtureFile(d)), {
      headers: { "content-type": d.mime + (d.mime.startsWith("text") ? "; charset=utf-8" : ""), "content-disposition": `attachment; filename="${name}"` },
    });
  } catch (e) {
    return fail(e);
  }
}
