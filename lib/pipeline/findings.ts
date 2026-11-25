import { z } from "zod";
import type { Authority, Bi, CaseRecord, Evidence, Finding, AgentRun } from "../types";
import { llmInfo, llmJson, LLMError, sha, UNTRUSTED_NOTE } from "../llm";
import { normForMatch, usableEvidenceText } from "../extract";
import { allAuthorities, getAuthority, searchAuthorities } from "../db";

export interface TermPage {
  evidenceId: string;
  page: number;
  text: string; // whitespace-collapsed
}

export function termPages(c: CaseRecord): TermPage[] {
  const out: TermPage[] = [];
  for (const e of c.evidence.filter((x) => x.kind === "terms"))
    for (const p of e.pages) {
      const lines = usableEvidenceText(p.text)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !/^page \d+ of \d+$/i.test(l))
        // numbered headings have no full stop; give them one so they don't merge into the next sentence
        .map((l) => (/^\d+\.\s+[^.]+$/.test(l) ? l + "." : l));
      out.push({ evidenceId: e.id, page: p.page, text: lines.join(" ").replace(/\s+/g, " ").trim() });
    }
  return out;
}

export const termsHash = (c: CaseRecord) =>
  sha(JSON.stringify(termPages(c)));

const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

function findSentence(pages: TermPage[], re: RegExp, exclude?: RegExp) {
  for (const p of pages)
    for (const s of sentences(p.text))
      if (re.test(s) && !(exclude && exclude.test(s))) return { evidenceId: p.evidenceId, page: p.page, quote: s };
  return null;
}

type Anchor = { evidenceId: string; page: number; quote: string };

interface Template {
  id: string;
  authorityId: string;
  category: NonNullable<Finding["riskCategory"]>;
  authorityQuote: string;
  title: Bi;
  risk: (a: Anchor, b?: Anchor) => Bi;
  counterpoint: Bi;
  assumptions: Bi;
  nextCheck: Bi;
}

