/**
 * Independent Pass-2 mis-grounding / entailment check (plan §9).
 * Fresh Groq call — no upstream chain-of-thought. Falls back to SKIPPED without LLM.
 */
import { z } from "zod";
import type { AgentRun, Bi, CaseRecord, Finding, Pass2Verdict } from "../types";
import { llmInfo, llmJson, LLMError, sha, UNTRUSTED_NOTE } from "../llm";
import { getAuthority } from "../db";
import { applyHierarchyToFinding } from "../engines/hierarchy";
import { allAuthorities } from "../db";
import { redactPii } from "../pii";

const Pass2Schema = z.object({
  checks: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(["PASS", "FLAG_MISGROUNDED", "FLAG_HIERARCHY", "FLAG_MISSING_EXCEPTION"]),
      note_en: z.string(),
      note_bn: z.string().optional(),
    })
  ),
});

function disputedDependent(c: CaseRecord, f: Finding): boolean {
  // Substitution / chat-dependent findings should not stay VERIFIED if chat disputed
  const chat = c.facts.find((x) => x.key === "chat_context");
  if (chat && (chat.status === "disputed" || chat.status === "candidate") && /substitut|warranty|delivery/i.test(f.id + f.title.en))
    return true;
  return c.facts.some((x) => x.status === "disputed" && f.risk.en.toLowerCase().includes(x.key.replace(/_/g, " ")));
}

export async function runVerifyPass2(
  findings: Finding[],
  c: CaseRecord
): Promise<{ findings: Finding[]; run: AgentRun }> {
  const t0 = Date.now();
  const info = llmInfo();
  const auths = allAuthorities();
  let status: AgentRun["status"] = "done";
  let note: string | undefined;
  const byId = new Map<string, { verdict: Pass2Verdict; note: Bi }>();

  // Hierarchy first (deterministic)
  let next = findings.map((f) => applyHierarchyToFinding(f, auths));

  if (info.enabled && next.length) {
    try {
      const body = next
        .map((f) => {
          const a = getAuthority(f.authorityIds[0]);
          return redactPii(
            `id=${f.id}\nclaim: ${f.risk.en}\nquoted_authority: ${f.authorityQuote}\nauthority_full: ${a?.passage ?? ""}\nauthority_strength: ${a?.strength ?? a?.type}\nfacts: ${c.facts.map((x) => `${x.key}=${x.value}(${x.status})`).join("; ")}`
          );
        })
        .join("\n\n---\n\n");

      const out = await llmJson<unknown>({
        system: `You are an independent legal entailment checker for Bangladesh consumer disputes. You have NOT seen any prior agent reasoning. ${UNTRUSTED_NOTE}
For each finding, decide if the pinned authority passage actually supports the claim (not just topic overlap).
- PASS: passage substantively supports the claim and no obvious omitted exception.
- FLAG_MISGROUNDED: real section cited for the wrong legal proposition (e.g. s.44 false ad when issue is non-delivery → s.45).
- FLAG_HIERARCHY: GUIDELINE or PLATFORM_POLICY framed as criminal statute.
- FLAG_MISSING_EXCEPTION: claim ignores a clear exception in the authority text.
Return JSON {"checks":[{"id","verdict","note_en","note_bn"}]}.`,
        user: body,
      });
      const parsed = Pass2Schema.parse(out);
      for (const ch of parsed.checks) {
        byId.set(ch.id, {
          verdict: ch.verdict,
          note: { en: ch.note_en, bn: ch.note_bn || ch.note_en },
        });
      }
    } catch (e) {
      status = "fallback";
      note = e instanceof LLMError ? e.message : "pass2-invalid";
    }
  } else {
    status = info.enabled ? "done" : "fallback";
    note = info.enabled ? undefined : "no-llm — pass2 skipped";
  }

  next = next.map((f) => {
    if (f.pass2Verdict === "FLAG_HIERARCHY") return f; // already set by hierarchy
    const ch = byId.get(f.id);
    const verdict: Pass2Verdict = ch?.verdict ?? "SKIPPED";
    let statusF = f.status;
    let statusReason = f.statusReason;
    const pass2Note = ch?.note;

    if (verdict === "FLAG_MISGROUNDED" || verdict === "FLAG_MISSING_EXCEPTION" || verdict === "FLAG_HIERARCHY") {
      statusF = "review";
      statusReason = pass2Note ?? {
        en: `Pass 2 flagged ${verdict}.`,
        bn: `পাস ২ ${verdict} চিহ্নিত করেছে।`,
      };
    } else if (verdict === "PASS" && statusF === "verified" && disputedDependent(c, f)) {
      statusF = "disputed_fact_dependent";
      statusReason = {
        en: "Legal checks passed but a dependent fact is disputed — not marked verified.",
        bn: "আইনি যাচাই পাস, কিন্তু নির্ভরশীল তথ্য বিতর্কিত — verified নয়।",
      };
    }

    return { ...f, pass2Verdict: verdict, pass2Note, status: statusF, statusReason };
  });

  return {
    findings: next,
    run: {
      agent: "verify_p2",
      status,
      model: status === "fallback" ? "skipped" : info.model,
      inputHash: sha(findings.map((f) => f.id + f.authorityQuote).join()).slice(0, 12),
      ms: Date.now() - t0,
      note,
      at: new Date().toISOString(),
    },
  };
}
