import { z } from "zod";
import type { Authority, Bi, CaseRecord, Evidence, Finding, AgentRun } from "../types";
import { llmInfo, llmJson, LLMError, sha, UNTRUSTED_NOTE } from "../llm";
import { findQuotePage, normForMatch } from "../extract";
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
      const lines = p.text
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
  sha(termPages(c).map((p) => p.text).join("|")).slice(0, 12);

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
  if (deliv && !/\d/.test(deliv.quote) && (disp || deliv)) out.push(mk("delivery", disp ?? deliv, disp ? deliv : undefined));

  const coll = findSentence(pages, /we collect.*(phone|contact|name|address)/i);
  const share = findSentence(pages, /(share|disclose).*(contact|details|information).*(partners|third)|promotional offers/i);
  if (share) out.push(mk("marketing", coll ?? share, coll ? share : undefined));

  const adv = findSentence(pages, /manufacturer warranty/i);
  const lim = findSentence(pages, /warranty service is available only|only at the .*repair/i);
  if (adv && lim) out.push(mk("warranty", adv, lim));
  return out;
}

const PAGE = z.preprocess((v) => {
  const n = parseInt(String(v ?? "").match(/\d+/)?.[0] ?? "", 10);
  return Number.isNaN(n) ? undefined : n;
}, z.number().optional());

