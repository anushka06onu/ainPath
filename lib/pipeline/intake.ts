import { z } from "zod";
import type { AgentRun, CaseRecord, Evidence, Fact, FactKey, IntakeCandidate } from "../types";
import { llmInfo, llmJson, LLMError, modelFingerprint, sha, UNTRUSTED_NOTE } from "../llm";
import { isCalendarDate, normForMatch, normalizeDigits, usableEvidenceText } from "../extract";

export const FACT_KEYS: FactKey[] = [
  "item_ordered",
  "item_received",
  "seller",
  "order_date",
  "delivery_date",
  "rejection_reason",
  "prior_action",
  "has_receipt",
  "chat_context",
  "delivery_estimate_in_order",
];

const DATE_KEYS: FactKey[] = ["order_date", "delivery_date"];
export type ChatContext = "address_confirmation" | "substitution_approval" | "unclear" | "none";

export function classifyChat(text: string): ChatContext {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\[[^\]]*\]\s*/, "").trim());
  const speaker = /^([^:]{1,60}):\s*(.+)/u;
  const buyer = /^(buyer|customer|ক্রেতা)$/iu;
  const affirmative = /^(yes|yeah|yep|ok|okay|sure|confirm(?:ed)?|হ্যাঁ|জি|ঠিক আছে|হুম|hya|hae|thik ache)(?=$|[\s.,!?।])/iu;
  const substitution = /substitut|instead|out of stock|alternative|বিকল্প|স্টকে নেই|bodole|onno model/i;
  const address = /address|ঠিকানা|thikana/i;
  let sawAff = false;
  let context: ChatContext = "none";
  let previous = "";
  for (const line of lines) {
    const turn = line.match(speaker);
    if (!turn) continue;
    if (!buyer.test(turn[1].trim())) {
      previous = turn[2];
      continue;
    }
    if (affirmative.test(turn[2])) {
      sawAff = true;
      const sub = substitution.test(previous);
      const addr = address.test(previous);
      if (sub && addr) return "unclear";
      const next = sub ? "substitution_approval" : addr ? "address_confirmation" : "none";
      if (next !== "none" && context !== "none" && next !== context) return "unclear";
      if (next !== "none") context = next;
    }
    previous = "";
  }
  if (context !== "none") return context;
  return sawAff ? "unclear" : "none";
}

const firstMatch = (t: string, re: RegExp) => t.match(re)?.[1]?.trim();
const joined = (ev: Evidence[], kinds: Evidence["kind"][]) =>
  ev
    .filter((e) => kinds.includes(e.kind))
    .map((e) => e.pages.map((p) => usableEvidenceText(p.text)).join("\n"))
    .join("\n");
const ids = (ev: Evidence[], kinds: Evidence["kind"][]) =>
  ev.filter((e) => kinds.includes(e.kind)).map((e) => e.id);

type Cand = IntakeCandidate;