const TEMPLATES: Template[] = [
  {
    id: "delivery",
    category: "DELIVERY_UNCLEAR",
    authorityId: "DCOG-3.1.2",
    authorityQuote: "state their terms clearly to the buyer, including delivery terms and timeframes",
    title: { en: "Delivery timeline is unclear", bn: "ডেলিভারির সময়সীমা স্পষ্ট নয়" },
    risk: (a, b) => ({
      en: `Page ${a.page} promises dispatch within a set time, but ${b ? `page ${b.page}` : "the delivery clause"} gives no time for arrival. A buyer cannot tell when to expect the goods.`,
      bn: `পৃষ্ঠা ${a.page}-এ নির্দিষ্ট সময়ে প্রেরণের কথা আছে, কিন্তু ${b ? `পৃষ্ঠা ${b.page}-এ` : "ডেলিভারি ধারায়"} পৌঁছানোর কোনো সময় নেই। ক্রেতা বুঝতে পারেন না কখন পণ্য পাবেন।`,
    }),
    counterpoint: {
      en: "The order confirmation or checkout page may state a delivery estimate that fills the gap. Dispatch time and arrival time are different promises.",
      bn: "অর্ডার কনফার্মেশন বা চেকআউট পেজে ডেলিভারির আনুমানিক সময় থাকলে ফাঁকটি পূরণ হতে পারে। প্রেরণের সময় ও পৌঁছানোর সময় আলাদা প্রতিশ্রুতি।",
    },
    assumptions: {
      en: "Assumes the uploaded Terms of Sale is the version the buyer saw, and that no estimate appears elsewhere.",
      bn: "ধরে নেওয়া হয়েছে আপলোড করা শর্তাবলিই ক্রেতা দেখেছিলেন এবং অন্য কোথাও কোনো আনুমানিক সময় নেই।",
    },
    nextCheck: {
      en: "Look for a delivery estimate in the order confirmation before deciding how to characterise the risk.",
      bn: "ঝুঁকির ধরন ঠিক করার আগে অর্ডার কনফার্মেশনে ডেলিভারির আনুমানিক সময় আছে কি না দেখুন।",
    },
  },
  {
    id: "marketing",
    category: "PRIVACY_CONSENT",
    authorityId: "DCOG-3.1.7",
    authorityQuote: "must obtain prior permission and must state why the information is collected",
    title: { en: "Marketing reuse of contact details is unclear", bn: "যোগাযোগের তথ্য প্রচারে ব্যবহার অস্পষ্ট" },
    risk: (a, b) => ({
      en: `Page ${a.page} says contact details are collected for delivery. ${b ? `Page ${b.page}` : "Another clause"} lets unspecified partners send promotions. The reason given for collection does not cover that use.`,
      bn: `পৃষ্ঠা ${a.page}-এ বলা আছে ডেলিভারির জন্য যোগাযোগের তথ্য নেওয়া হয়। ${b ? `পৃষ্ঠা ${b.page}-এ` : "অন্য একটি ধারায়"} অনির্দিষ্ট অংশীদারদের প্রচার পাঠানোর অনুমতি আছে। সংগ্রহের উল্লিখিত কারণ সেই ব্যবহারকে কভার করে না।`,
    }),
    counterpoint: {
      en: "Checkout may have shown an opt-in the buyer ticked. Prior permission can be given outside the Terms document.",
      bn: "চেকআউটে ক্রেতার টিক দেওয়া কোনো সম্মতি থাকতে পারে। শর্তাবলির বাইরেও পূর্ব অনুমতি দেওয়া যায়।",
    },
    assumptions: {
      en: "Assumes no separate consent screen exists, and that the 'partners' are third parties.",
      bn: "ধরে নেওয়া হয়েছে আলাদা কোনো সম্মতির স্ক্রিন নেই এবং ‘অংশীদার’ তৃতীয় পক্ষ।",
    },
    nextCheck: {
      en: "Review the checkout consent wording and what buyers saw at the point of agreement.",
      bn: "চেকআউটের সম্মতির ভাষা এবং সম্মতির সময় ক্রেতারা কী দেখেছেন তা পর্যালোচনা করুন।",
    },
  },
  {
    id: "warranty",
    category: "WARRANTY_CONFLICT",
    authorityId: "CRPA-44",
    authorityQuote: "deceives any buyer by any false or untrue advertisement",
    title: { en: "Warranty representations conflict", bn: "ওয়ারেন্টি সংক্রান্ত বক্তব্যে অসঙ্গতি" },
    risk: (a, b) => ({
      en: `Page ${a.page} advertises manufacturer warranty. ${b ? `Page ${b.page}` : "Another clause"} limits servicing to the seller's own repair desk. A buyer may read the first as broader than the second allows.`,
      bn: `পৃষ্ঠা ${a.page}-এ প্রস্তুতকারকের ওয়ারেন্টির বিজ্ঞাপন আছে। ${b ? `পৃষ্ঠা ${b.page}-এ` : "অন্য একটি ধারায়"} সার্ভিস শুধু বিক্রেতার নিজস্ব রিপেয়ার ডেস্কে সীমিত। ক্রেতা প্রথমটিকে দ্বিতীয়টির চেয়ে বিস্তৃত ভাবতে পারেন।`,
    }),
    counterpoint: {
      en: "Manufacturer documentation may show the seller's desk is an authorised service point, which would reconcile the clauses. A misleading statement has to be shown on the facts; this is a risk flag only.",
      bn: "প্রস্তুতকারকের নথিতে বিক্রেতার ডেস্ক অনুমোদিত সার্ভিস পয়েন্ট প্রমাণিত হলে ধারাগুলো মেলানো যায়। বিভ্রান্তিকর বক্তব্য তথ্য দিয়ে প্রমাণ করতে হয়; এটি শুধু ঝুঁকির সংকেত।",
    },
    assumptions: {
      en: "Assumes the advertisement and the Terms were both presented to the buyer, and that the manufacturer does not authorise the repair desk.",
      bn: "ধরে নেওয়া হয়েছে বিজ্ঞাপন ও শর্তাবলি দুটোই ক্রেতাকে দেখানো হয়েছিল এবং প্রস্তুতকারক রিপেয়ার ডেস্ককে অনুমোদন দেয়নি।",
    },
    nextCheck: {
      en: "Obtain the manufacturer's warranty document. Keep this as a risk requiring factual review.",
      bn: "প্রস্তুতকারকের ওয়ারেন্টি নথি সংগ্রহ করুন। এটিকে তথ্যগত পর্যালোচনার ঝুঁকি হিসেবে রাখুন।",
    },
  },
];