const ResearchSchema = z.object({
  findings: z
    .array(
      z.object({
        title_en: z.string(),
        title_bn: z.string(),
        risk_en: z.string(),
        risk_bn: z.string(),
        anchor_page: PAGE,
        anchor_quote: z.string(),
        second_page: PAGE,
        second_quote: z.string().nullish(),
        authority_id: z.string(),
        authority_quote: z.string(),
      })
    )
    .max(6),
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
    if (e instanceof LLMError && ["no-key", "network"].includes(e.message)) throw e;
    if (process.env.AINPATH_DEBUG) console.error("[llm-retry]", e instanceof z.ZodError ? JSON.stringify(e.issues.slice(0, 3)) : String(e));
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
  const info = llmInfo();
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

  try {
    const authText = auths.map((a) => `[${a.id}] (${a.textKind}) ${a.passage}`).join("\n");
    const docText = pages.map((p) => `--- page ${p.page} ---\n${p.text}`).join("\n");
    const out = await withRetry(
      (hint) =>
        llmJson<unknown>({
          system: `You are a legal-compliance analyst reviewing a seller's Terms of Sale for Bangladesh. ${UNTRUSTED_NOTE}
Find distinct, grounded compliance RISKS in the terms (not conclusions of breach), at most one per authority, so at most 3 in total. Look for: unclear or missing delivery timeframes, personal data collected for one purpose but used for another, and advertised promises that other clauses limit. Quote only what the terms really say. For each, quote verbatim sentences from the terms (anchor_quote, and second_quote when two clauses conflict) and cite exactly one authority from the list by id, quoting a verbatim phrase from that authority's passage (authority_quote). Never invent quotes or authority ids. Write each title and risk in both English and Bangla (1–2 sentences).
Return JSON: {"findings":[{"title_en","title_bn","risk_en","risk_bn","anchor_page","anchor_quote","second_page","second_quote","authority_id","authority_quote"}]}. ${hint ?? ""}`,
          user: `AUTHORITIES:\n${authText}\n\n<document>\n${docText}\n</document>`,
        }),
      ResearchSchema
    );
    candidates = out.findings.map((f, i) => ({
      id: `F-m${i + 1}`,
      title: { en: f.title_en, bn: f.title_bn || f.title_en },
      risk: { en: f.risk_en, bn: f.risk_bn || f.risk_en },
      anchor: { evidenceId: pages[0].evidenceId, page: f.anchor_page ?? 1, quote: f.anchor_quote },
      secondAnchor: f.second_quote ? { evidenceId: pages[0].evidenceId, page: f.second_page ?? f.anchor_page ?? 1, quote: f.second_quote } : undefined,
      authorityIds: [f.authority_id],
      authorityQuote: f.authority_quote,
      counterpoint: { en: "", bn: "" },
      assumptions: { en: "", bn: "" },
      nextCheck: { en: "", bn: "" },
      status: "unresolved",
      statusReason: { en: "Not yet verified.", bn: "এখনো যাচাই হয়নি।" },
      origin: "model",
    }));
  } catch (e) {
    status = "fallback";
    note = e instanceof LLMError ? e.message : "invalid-output";
  }

  // One finding per authority. The rules detectors quote both conflicting clauses, so they are
  // preferred where they fire; a model finding on the same authority corroborates it. Model-only
  // findings are kept for authorities the detectors do not cover, after verification.
  const byAuth = new Map<string, Finding>();
  for (const b of base) {
    const m = candidates.find((x) => x.authorityIds[0] === b.authorityIds[0]);
    byAuth.set(b.authorityIds[0], m ? { ...b, origin: "both" } : b);
  }
  for (const m of candidates) if (!byAuth.has(m.authorityIds[0])) byAuth.set(m.authorityIds[0], m);
  const all = [...byAuth.values()].slice(0, 4);
  const add = base.filter((b) => !candidates.some((x) => x.authorityIds[0] === b.authorityIds[0]));
  return {
    candidates: all,
    retrieved: auths.map((a) => a.id),
    run: {
      agent: "research",
      status,
      model: status === "fallback" ? "rules" : info.model,
      inputHash: hash,
      ms: Date.now() - t0,
      note: note ?? `model-found:${candidates.length}${add.length ? ` rules-filled:${add.map((a) => a.id).join(",")}` : ""}`,
      at: new Date().toISOString(),
    },
  };
}

export async function runReview(
  findings: Finding[],
  c: CaseRecord
): Promise<{ findings: Finding[]; run: AgentRun }> {
  const t0 = Date.now();
  const info = llmInfo();
  let status: AgentRun["status"] = "done";
  let note: string | undefined;
  const needs = findings;
  const byId = new Map<string, z.infer<typeof ReviewSchema>["reviews"][number]>();

  if (needs.length) {
    try {
      const body = needs
        .map((f) => `id=${f.id}\nrisk: ${f.risk.en}\nclause: "${f.anchor.quote}"${f.secondAnchor ? `\nclause 2: "${f.secondAnchor.quote}"` : ""}\nauthority ${f.authorityIds[0]}: ${getAuthority(f.authorityIds[0])?.passage ?? ""}`)
        .join("\n\n");
      const out = await withRetry(
        (hint) =>
          llmJson<unknown>({
            system: `You are a sceptical reviewer. For each finding, give the strongest counterargument or exception, the assumptions the finding rests on, and the next fact to check. Do not remove the finding. Each field in English and Bangla, one or two sentences. ${UNTRUSTED_NOTE}
Return JSON {"reviews":[{"id","counterpoint_en","counterpoint_bn","assumptions_en","assumptions_bn","next_check_en","next_check_bn"}]}. ${hint ?? ""}`,
            user: `<document>\n${body}\n</document>`,
          }),
        ReviewSchema
      );
      out.reviews.forEach((r) => byId.set(r.id, r));
    } catch (e) {
      status = "fallback";
      note = e instanceof LLMError ? e.message : "invalid-output";
    }
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
  void c;
  return {
    findings: done,
    run: { agent: "review", status, model: status === "fallback" ? "rules" : info.model, inputHash: sha(findings.map((f) => f.id + f.anchor.quote).join()).slice(0, 12), ms: Date.now() - t0, note, at: new Date().toISOString() },
  };
}

function checkAnchor(ev: Evidence[], a: Anchor | undefined, termPagesList: TermPage[]): { ok: boolean; anchor?: Anchor } {
  if (!a) return { ok: true };
  const terms = ev.filter((e) => e.kind === "terms");
  for (const e of terms) {
    const p = findQuotePage(e.pages, a.quote);
    if (p) return { ok: true, anchor: { evidenceId: e.id, page: p, quote: a.quote } };
  }
  void termPagesList;
  return { ok: false };
}

export function runVerify(findings: Finding[], c: CaseRecord): { findings: Finding[]; run: AgentRun } {
  const t0 = Date.now();
  const tp = termPages(c);
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of findings) {
    const reasons: Bi[] = [];
    const a = checkAnchor(c.evidence, f.anchor, tp);
    if (!a.ok) reasons.push({ en: "The quoted clause was not found in the uploaded terms.", bn: "উদ্ধৃত ধারাটি আপলোড করা শর্তাবলিতে পাওয়া যায়নি।" });
    const b = checkAnchor(c.evidence, f.secondAnchor, tp);
    if (!b.ok) reasons.push({ en: "The second quoted clause was not found in the uploaded terms.", bn: "দ্বিতীয় উদ্ধৃত ধারাটি আপলোড করা শর্তাবলিতে পাওয়া যায়নি।" });
    const auth = f.authorityIds[0] ? getAuthority(f.authorityIds[0]) : null;
    if (!auth) reasons.push({ en: "The cited authority does not exist in the pinned corpus.", bn: "উল্লেখিত কর্তৃপক্ষ পিন করা সংগ্রহে নেই।" });
    else if (!normForMatch(auth.passage).includes(normForMatch(f.authorityQuote)) || f.authorityQuote.trim().length < 12)
      reasons.push({ en: "The quoted authority text does not match the pinned passage.", bn: "উদ্ধৃত আইনি অংশ পিন করা অংশের সঙ্গে মেলেনি।" });

    const key = f.authorityIds[0] + "|" + (a.anchor?.quote ?? f.anchor.quote);
    if (seen.has(key)) continue;
    seen.add(key);

    if (reasons.length) {
      out.push({ ...f, status: "unresolved", statusReason: reasons[0] });
    } else {
      const para = auth!.textKind === "paraphrase";
      out.push({
        ...f,
        anchor: a.anchor ?? f.anchor,
        secondAnchor: b.anchor ?? f.secondAnchor,
        status: "verified",
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