export function docFacts(c: CaseRecord): Partial<Record<FactKey, Cand>> {
  const ev = c.evidence;
  const out: Partial<Record<FactKey, Cand>> = {};
  const order = normalizeDigits(joined(ev, ["order"]));
  const delivery = normalizeDigits(joined(ev, ["delivery"]));
  const deliveryDates = ev.filter((e) => e.kind === "delivery").flatMap((e) =>
    [...normalizeDigits(joined([e], ["delivery"])).matchAll(/(?:Delivered|Delivery date|ডেলিভারির তারিখ|বিতরণের তারিখ)\s*[:：]\s*(\d{4}-\d{2}-\d{2})/giu)]
      .filter((m) => isCalendarDate(m[1])).map((m) => ({ value: m[1], evidenceIds: [e.id] }))
  );
  const rej = joined(ev, ["rejection"]);
  const chat = joined(ev, ["chat"]);

  const put = (k: FactKey, v: string | undefined, kinds: Evidence["kind"][]) => {
    if (v) out[k] = { value: v, evidenceIds: ids(ev, kinds) };
  };
  put("item_ordered", firstMatch(order, /(?:Item ordered|অর্ডার করা পণ্য)[ \t]*[:：][ \t]*(.+)/iu), ["order"]);
  put("seller", firstMatch(order, /(?:Seller|বিক্রেতা)[ \t]*[:：][ \t]*(.+)/iu), ["order"]);
  const orderDate = firstMatch(order, /(?:Order date|অর্ডারের তারিখ)\s*[:：]\s*(\d{4}-\d{2}-\d{2})/iu);
  if (orderDate && isCalendarDate(orderDate)) put("order_date", orderDate, ["order"]);
  put("item_received", firstMatch(delivery, /(?:Item delivered|প্রাপ্ত পণ্য)[ \t]*[:：][ \t]*(.+)/iu), ["delivery"]);
  out.delivery_date = deliveryDates[0];
  out.delivery_date_alt = deliveryDates.find((d) => d.value !== deliveryDates[0].value);

  if (rej.trim()) {
    const reason = firstMatch(rej, /Reason:\s*(.+)/i) ?? rej;
    const cat = /substitut|বিকল্প/i.test(reason)
      ? "substitute_approved"
      : /as described|description/i.test(reason)
        ? "item_as_described"
        : /window|expired|days/i.test(reason)
          ? "outside_window"
          : "other";
    out.rejection_reason = { value: cat, evidenceIds: ids(ev, ["rejection"]) };
    out.prior_action = { value: "platform_return_rejected", evidenceIds: ids(ev, ["rejection"]) };
  }
  if (chat.trim()) {
    const contexts = ev.filter((e) => e.kind === "chat")
      .map((e) => ({ id: e.id, context: classifyChat(joined([e], ["chat"])) }))
      .filter((entry) => entry.context !== "none");
    const unique = new Set(contexts.map((entry) => entry.context));
    out.chat_context = { value: unique.size > 1 ? "unclear" : contexts[0]?.context ?? "none", evidenceIds: contexts.map((entry) => entry.id) };
  }

  const hasReceipt =
    ev.some((e) => e.kind === "receipt") || (c.channel === "daraz" && ev.some((e) => e.kind === "order"));
  if (ev.length) out.has_receipt = { value: hasReceipt ? "yes" : "no", evidenceIds: ids(ev, ["receipt", "order"]) };

  if (order.trim()) {
    const has = /(estimated|expected) delivery|deliver(y|ed) by|delivery date/i.test(order);
    out.delivery_estimate_in_order = { value: has ? "yes" : "no", evidenceIds: ids(ev, ["order"]) };
  }
  return out;
}

const ENUMS: Partial<Record<FactKey, string[]>> = {
  rejection_reason: ["substitute_approved", "item_as_described", "outside_window", "other", "none"],
  prior_action: ["none", "platform_return_rejected", "platform_return_pending", "seller_contacted"],
  has_receipt: ["yes", "no"],
  chat_context: ["address_confirmation", "substitution_approval", "unclear", "none"],
  delivery_estimate_in_order: ["yes", "no"],
};

const IntakeSchema = z.object({
  facts: z.array(z.object({
    key: z.string(),
    value: z.string().trim().min(1).max(300),
    source: z.string().max(40),
    quote: z.string().trim().min(5).max(500),
  })).max(20),
});

function storyFallback(story: string): Record<string, string> {
  const o: Record<string, string> = {};
  const models = [...new Set([...story.matchAll(/model\s+([A-Za-z0-9]+)/gi)].map((m) => m[1].toUpperCase()))];
  if (models.length === 2) {
    o.item_ordered = `Model ${models[0]}`;
    o.item_received = `Model ${models[1]}`;
  }
  const seller = story.match(/(?:from|থেকে)\s+([A-Z][\w ]{2,24}?)(?:\s+(?:on|and|এ|এবং)|[,.]|\s+[\u0980-\u09FF])/);
  if (seller) o.seller = seller[1].trim();
  if (/reject|declin|বাতিল|প্রত্যাখ্যান/i.test(story)) o.prior_action = "platform_return_rejected";
  if (/substitut|বিকল্প/i.test(story) && o.prior_action) o.rejection_reason = "substitute_approved";
  if (/no receipt|রসিদ নেই|কোনো রসিদ/i.test(story)) o.has_receipt = "no";
  return o;
}