const tpl = (id: string) => TEMPLATES.find((t) => t.id === id)!;

/** Deterministic detectors. They quote the document verbatim, so they are verifiable. */
export function baselineFindings(c: CaseRecord): Finding[] {
  const pages = termPages(c);
  const out: Finding[] = [];
  const mk = (id: string, a: Anchor, b?: Anchor): Finding => {
    const t = tpl(id);
    return {
      id: `F-${id}`,
      title: t.title,
      risk: t.risk(a, b),
      riskCategory: t.category,
      anchor: a,
      secondAnchor: b ?? undefined,
      authorityIds: [t.authorityId],
      authorityQuote: t.authorityQuote,
      counterpoint: t.counterpoint,
      assumptions: t.assumptions,
      nextCheck: t.nextCheck,
      status: "unresolved",
      statusReason: { en: "Not yet verified.", bn: "এখনো যাচাই হয়নি।" },
      origin: "rules",
    };
  };

  const disp = findSentence(pages, /dispatch.*within|within.*\bdays?\b/i);
  const deliv = findSentence(pages, /delivery time depends|delivered through|courier/i);
  if (disp && deliv && disp.quote !== deliv.quote && !/\d/.test(deliv.quote)) out.push(mk("delivery", disp, deliv));

  const coll = findSentence(pages, /we collect.*(phone|contact|name|address)/i);
  const share = findSentence(pages, /(share|disclose).*(contact|details|information).*(partners|third)|promotional offers/i);
  if (coll && share && coll.quote !== share.quote) out.push(mk("marketing", coll, share));

  const adv = findSentence(pages, /manufacturer warranty/i);
  const lim = findSentence(pages, /warranty service is available only|only at the .*repair/i);
  if (adv && lim) out.push(mk("warranty", adv, lim));
  return out;
}

const SourceQuote = z.object({
  evidence_id: z.string(),
  page: z.coerce.number().int().positive(),
  quote: z.string().trim().min(12).max(700),
});

const ResearchSchema = z.object({
  findings: z.array(z.object({
    title_en: z.string().trim().min(1).max(160),
    title_bn: z.string().trim().min(1).max(160),
    risk_en: z.string().trim().min(1).max(650),
    risk_bn: z.string().trim().min(1).max(650),
    anchor: SourceQuote,
    second_anchor: SourceQuote.nullish(),
    authority_id: z.string(),
    authority_quote: z.string().trim().min(12).max(350),
  })).max(6),
});

const ReviewSchema = z.object({
  reviews: z.array(
    z.object({
      id: z.string(),
      counterpoint_en: z.string(),
      counterpoint_bn: z.string(),
      assumptions_en: z.string(),
      assumptions_bn: z.string(),
      next_check_en: z.string(),
      next_check_bn: z.string(),
    })
  ),
});

async function withRetry<T>(call: (hint?: string) => Promise<unknown>, schema: z.ZodType<T>): Promise<T> {
  try {
    return schema.parse(await call());
  } catch (e) {
    if (e instanceof LLMError && e.message !== "bad-json") throw e;
    // one structured retry, with the failure named
    return schema.parse(await call("Your previous output was invalid JSON for the required schema. Return only the schema."));
  }
}

