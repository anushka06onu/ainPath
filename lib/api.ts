import { HttpError } from "./http-error";

export const noStore = { "cache-control": "private, no-store", "referrer-policy": "no-referrer" };
export const ok = (data: unknown, init = 200) => Response.json(data, { status: init, headers: noStore });

export function fail(e: unknown) {
  if (e instanceof HttpError) return ok({ error: e.message }, e.status);
  console.error("[api] request failed", e instanceof Error ? e.name : "unknown");
  return ok({ error: "server-error" }, 500);
}

export type Ctx = { params: Promise<{ id: string }> };