async function modelCandidates(c: CaseRecord) {
  const sources = [
    { id: "story", text: usableEvidenceText(c.story), evidenceIds: [] as string[] },
    ...c.evidence.filter((e) => e.kind !== "terms").flatMap((e) =>
      e.pages.map((p) => ({
        id: e.id + ":" + p.page,
        kind: e.kind,
        text: usableEvidenceText(p.text).slice(0, 1800),
        evidenceIds: [e.id],
      }))),
  ].filter((source) => source.text.trim()).slice(0, 16);
  const hash = sha(JSON.stringify(["intake-v2", modelFingerprint(c), sources]));
  const previous = c.pipelineCache?.intake;
  if (previous?.hash === hash) return { ...previous, reused: true };

  const t0 = Date.now();
  const info = llmInfo(c);
  const candidates: Partial<Record<FactKey, Cand>> = {};
  let note = sources.length ? "model-disabled" : "no-source-text";
  let usedModel = false;
  let reusable = !info.enabled || !sources.length;

  if (info.enabled && sources.length) {
    try {
      const raw = await llmJson<unknown>(c, {
        system: "Extract explicitly stated facts from an online-shopping dispute. Understand English, Bangla, and romanized Bangla. " + UNTRUSTED_NOTE +
          " Output {\"facts\":[{\"key\",\"value\",\"source\",\"quote\"}]}. Quote a verbatim line from that exact source. " +
          " Omit unmentioned values. Use YYYY-MM-DD only for unambiguous dates. Allowed keys: " + FACT_KEYS.join(", ") +
          ". Allowed enum values: " + JSON.stringify(ENUMS) + ". Do not interpret an address confirmation as substitution approval.",
        user: JSON.stringify(sources.map(({ id, text, ...rest }) => ({ id, text, kind: "kind" in rest ? rest.kind : "story" }))),
      });
      for (const fact of IntakeSchema.parse(raw).facts) {
        if (!FACT_KEYS.includes(fact.key as FactKey)) continue;
        const key = fact.key as FactKey;
        const source = sources.find((entry) => entry.id === fact.source);
        const quote = normForMatch(fact.quote);
        if (!source || !quote || !normForMatch(source.text).includes(quote)) continue;
        const value = normalizeDigits(fact.value);
        const allowed = ENUMS[key];
        if (allowed && !allowed.includes(value)) continue;
        if (DATE_KEYS.includes(key) && (!isCalendarDate(value) || !quote.includes(value))) continue;
        if (!allowed && !DATE_KEYS.includes(key) && !quote.includes(normForMatch(value))) continue;
        const old = candidates[key];
        if (old && old.evidenceIds.length >= source.evidenceIds.length) continue;
        candidates[key] = { value, evidenceIds: source.evidenceIds };
      }
      usedModel = Object.keys(candidates).length > 0;
      reusable = true;
      note = Object.keys(candidates).length + " source-backed model candidates";
    } catch (e) {
      note = e instanceof LLMError ? e.message : "invalid-output";
    }
  }

  for (const [key, value] of Object.entries(storyFallback(usableEvidenceText(c.story)))) {
    candidates[key as FactKey] ??= { value, evidenceIds: [] };
  }
  const run: AgentRun = {
    agent: "intake",
    status: usedModel ? "done" : "fallback",
    model: usedModel ? info.model : "rules",
    inputHash: hash,
    ms: Date.now() - t0,
    note,
    at: new Date().toISOString(),
  };
  if (reusable) (c.pipelineCache ??= {}).intake = { hash, candidates, run };
  return { hash, candidates, run, reused: false };
}

export async function runIntake(c: CaseRecord): Promise<{ facts: Fact[]; run: AgentRun; reused: boolean }> {
  const intake = await modelCandidates(c);
  const docs = docFacts(c);
  const previous = new Map(c.facts.map((f) => [f.key, f]));
  const facts: Fact[] = [];
  for (const key of FACT_KEYS) {
    const old = previous.get(key);
    const model = intake.candidates[key];
    const doc = docs[key];
    const candidate = doc?.value === "none" && key === "chat_context" && model?.evidenceIds.length
      ? model : doc ?? model;
    if (old?.source === "user") {
      facts.push({ ...old });
    } else if (candidate) {
      const same = old?.value === candidate.value;
      facts.push({
        key, value: candidate.value, status: same && old ? old.status : "candidate",
        evidenceIds: candidate.evidenceIds, source: candidate === doc ? "document" : "model",
      });
    } else if (old && ["disputed", "unreadable"].includes(old.status)) {
      facts.push({ ...old });
    } else {
      facts.push({ key, value: "", status: "candidate", evidenceIds: [], source: "model" });
    }
  }

  const delivery = facts.find((f) => f.key === "delivery_date")!;
  const savedAlt = previous.get("delivery_date_alt");
  const other = [docs.delivery_date, docs.delivery_date_alt, intake.candidates.delivery_date, savedAlt?.source === "user" ? savedAlt : undefined]
    .find((candidate) => candidate && candidate.value !== delivery.value && isCalendarDate(candidate.value));
  if (delivery.value && other) {
    facts.push({
      key: "delivery_date_alt", value: other.value, evidenceIds: other.evidenceIds, status: "candidate",
      source: other === docs.delivery_date || other === docs.delivery_date_alt ? "document" : "model",
    });
    if (delivery.status !== "confirmed" && delivery.status !== "unreadable") delivery.status = "disputed";
  }
  return { facts, run: intake.run, reused: intake.reused };
}