function retrieve(c: CaseRecord): Authority[] {
  const text = termPages(c).map((p) => p.text).join(" ");
  const hits = searchAuthorities(
    `${text.slice(0, 1500)} delivery warranty advertisement personal information promotional`
  );
  const ids = new Set(hits.map((h) => h.id));
  for (const a of allAuthorities()) if (a.scope === "terms") ids.add(a.id);
  return [...ids].map((id) => getAuthority(id)).filter((a): a is Authority => !!a && a.scope === "terms");
}

export interface ResearchOut {
  candidates: Finding[];
  run: AgentRun;
  retrieved: string[];
}

export async function runResearch(c: CaseRecord): Promise<ResearchOut> {
  const t0 = Date.now();
  const pages = termPages(c);
  const auths = retrieve(c);
  const base = baselineFindings(c);
  const info = llmInfo(c);
  const hash = termsHash(c);
  let candidates: Finding[] = [];
  let status: AgentRun["status"] = "done";
  let note: string | undefined;

  if (!pages.length) {
    return {
      candidates: [],
      retrieved: auths.map((a) => a.id),
      run: { agent: "research", status: "done", model: "none", inputHash: hash, ms: 0, note: "no-terms", at: new Date().toISOString() },
    };
  }

  if (info.enabled) {
    try {
      const authText = auths.map((a) => ({ id: a.id, textKind: a.textKind, passage: a.passage }));
      const excerpts: { evidence_id: string; page: number; text: string }[] = [];
      let remaining = 32_000;
      for (const p of pages) {
        if (remaining <= 0) break;
        const text = p.text.slice(0, Math.min(3500, remaining));
        remaining -= text.length;
        excerpts.push({ evidence_id: p.evidenceId, page: p.page, text });
      }
      const out = await withRetry(
        (hint) => llmJson<unknown>(c, {
          system: "Review online-shopping terms for possible delivery, privacy and warranty risks in Bangladesh. " +
            UNTRUSTED_NOTE + " Distinguish possible risks from legal conclusions. " +
            " Cite only the supplied authorities and quote both policy passages and uploaded clauses verbatim. " +
            " Locate each quote by exact evidence_id and page. Include a second anchor for conflicting clauses. " +
            ' Return {"findings":[{"title_en","title_bn","risk_en","risk_bn","anchor":{"evidence_id","page","quote"},' +
            '"second_anchor":{"evidence_id","page","quote"} or null,"authority_id","authority_quote"}]}. ' + (hint ?? ""),
          user: JSON.stringify({ authorities: authText, evidence: excerpts }),
          timeoutMs: 7_000,
        }),
        ResearchSchema,
      );
      const toAnchor = (a: z.infer<typeof SourceQuote>): Anchor => ({ evidenceId: a.evidence_id, page: a.page, quote: a.quote });
      candidates = out.findings.flatMap((f): Finding[] => {
        const a = auths.find((authority) => authority.id === f.authority_id);
        const anchor = toAnchor(f.anchor);
        const second = f.second_anchor ? toAnchor(f.second_anchor) : undefined;
        if (!a || normForMatch(f.authority_quote).length < 12 || !normForMatch(a.passage).includes(normForMatch(f.authority_quote)) ||
          !checkAnchor(c.evidence, anchor) || (second && !checkAnchor(c.evidence, second))) return [];
        return [{
          id: "F-" + a.id,
          title: { en: f.title_en, bn: f.title_bn },
          risk: { en: f.risk_en, bn: f.risk_bn },
          anchor,
          secondAnchor: second,
          authorityIds: [a.id],
          authorityQuote: f.authority_quote,
          counterpoint: { en: "", bn: "" },
          assumptions: { en: "", bn: "" },
          nextCheck: { en: "", bn: "" },
          status: "unresolved",
          statusReason: { en: "Not yet verified.", bn: "এখনো যাচাই হয়নি।" },
          origin: "model",
        }];
      });
      note = candidates.length + " grounded model candidates of " + out.findings.length;
    } catch (e) {
      status = "fallback";
      note = e instanceof LLMError ? e.message : "invalid-output";
    }
  } else {
    status = "fallback";
    note = "model-disabled";
  }

  const byAuth = new Map<string, Finding>();
  for (const b of base) {
    const m = candidates.find((candidate) => candidate.authorityIds[0] === b.authorityIds[0] &&
      candidate.anchor.evidenceId === b.anchor.evidenceId && candidate.anchor.page === b.anchor.page &&
      normForMatch(candidate.anchor.quote) === normForMatch(b.anchor.quote));
    byAuth.set(b.authorityIds[0], m ? { ...b, origin: "both" } : b);
  }
  for (const m of candidates) if (!byAuth.has(m.authorityIds[0])) byAuth.set(m.authorityIds[0], m);
  const all = [...byAuth.values()].slice(0, 4);
  return {
    candidates: all,
    retrieved: auths.map((a) => a.id),
    run: {
      agent: "research",
      status,
      model: status === "fallback" ? "rules" : info.model,
      inputHash: hash,
      ms: Date.now() - t0,
      note,
      at: new Date().toISOString(),
    },
  };
}

