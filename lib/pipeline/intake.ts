import { z } from "zod";
import type { AgentRun, CaseRecord, Evidence, Fact, FactKey } from "../types";
import { llmInfo, llmJson, LLMError, sha, UNTRUSTED_NOTE } from "../llm";
import { normalizeDigits } from "../extract";

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
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type ChatContext = "address_confirmation" | "substitution_approval" | "unclear" | "none";

export function classifyChat(text: string): ChatContext {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\[[^\]]*\]\s*/, "").trim());
  const AFF = /^(buyer|customer|ক্রেতা)\s*:\s*(yes|yeah|yep|ok|okay|sure|confirmed?|হ্যাঁ|জি|ঠিক আছে|হুম)\b/i;
  const SUB = /(substitut|instead|out of stock|alternative|বিকল্প|স্টকে নেই)/i;
  const ADDR = /(address|ঠিকানা)/i;
  let sawAff = false;
  let addr = false;
  let sub = false;
  for (let i = 0; i < lines.length; i++) {
    if (!AFF.test(lines[i])) continue;
    sawAff = true;
    const prev = lines.slice(Math.max(0, i - 2), i).join(" ");
    if (SUB.test(prev)) sub = true;
    else if (ADDR.test(prev)) addr = true;
  }
  if (sub) return "substitution_approval";
  if (addr) return "address_confirmation";
  return sawAff ? "unclear" : "none";
}

const firstMatch = (t: string, re: RegExp) => t.match(re)?.[1]?.trim();
const joined = (ev: Evidence[], kinds: Evidence["kind"][]) =>
  ev
    .filter((e) => kinds.includes(e.kind))
    .map((e) => e.pages.map((p) => p.text).join("\n"))
    .join("\n");
const ids = (ev: Evidence[], kinds: Evidence["kind"][]) =>
  ev.filter((e) => kinds.includes(e.kind)).map((e) => e.id);

type Cand = { value: string; evidenceIds: string[] };

export function docFacts(c: CaseRecord): Partial<Record<FactKey, Cand>> {
  const ev = c.evidence;
  const out: Partial<Record<FactKey, Cand>> = {};
  const order = normalizeDigits(joined(ev, ["order"]));
  const delivery = normalizeDigits(joined(ev, ["delivery"]));
  const rej = joined(ev, ["rejection"]);
  const chat = joined(ev, ["chat"]);

  const put = (k: FactKey, v: string | undefined, kinds: Evidence["kind"][]) => {
    if (v) out[k] = { value: v, evidenceIds: ids(ev, kinds) };
  };
  put("item_ordered", firstMatch(order, /Item ordered:\s*(.+)/i), ["order"]);
  put("seller", firstMatch(order, /Seller:\s*(.+)/i), ["order"]);
  put("order_date", firstMatch(order, /Order date:\s*(\d{4}-\d{2}-\d{2})/i), ["order"]);
  put("item_received", firstMatch(delivery, /Item delivered:\s*(.+)/i), ["delivery"]);
  put("delivery_date", firstMatch(delivery, /Delivered:\s*(\d{4}-\d{2}-\d{2})/i), ["delivery"]);

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
  if (chat.trim()) out.chat_context = { value: classifyChat(chat), evidenceIds: ids(ev, ["chat"]) };

  const hasReceipt =
    ev.some((e) => e.kind === "receipt") || (c.channel === "daraz" && ev.some((e) => e.kind === "order"));
  if (ev.length) out.has_receipt = { value: hasReceipt ? "yes" : "no", evidenceIds: ids(ev, ["receipt", "order"]) };

  if (order.trim()) {
    const has = /(estimated|expected) delivery|deliver(y|ed) by|delivery date/i.test(order);
    out.delivery_estimate_in_order = { value: has ? "yes" : "no", evidenceIds: ids(ev, ["order"]) };
  }
  return out;
}

const StorySchema = z.object({
  item_ordered: z.string().optional().default(""),
  item_received: z.string().optional().default(""),
  seller: z.string().optional().default(""),
  order_date: z.string().optional().default(""),
  delivery_date: z.string().optional().default(""),
  rejection_reason: z.string().optional().default(""),
  prior_action: z.string().optional().default(""),
  has_receipt: z.string().optional().default(""),
  chat_context: z.string().optional().default(""),
});

const enumOr = (v: string, allowed: string[]) => (allowed.includes(v) ? v : "");

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

