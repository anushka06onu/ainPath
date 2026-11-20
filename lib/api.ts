import { HttpError } from "./cases";

export const ok = (data: unknown, init?: number) => Response.json(data, { status: init ?? 200 });

export function fail(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  const message = e instanceof Error ? e.message : "unknown";
  console.error("[api]", message);
  // Surface actionable config errors to the client (missing DB URL, etc.)
  const configHint =
    /DATABASE_URL|required|ECONNREFUSED|password authentication|Neon/i.test(message);
  return Response.json(
    { error: configHint ? message : "server-error" },
    { status: 500 }
  );
}

export type Ctx = { params: Promise<{ id: string }> };
