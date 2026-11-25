import { timingSafeEqual } from "node:crypto";
import { fail, ok } from "@/lib/api";
import { purgeExpiredCases } from "@/lib/db";
import { sha } from "@/lib/llm";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(Buffer.from(sha(supplied)), Buffer.from(sha("Bearer " + secret)))) {
    return ok({ error: "unauthorized" }, 401);
  }
  try {
    return ok({ deleted: await purgeExpiredCases() });
  } catch (error) {
    return fail(error);
  }
}