async function storyFacts(c: CaseRecord): Promise<{ data: Record<string, string>; fallback: boolean; note?: string }> {
  if (!c.story.trim()) return { data: {}, fallback: true };
  try {
    const raw = await llmJson<unknown>({
      system: `You extract structured facts from a Bangladeshi consumer's account of a wrong-item delivery. ${UNTRUSTED_NOTE}
Return JSON with exactly these string keys (use "" when not stated, never guess):
item_ordered, item_received, seller, order_date (YYYY-MM-DD), delivery_date (YYYY-MM-DD),
rejection_reason (one of: substitute_approved, item_as_described, outside_window, other, none),
prior_action (one of: none, platform_return_rejected, platform_return_pending, seller_contacted),
has_receipt (yes/no), chat_context (one of: address_confirmation, substitution_approval, unclear, none).`,
      user: `<document>\n${c.story}\n</document>`,
    });
    const p = StorySchema.parse(raw);
    return {
      data: {
        ...p,
        rejection_reason: enumOr(p.rejection_reason, ["substitute_approved", "item_as_described", "outside_window", "other", "none"]),
        prior_action: enumOr(p.prior_action, ["none", "platform_return_rejected", "platform_return_pending", "seller_contacted"]),
        has_receipt: enumOr(p.has_receipt, ["yes", "no"]),
        chat_context: enumOr(p.chat_context, ["address_confirmation", "substitution_approval", "unclear", "none"]),
        order_date: ISO.test(p.order_date) ? p.order_date : "",
        delivery_date: ISO.test(p.delivery_date) ? p.delivery_date : "",
      },
      fallback: false,
    };
  } catch (e) {
    return { data: storyFallback(c.story), fallback: true, note: e instanceof LLMError ? e.message : "invalid-output" };
  }
}

function blank(key: FactKey): Fact {
  return { key, value: "", status: "candidate", evidenceIds: [], source: "model" };
}

export async function runIntake(c: CaseRecord): Promise<{ facts: Fact[]; run: AgentRun }> {
  const t0 = Date.now();
  const story = await storyFacts(c);
  const docs = docFacts(c);
  const prev = new Map(c.facts.map((f) => [f.key, f]));
  const facts: Fact[] = [];

  for (const key of FACT_KEYS) {
    const old = prev.get(key) ?? blank(key);
    const d = docs[key];
    const m = story.data[key] || "";
    let f: Fact = { ...old };

    if (old.source === "user" && old.value) {
      // user edits always win; a differing document date becomes a recorded conflict
      if (DATE_KEYS.includes(key) && d && d.value !== old.value) {
        f = { ...old, evidenceIds: d.evidenceIds, status: old.status === "confirmed" ? "confirmed" : "disputed" };
      } else if (d && d.value === old.value) {
        f = { ...old, evidenceIds: d.evidenceIds };
      }
    } else if (d) {
      f = { key, value: d.value, status: old.status === "confirmed" && old.value === d.value ? "confirmed" : "candidate", evidenceIds: d.evidenceIds, source: "document" };
      if (DATE_KEYS.includes(key) && m && m !== d.value) f.status = old.status === "confirmed" && old.value === d.value ? "confirmed" : "disputed";
    } else if (m) {
      f = { key, value: m, status: old.status === "confirmed" && old.value === m ? "confirmed" : "candidate", evidenceIds: [], source: "model" };
    } else if (!old.value) {
      f = blank(key);
    }
    facts.push(f);
  }

  // record the competing date so both are shown with their sources
  for (const key of DATE_KEYS) {
    const alt = key === "delivery_date" ? "delivery_date_alt" : null;
    if (!alt) continue;
    const main = facts.find((f) => f.key === key)!;
    const other = story.data[key];
    const d = docs[key]?.value;
    const userVal = prev.get(key)?.source === "user" ? prev.get(key)!.value : "";
    const candidates = [d, other, userVal].filter((v): v is string => !!v && ISO.test(v));
    const diff = candidates.find((v) => v !== main.value);
    if (diff) {
      facts.push({ key: "delivery_date_alt", value: diff, status: "candidate", evidenceIds: [], source: d && diff === d ? "document" : "model" });
      if (main.status !== "confirmed") main.status = "disputed";
    }
  }

  const info = llmInfo();
  const run: AgentRun = {
    agent: "intake",
    status: story.fallback && info.enabled ? "fallback" : story.fallback ? "fallback" : "done",
    model: story.fallback ? "rules" : info.model,
    inputHash: sha(c.story + c.evidence.map((e) => e.sha256).join()).slice(0, 12),
    ms: Date.now() - t0,
    note: story.note,
    at: new Date().toISOString(),
  };
  return { facts, run };
}
