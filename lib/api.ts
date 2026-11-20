import { HttpError } from "./cases";

export const ok = (data: unknown, init?: number) => Response.json(data, { status: init ?? 200 });

export function fail(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error("[api]", e instanceof Error ? e.message : "unknown");
  return Response.json({ error: "server-error" }, { status: 500 });
}

export type Ctx = { params: Promise<{ id: string }> };