export async function runReview(
  findings: Finding[],
  c: CaseRecord
): Promise<{ findings: Finding[]; run: AgentRun }> {
  const t0 = Date.now();
  const info = llmInfo(c);
  let status: AgentRun["status"] = "done";
  let note: string | undefined;
  const needs = findings;
  const byId = new Map<string, z.infer<typeof ReviewSchema>["reviews"][number]>();

  if (needs.length && info.enabled) {
    try {
      const body = needs.map((f) => ({
        id: f.id,
        risk: f.risk.en,
        clauses: [f.anchor.quote, f.secondAnchor?.quote].filter(Boolean),
        authority: getAuthority(f.authorityIds[0])?.passage,
      }));
      const out = await withRetry(
        (hint) =>
          llmJson<unknown>(c, {
            system: `You are a sceptical reviewer. For each finding, give the strongest counterargument or exception, the assumptions the finding rests on, and the next fact to check. Do not remove the finding. Each field in English and Bangla, one or two sentences. ${UNTRUSTED_NOTE}
Return JSON {"reviews":[{"id","counterpoint_en","counterpoint_bn","assumptions_en","assumptions_bn","next_check_en","next_check_bn"}]}. ${hint ?? ""}`,
            user: JSON.stringify(body),
            timeoutMs: 7_000,
          }),
        ReviewSchema
      );
      out.reviews.forEach((r) => byId.set(r.id, r));
      if (needs.some((f) => !byId.has(f.id))) {
        status = "fallback";
        note = "incomplete-review";
      }
    } catch (e) {
      status = "fallback";
      note = e instanceof LLMError ? e.message : "invalid-output";
    }
  }

  if (needs.length && !info.enabled) {
    status = "fallback";
    note = "model-disabled";
  }

  const done = findings.map((f) => {
    const r = byId.get(f.id);
    if (r)
      return {
        ...f,
        counterpoint: { en: r.counterpoint_en, bn: r.counterpoint_bn || r.counterpoint_en },
        assumptions: { en: r.assumptions_en, bn: r.assumptions_bn || r.assumptions_en },
        nextCheck: { en: r.next_check_en, bn: r.next_check_bn || r.next_check_en },
      };
    if (!f.counterpoint.en) {
      // fall back to the template matching this authority
      const t = TEMPLATES.find((x) => x.authorityId === f.authorityIds[0]);
      return t
        ? { ...f, counterpoint: t.counterpoint, assumptions: t.assumptions, nextCheck: t.nextCheck }
        : {
            ...f,
            counterpoint: { en: "No counterargument was generated; a reviewer should supply one.", bn: "কোনো পাল্টা যুক্তি তৈরি হয়নি; পর্যালোচককে দিতে হবে।" },
            assumptions: { en: "Not stated.", bn: "উল্লেখ নেই।" },
            nextCheck: { en: "Reviewer to determine.", bn: "পর্যালোচক ঠিক করবেন।" },
          };
    }
    return f;
  });
  return {
    findings: done,
    run: { agent: "review", status, model: status === "fallback" ? "rules" : info.model, inputHash: sha(findings.map((f) => f.id + f.anchor.quote).join()).slice(0, 12), ms: Date.now() - t0, note, at: new Date().toISOString() },
  };
}

