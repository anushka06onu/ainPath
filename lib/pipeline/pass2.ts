import { z } from "zod";
import type { AgentRun, Bi, CaseRecord, Finding, Pass2Verdict } from "../types";
import { llmInfo, llmJson, LLMError, sha, UNTRUSTED_NOTE } from "../llm";
import { allAuthorities, getAuthority } from "../db";
import { applyHierarchyToFinding } from "../engines/hierarchy";

const Pass2Schema = z.object({
  checks: z.array(z.object({
    id: z.string(),
    verdict: z.enum(["PASS", "FLAG_MISGROUNDED", "FLAG_HIERARCHY", "FLAG_MISSING_EXCEPTION"]),
    note_en: z.string().trim().min(1).max(600),
    note_bn: z.string().trim().min(1).max(600),
  })).max(8),
});

export async function runVerifyPass2(findings: Finding[], c: CaseRecord) {
  const t0 = Date.now();
  const info = llmInfo(c);
  const checks = new Map<string, { verdict: Pass2Verdict; note: Bi }>();
  const next = findings.map((f) => applyHierarchyToFinding(f, allAuthorities()));
  const eligible = next.filter((f) => f.status !== "unresolved" && f.status !== "rejected_ungrounded" &&
    f.pass2Verdict !== "FLAG_HIERARCHY");
  const deliveryEstimate = c.facts.find((f) => f.key === "delivery_estimate_in_order");
  const chat = c.facts.find((f) => f.key === "chat_context");
  const reviewFacts = [deliveryEstimate, chat].flatMap((f) =>
    f ? [{ key: f.key, value: f.value, status: f.status }] : []);
  const payload = eligible.map((f) => {
    const a = getAuthority(f.authorityIds[0]);
    return {
      id: f.id,
      claim: f.risk,
      clauses: [f.anchor.quote, f.secondAnchor?.quote].filter(Boolean),
      authority: { quoted: f.authorityQuote, passage: a?.passage, bangla: a?.passageBn, strength: a?.strength },
      facts: f.riskCategory === "DELIVERY_UNCLEAR" ? reviewFacts.filter((x) => x.key === "delivery_estimate_in_order")
        : f.riskCategory === "SUBSTITUTION_DISPUTE" ? reviewFacts.filter((x) => x.key === "chat_context") : [],
    };
  });
  let status: AgentRun["status"] = "done";
  let note = "no-grounded-findings";

  if (eligible.length && info.enabled) {
    try {
      const out = await llmJson<unknown>(c, {
        system: "Independently check each consumer-dispute finding against its supplied source passages and case facts. " +
          UNTRUSTED_NOTE + " Prefer the Bangla source text when present. Check the actual proposition, scope, and exceptions. " +
          " Mark PASS only when the sources support the claim as framed. Use FLAG_MISGROUNDED for unsupported propositions, " +
          " FLAG_HIERARCHY for misstated legal force, and FLAG_MISSING_EXCEPTION for an omitted condition or exception. " +
          ' Return {"checks":[{"id","verdict","note_en","note_bn"}]}. Include exactly one check per supplied ID.',
        user: JSON.stringify(payload),
      });
      const eligibleIds = new Set(eligible.map((f) => f.id));
      for (const check of Pass2Schema.parse(out).checks) {
        if (!eligibleIds.delete(check.id)) throw new LLMError("unexpected-verdict-id");
        checks.set(check.id, { verdict: check.verdict, note: { en: check.note_en, bn: check.note_bn } });
      }
      if (eligibleIds.size) throw new LLMError("incomplete-verification");
      note = checks.size + " independent checks";
    } catch (error) {
      status = "fallback";
      note = error instanceof LLMError ? error.message : "invalid-output";
      checks.clear();
    }
  } else if (eligible.length) {
    status = "fallback";
    note = "model-disabled";
  }

  const reviewed = next.map((f): Finding => {
    if (!eligible.includes(f)) return { ...f, pass2Verdict: f.pass2Verdict ?? "SKIPPED" };
    const check = checks.get(f.id);
    const verdict = check?.verdict ?? "SKIPPED";
    const result = { ...f, pass2Verdict: verdict, pass2Note: check?.note };
    if (check && verdict !== "PASS") return { ...result, status: "review", statusReason: check.note };
    if (f.riskCategory === "DELIVERY_UNCLEAR" && deliveryEstimate?.status === "confirmed" && deliveryEstimate.value === "yes") {
      return { ...result, status: "review", statusReason: {
        en: "The buyer confirmed a delivery estimate in the order. Compare that estimate with the terms before relying on this finding.",
        bn: "ক্রেতা অর্ডারে ডেলিভারির আনুমানিক সময় নিশ্চিত করেছেন। এই ফলাফলের ওপর নির্ভর করার আগে সেটি শর্তাবলির সঙ্গে মিলিয়ে দেখুন।",
      } };
    }
    if (f.riskCategory === "SUBSTITUTION_DISPUTE" && chat?.status !== "confirmed") {
      return { ...result, status: "disputed_fact_dependent", statusReason: {
        en: "The relevant chat interpretation still needs confirmation.",
        bn: "প্রাসঙ্গিক চ্যাটের ব্যাখ্যা এখনও নিশ্চিত করা প্রয়োজন।",
      } };
    }
    if (verdict === "SKIPPED" && f.origin === "model" && f.status === "verified") {
      return { ...result, status: "review", statusReason: {
        en: "The quotes match. An independent check of the model's interpretation is still needed.",
        bn: "উদ্ধৃতি মিলেছে। মডেলের ব্যাখ্যা এখনও স্বাধীনভাবে যাচাই করা প্রয়োজন।",
      } };
    }
    return result;
  });
  const run: AgentRun = {
    agent: "verify_p2", status, model: checks.size ? info.model : "skipped",
    inputHash: sha(JSON.stringify(payload)), ms: Date.now() - t0, note, at: new Date().toISOString(),
  };
  return { findings: reviewed, run };
}
