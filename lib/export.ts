import type { Bi, CaseRecord, CaseView, Lang } from "./types";
import { toView } from "./cases";
import { redactPii } from "./pii";

type Block =
  | { t: "h1" | "h2" | "p" | "quote"; s: string }
  | { t: "ul"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function redact(s: string): string {
  return redactPii(s).replace(/\b(DZ|RR)-[A-Z]+-\d+\b/g, "[id removed]");
}

function toMd(b: Block[]): string {
  return (
    b
      .map((x) => {
        switch (x.t) {
          case "h1": return `# ${x.s}`;
          case "h2": return `## ${x.s}`;
          case "p": return x.s;
          case "quote": return x.s.split("\n").map((l) => `> ${l}`).join("\n");
          case "ul": return x.items.map((i) => `- ${i}`).join("\n");
          case "table":
            return [`| ${x.head.join(" | ")} |`, `| ${x.head.map(() => "---").join(" | ")} |`, ...x.rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "/").replace(/\n/g, " ")).join(" | ")} |`)].join("\n");
        }
      })
      .join("\n\n") + "\n"
  );
}

function toHtml(b: Block[], lang: Lang, title: string): string {
  const body = b
    .map((x) => {
      switch (x.t) {
        case "h1": return `<h1>${esc(x.s)}</h1>`;
        case "h2": return `<h2>${esc(x.s)}</h2>`;
        case "p": return `<p>${esc(x.s)}</p>`;
        case "quote": return `<blockquote>${esc(x.s).replace(/\n/g, "<br>")}</blockquote>`;
        case "ul": return `<ul>${x.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
        case "table": return `<table><thead><tr>${x.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${x.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      }
    })
    .join("\n");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font:15px/1.7 "Noto Sans Bengali","Nirmala UI",system-ui,sans-serif;max-width:780px;margin:40px auto;padding:0 20px;color:#1b1f2a}
h1{font-family:Georgia,"Noto Serif Bengali",serif;font-size:26px;margin:0 0 8px}h2{font-family:Georgia,"Noto Serif Bengali",serif;font-size:18px;margin:28px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
blockquote{margin:8px 0;padding:8px 14px;border-left:3px solid #2b6b57;background:#f4f1ea;white-space:normal}
table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top;text-align:left}th{background:#f4f1ea}
@media print{body{margin:0}}
</style></head><body>${body}</body></html>`;
}

const pick = (b: Bi, l: Lang) => b[l] || b.en;
const T = (l: Lang, en: string, bn: string) => (l === "bn" ? bn : en);

const FACT_LABEL: Record<string, Bi> = {
  item_ordered: { en: "Item ordered", bn: "অর্ডার করা পণ্য" },
  item_received: { en: "Item received", bn: "পাওয়া পণ্য" },
  seller: { en: "Seller", bn: "বিক্রেতা" },
  order_date: { en: "Order date", bn: "অর্ডারের তারিখ" },
  delivery_date: { en: "Delivery date", bn: "ডেলিভারির তারিখ" },
  delivery_date_alt: { en: "Other delivery date on record", bn: "রেকর্ডে থাকা অন্য ডেলিভারির তারিখ" },
  rejection_reason: { en: "Reason given for rejection", bn: "বাতিলের কারণ" },
  prior_action: { en: "Action already taken", bn: "ইতিমধ্যে নেওয়া পদক্ষেপ" },
  has_receipt: { en: "Proof of purchase", bn: "ক্রয়ের প্রমাণ" },
  chat_context: { en: "What the reply in the chat answered", bn: "চ্যাটের উত্তরটি কীসের জবাবে" },
  delivery_estimate_in_order: { en: "Delivery estimate in the order", bn: "অর্ডারে ডেলিভারির আনুমানিক সময়" },
};

const ENUM: Record<string, Bi> = {
  substitute_approved: { en: "Customer approved a substitute", bn: "ক্রেতা বিকল্প অনুমোদন করেছেন" },
  item_as_described: { en: "Item as described", bn: "পণ্য বর্ণনা অনুযায়ী" },
  outside_window: { en: "Outside return window", bn: "রিটার্নের সময়ের বাইরে" },
  other: { en: "Other", bn: "অন্য" },
  none: { en: "None", bn: "নেই" },
  platform_return_rejected: { en: "Platform return request rejected", bn: "প্ল্যাটফর্মে রিটার্ন অনুরোধ বাতিল" },
  platform_return_pending: { en: "Platform return request pending", bn: "প্ল্যাটফর্মে রিটার্ন অনুরোধ অপেক্ষমাণ" },
  seller_contacted: { en: "Seller contacted", bn: "বিক্রেতার সঙ্গে যোগাযোগ হয়েছে" },
  yes: { en: "Yes", bn: "আছে" },
  no: { en: "No", bn: "নেই" },
  address_confirmation: { en: "A request to confirm the delivery address", bn: "ডেলিভারি ঠিকানা নিশ্চিত করার অনুরোধ" },
  substitution_approval: { en: "An offer of a substitute item", bn: "বিকল্প পণ্যের প্রস্তাব" },
  unclear: { en: "Unclear", bn: "অস্পষ্ট" },
};

export const factDisplay = (key: string, value: string, l: Lang) =>
  !value ? T(l, "not provided", "দেওয়া হয়নি") : ENUM[value] ? pick(ENUM[value], l) : value;

const STATUS: Record<string, Bi> = {
  confirmed: { en: "confirmed", bn: "নিশ্চিত" },
  candidate: { en: "not yet confirmed", bn: "এখনো নিশ্চিত নয়" },
  disputed: { en: "disputed", bn: "বিতর্কিত" },
  unreadable: { en: "unreadable", bn: "পড়া যায়নি" },
};

function factsTable(v: CaseView, l: Lang, r: (s: string) => string): Block {
  return {
    t: "table",
    head: [T(l, "Fact", "তথ্য"), T(l, "Value", "মান"), T(l, "Status", "অবস্থা"), T(l, "Evidence", "প্রমাণ")],
    rows: v.facts
      .filter((f) => f.value)
      .map((f) => [pick(FACT_LABEL[f.key], l), r(factDisplay(f.key, f.value, l)), pick(STATUS[f.status], l), f.evidenceIds.join(", ") || "—"]),
  };
}

export function buyerDraft(c: CaseRecord, l: Lang, doRedact: boolean): Block[] {
  const v = toView(c);
  const r = doRedact ? redact : (s: string) => s;
  const get = (k: string) => c.facts.find((f) => f.key === k)?.value ?? "";
  const rm = v.roadmap;
  const dncrp = c.channel === "facebook";
  const prior = get("prior_action");
  const title =
    c.channel === "daraz" && prior === "platform_return_rejected"
      ? T(l, "Follow-up to platform customer care", "প্ল্যাটফর্ম কাস্টমার কেয়ারে ফলো-আপ")
      : c.channel === "daraz"
        ? T(l, "Return request note — wrong item delivered", "রিটার্ন অনুরোধের নোট — ভুল পণ্য ডেলিভারি")
        : T(l, "Complaint draft for DNCRP — wrong item delivered", "ডিএনসিআরপি-র জন্য অভিযোগের খসড়া — ভুল পণ্য ডেলিভারি");
  const disputes = c.facts.filter((f) => f.status === "disputed" && f.value);
  const chatEv = c.evidence.filter((e) => e.kind === "chat");
  const blocks: Block[] = [
    { t: "h1", s: title },
    { t: "p", s: T(l, "DRAFT for you to review, edit and submit yourself. AinPath does not submit anything.", "খসড়া — আপনি দেখে, সম্পাদনা করে নিজে জমা দেবেন। আইনপথ কিছু জমা দেয় না।") },
    { t: "h2", s: T(l, "Details", "বিবরণ") },
    {
      t: "ul",
      items: [
        `${T(l, "Name", "নাম")}: [${T(l, "your name", "আপনার নাম")}]`,
        `${T(l, "Mobile", "মোবাইল")}: [${T(l, "your mobile number", "আপনার মোবাইল নম্বর")}]`,
        `${T(l, "Seller", "বিক্রেতা")}: ${r(get("seller") || "—")}`,
        `${T(l, "Where I bought", "যেখান থেকে কিনেছি")}: ${c.channel === "daraz" ? T(l, "Online marketplace", "অনলাইন মার্কেটপ্লেস") : c.channel === "facebook" ? T(l, "Facebook shop", "ফেসবুক শপ") : T(l, "Other", "অন্য")}`,
        `${T(l, "Order date", "অর্ডারের তারিখ")}: ${get("order_date") || "—"}`,
        `${T(l, "Delivery date", "ডেলিভারির তারিখ")}: ${get("delivery_date") || "—"}`,
      ],
    },
    { t: "h2", s: T(l, "What happened", "কী ঘটেছে") },
    {
      t: "p",
      s: T(
        l,
        `I ordered "${r(get("item_ordered") || "—")}". The order records name that item. The item delivered was "${r(get("item_received") || "—")}".`,
        `আমি "${r(get("item_ordered") || "—")}" অর্ডার করেছিলাম। অর্ডারের রেকর্ডে সেই পণ্যের নামই আছে। যে পণ্য এসেছে তা "${r(get("item_received") || "—")}"।`
      ),
    },
  ];
  if (prior === "platform_return_rejected")
    blocks.push({
      t: "p",
      s: T(
        l,
        `I asked for a return on the platform. It was rejected with the reason: "${pick(ENUM[get("rejection_reason")] ?? { en: get("rejection_reason") || "—", bn: get("rejection_reason") || "—" }, l)}".`,
        `আমি প্ল্যাটফর্মে রিটার্নের অনুরোধ করেছিলাম। এটি এই কারণে বাতিল হয়েছে: "${pick(ENUM[get("rejection_reason")] ?? { en: get("rejection_reason") || "—", bn: get("rejection_reason") || "—" }, l)}"।`
      ),
    });
  if (chatEv.length) {
    const ctx = get("chat_context");
    if (ctx === "address_confirmation")
      blocks.push({ t: "p", s: T(l, "The reply I sent in the chat answered a request to confirm my delivery address. The excerpt below shows the message it answered:", "চ্যাটে আমি যে উত্তর দিয়েছি তা ডেলিভারি ঠিকানা নিশ্চিত করার অনুরোধের জবাবে ছিল। নিচের অংশে দেখা যাবে কোন বার্তার জবাব ছিল:") });
    else if (ctx === "substitution_approval")
      blocks.push({ t: "p", s: T(l, "The chat contains a reply that follows an offer of a different model. I set out what was offered and shown to me at that time:", "চ্যাটে ভিন্ন মডেলের প্রস্তাবের পরে আমার একটি উত্তর আছে। সেই সময় আমাকে কী প্রস্তাব ও দেখানো হয়েছিল তা নিচে দিলাম:") });
    else blocks.push({ t: "p", s: T(l, "The chat export is attached. I have not yet confirmed which message my reply answered.", "চ্যাট এক্সপোর্ট সংযুক্ত। আমার উত্তর কোন বার্তার জবাবে ছিল তা আমি এখনো নিশ্চিত করিনি।") });
    const txt = chatEv[0].pages.map((p) => p.text).join("\n").split("\n").slice(1, 6).join("\n");
    blocks.push({ t: "quote", s: r(txt) });
  }
  if (disputes.length)
    blocks.push({
      t: "p",
      s: T(l, "Points where my records differ, which I am still checking: ", "যে বিষয়ে আমার রেকর্ডে অমিল আছে এবং যা আমি যাচাই করছি: ") +
        disputes.map((d) => `${pick(FACT_LABEL[d.key], l)} (${d.value})`).join("; "),
    });
  blocks.push(
    { t: "h2", s: T(l, "What I am asking for", "আমার অনুরোধ") },
    {
      t: "p",
      s: dncrp
        ? T(l, "Please review this complaint and ask the seller to supply the item I ordered or refund my payment.", "অনুগ্রহ করে এই অভিযোগ পর্যালোচনা করুন এবং বিক্রেতাকে আমার অর্ডার করা পণ্য দিতে বা টাকা ফেরত দিতে বলুন।")
        : T(l, "Please review the rejection against the attached order and delivery records, and arrange the correct item or a refund.", "অনুগ্রহ করে সংযুক্ত অর্ডার ও ডেলিভারি রেকর্ডের সঙ্গে মিলিয়ে বাতিলের সিদ্ধান্ত পর্যালোচনা করুন এবং সঠিক পণ্য বা টাকা ফেরতের ব্যবস্থা করুন।"),
    },
    { t: "h2", s: T(l, "Attachments", "সংযুক্তি") },
    { t: "ul", items: c.evidence.map((e) => `${e.id} — ${e.filename}`) },
    { t: "h2", s: T(l, "Where to submit", "কোথায় জমা দেবেন") },
    {
      t: "ul",
      items: rm.steps
        .filter((s) => s.where?.url)
        .map((s) => `${pick(s.title, l)} — ${s.where!.url}`),
    }
  );
  return blocks;
}

export function evidenceIndex(c: CaseRecord, l: Lang, selected: string[] | null): Block[] {
  const ev = c.evidence.filter((e) => !selected || selected.includes(e.id));
  return [
    { t: "h1", s: T(l, "Evidence index", "প্রমাণের সূচি") },
    { t: "p", s: T(l, `Case ${c.id}. SHA-256 lets anyone check that a file has not changed since upload.`, `কেস ${c.id}। SHA-256 দিয়ে যে কেউ যাচাই করতে পারেন আপলোডের পর ফাইল বদলায়নি।`) },
    {
      t: "table",
      head: [T(l, "ID", "আইডি"), T(l, "File", "ফাইল"), T(l, "Type", "ধরন"), T(l, "Pages", "পৃষ্ঠা"), T(l, "Extraction", "এক্সট্র্যাকশন"), "SHA-256"],
      rows: ev.map((e) => [e.id, e.filename, e.kind, String(e.pages.length), `${e.extraction}${e.corrected ? " + corrected" : ""} (${Math.round(Math.min(...e.pages.map((p) => p.confidence)) * 100)}%)${e.injectionFlag ? " ⚠ instructions in text ignored" : ""}`, e.sha256.slice(0, 16) + "…"]),
    },
  ];
}

export function memo(c: CaseRecord, l: Lang, doRedact: boolean): Block[] {
  const v = toView(c);
  const r = doRedact ? redact : (s: string) => s;
  const a = c.analysis;
  const labels = {
    verified: T(l, "Citation verified", "উদ্ধৃতি যাচাইকৃত"),
    unresolved: T(l, "Unresolved", "অমীমাংসিত"),
    review: T(l, "Needs review", "পর্যালোচনা দরকার"),
    disputed_fact_dependent: T(l, "Depends on a disputed fact", "বিতর্কিত তথ্যের ওপর নির্ভরশীল"),
    rejected_ungrounded: T(l, "Source check failed", "উৎস যাচাই ব্যর্থ"),
  };
  const blocks: Block[] = [
    { t: "h1", s: T(l, "Reviewer memorandum", "পর্যালোচক স্মারক") },
    { t: "p", s: T(l, `Case ${c.id} · Channel: ${c.channel} · Generated ${new Date().toISOString().slice(0, 10)}. Drafted by software for a qualified reviewer. It flags risks; it does not find that any breach occurred.`, `কেস ${c.id} · চ্যানেল: ${c.channel} · তৈরি ${new Date().toISOString().slice(0, 10)}। সফটওয়্যার তৈরি, যোগ্য পর্যালোচকের জন্য। এটি ঝুঁকি চিহ্নিত করে; কোনো লঙ্ঘন ঘটেছে বলে সিদ্ধান্ত দেয় না।`) },
    { t: "h2", s: T(l, "Confirmed facts", "নিশ্চিত তথ্য") },
    factsTable(v, l, r),
    { t: "h2", s: T(l, "Findings on the uploaded terms", "আপলোড করা শর্তাবলির ওপর পর্যবেক্ষণ") },
  ];
  if (!a?.findings.length) blocks.push({ t: "p", s: T(l, "No analysis has been run.", "কোনো বিশ্লেষণ চালানো হয়নি।") });
  for (const f of a?.findings ?? []) {
    const auths = f.authorityIds.map((id) => v.authorities.find((x) => x.id === id)).filter(Boolean);
    blocks.push(
      { t: "h2", s: `${r(pick(f.title, l))} — ${labels[f.status]}` },
      { t: "p", s: r(pick(f.risk, l)) },
      { t: "quote", s: `${T(l, "Page", "পৃষ্ঠা")} ${f.anchor.page} (${f.anchor.evidenceId}) · “${r(f.anchor.quote)}”${f.secondAnchor ? `\n${T(l, "Page", "পৃষ্ঠা")} ${f.secondAnchor.page} (${f.secondAnchor.evidenceId}) · “${r(f.secondAnchor.quote)}”` : ""}` },
      { t: "p", s: `${T(l, "Authority", "কর্তৃপক্ষ")}: ${auths.map((x) => `${pick(x!.title, l)} (${x!.textKind === "verbatim" ? T(l, "official text", "সরকারি পাঠ") : T(l, "paraphrase — verify", "সারসংক্ষেপ — যাচাই করুন")}) ${x!.url}`).join("; ")}` },
      { t: "quote", s: `“${f.authorityQuote}”` },
      { t: "p", s: `${T(l, "Counterpoint", "পাল্টা যুক্তি")}: ${r(pick(f.counterpoint, l))}` },
      { t: "p", s: `${T(l, "Assumptions", "অনুমান")}: ${r(pick(f.assumptions, l))}` },
      { t: "p", s: `${T(l, "Next check", "পরবর্তী যাচাই")}: ${r(pick(f.nextCheck, l))}` },
      { t: "p", s: `${T(l, "Verification", "যাচাই")}: ${r(pick(f.statusReason, l))}` }
    );
  }
  blocks.push({ t: "h2", s: T(l, "Positions on the actual order", "প্রকৃত অর্ডারে দুই পক্ষের অবস্থান") });
  for (const p of a?.positions ?? []) {
    blocks.push(
      { t: "p", s: `${p.side === "buyer" ? T(l, "Buyer", "ক্রেতা") : T(l, "Seller", "বিক্রেতা")}: ${pick(p.claim, l)}` },
      { t: "ul", items: [...p.support.map((s) => `${T(l, "Support", "সমর্থন")}: ${r(pick(s, l))}`), ...p.missing.map((s) => `${T(l, "Missing", "অনুপস্থিত")}: ${pick(s, l)}`)] }
    );
  }
  blocks.push(
    { t: "h2", s: T(l, "Roadmap summary", "রোডম্যাপের সারসংক্ষেপ") },
    { t: "p", s: pick(v.roadmap.headline, l) },
    { t: "ul", items: v.roadmap.steps.map((s) => `${pick(s.title, l)} [${s.label}]${s.caveat ? " — " + pick(s.caveat, l) : ""}`) },
    { t: "p", s: `${T(l, "Statutory period (s.60)", "আইনি সময়সীমা (ধারা ৬০)")}: ${v.roadmap.deadline.date ?? "—"} — ${pick(v.roadmap.deadline.note, l)}` },
    { t: "h2", s: T(l, "Unresolved issues", "অমীমাংসিত বিষয়") },
    {
      t: "ul",
      items: [
        ...(a?.findings.filter((f) => f.status !== "verified").map((f) => `${pick(f.title, l)}: ${pick(f.statusReason, l)}`) ?? []),
        ...c.facts.filter((f) => f.status !== "confirmed" && f.value).map((f) => `${pick(FACT_LABEL[f.key], l)}: ${pick(STATUS[f.status], l)}`),
        ...c.evidence.filter((e) => e.injectionFlag).map((e) => T(l, `${e.filename} contains instruction-like text; it was treated as evidence only.`, `${e.filename}-এ নির্দেশ-সদৃশ লেখা আছে; এটি শুধু প্রমাণ হিসেবে গণ্য হয়েছে।`)),
      ].length
        ? [
            ...(a?.findings.filter((f) => f.status !== "verified").map((f) => `${pick(f.title, l)}: ${pick(f.statusReason, l)}`) ?? []),
            ...c.facts.filter((f) => f.status !== "confirmed" && f.value).map((f) => `${pick(FACT_LABEL[f.key], l)}: ${pick(STATUS[f.status], l)}`),
            ...c.evidence.filter((e) => e.injectionFlag).map((e) => T(l, `${e.filename} contains instruction-like text; it was treated as evidence only.`, `${e.filename}-এ নির্দেশ-সদৃশ লেখা আছে; এটি শুধু প্রমাণ হিসেবে গণ্য হয়েছে।`)),
          ]
        : [T(l, "None recorded.", "কিছু নেই।")],
    },
    { t: "h2", s: T(l, "Source register", "উৎসের তালিকা") },
    {
      t: "table",
      head: [T(l, "ID", "আইডি"), T(l, "Type", "ধরন"), T(l, "Title", "শিরোনাম"), T(l, "Text", "পাঠ"), T(l, "Checked", "যাচাইয়ের তারিখ"), "URL"],
      rows: v.authorities.map((x) => [x.id, x.type, pick(x.title, l), x.textKind, x.dateChecked, x.url]),
    },
    { t: "h2", s: T(l, "Run record", "চালানোর রেকর্ড") },
    {
      t: "table",
      head: ["Agent", "Status", "Model", "Input hash", "ms", "Note"],
      rows: (a?.runs ?? []).map((x) => [x.agent, x.status, x.model, x.inputHash, String(x.ms), x.note ?? ""]),
    }
  );
  return blocks;
}

export function render(blocks: Block[], format: "md" | "html", lang: Lang, title: string) {
  return format === "md" ? toMd(blocks) : toHtml(blocks, lang, title);
}