function checkAnchor(ev: Evidence[], anchor: Anchor): boolean {
  const evidence = ev.find((e) => e.kind === "terms" && e.id === anchor.evidenceId);
  const page = evidence?.pages.find((p) => p.page === anchor.page);
  const quote = normForMatch(anchor.quote);
  return !!page && quote.length >= 12 && normForMatch(usableEvidenceText(page.text)).includes(quote);
}

export function runVerify(findings: Finding[], c: CaseRecord): { findings: Finding[]; run: AgentRun } {
  const t0 = Date.now();
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of findings) {
    const reasons: Bi[] = [];
    const a = checkAnchor(c.evidence, f.anchor);
    if (!a) reasons.push({ en: "The quoted clause was not found in the uploaded terms.", bn: "উদ্ধৃত ধারাটি আপলোড করা শর্তাবলিতে পাওয়া যায়নি।" });
    const b = !f.secondAnchor || checkAnchor(c.evidence, f.secondAnchor);
    if (!b) reasons.push({ en: "The second quoted clause was not found in the uploaded terms.", bn: "দ্বিতীয় উদ্ধৃত ধারাটি আপলোড করা শর্তাবলিতে পাওয়া যায়নি।" });
    const auth = f.authorityIds[0] ? getAuthority(f.authorityIds[0]) : null;
    if (!auth) reasons.push({ en: "The cited authority does not exist in the pinned corpus.", bn: "উল্লেখিত কর্তৃপক্ষ পিন করা সংগ্রহে নেই।" });
    else if (!normForMatch(auth.passage).includes(normForMatch(f.authorityQuote)) || normForMatch(f.authorityQuote).length < 12)
      reasons.push({ en: "The quoted authority text does not match the pinned passage.", bn: "উদ্ধৃত আইনি অংশ পিন করা অংশের সঙ্গে মেলেনি।" });

    const key = f.authorityIds[0] + "|" + normForMatch(f.anchor.quote);
    if (seen.has(key)) continue;
    seen.add(key);

    if (reasons.length) {
      out.push({ ...f, status: "unresolved", statusReason: reasons[0] });
    } else {
      const para = auth!.textKind === "paraphrase" || !!auth!.verifyRequired;
      out.push({
        ...f,
        status: para ? "review" : "verified",
        statusReason: para
          ? { en: "Quote and page match the uploaded terms. The authority text is a paraphrase; a reviewer should check it against the official source.", bn: "উদ্ধৃতি ও পৃষ্ঠা আপলোড করা শর্তাবলির সঙ্গে মিলেছে। আইনি অংশটি সারসংক্ষেপ; পর্যালোচক সরকারি উৎসের সঙ্গে মিলিয়ে নেবেন।" }
          : { en: "Quote and page match the uploaded terms, and the authority quote matches the pinned official text.", bn: "উদ্ধৃতি ও পৃষ্ঠা আপলোড করা শর্তাবলির সঙ্গে মিলেছে এবং আইনি উদ্ধৃতি পিন করা সরকারি পাঠের সঙ্গে মিলেছে।" },
      });
    }
  }
  // order: verified first, then by page of anchor
  out.sort((x, y) => (x.status === y.status ? x.anchor.page - y.anchor.page : x.status === "verified" ? -1 : 1));
  return {
    findings: out,
    run: { agent: "verify", status: "done", model: "citation-checker", inputHash: sha(findings.map((f) => f.id).join()).slice(0, 12), ms: Date.now() - t0, at: new Date().toISOString() },
  };
}
