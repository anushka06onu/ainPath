import type {
  Bi,
  CaseRecord,
  Fact,
  FactKey,
  Position,
  Question,
  Roadmap,
  RouteStep,
} from "./types";
import { normForMatch } from "./extract";
import { addDaysIso, buildDeadlineClocks, daysBetween, legacyDeadlineFromClocks, todayIso } from "./engines/deadline";
import { paymentOverlaySteps } from "./engines/route-payment";

export { addDaysIso, daysBetween, todayIso };

export const fact = (c: CaseRecord, k: FactKey): Fact | undefined => c.facts.find((f) => f.key === k);
export const val = (c: CaseRecord, k: FactKey): string => fact(c, k)?.value ?? "";

export function sameItem(a: string, b: string): boolean {
  const t = (s: string) =>
    new Set(
      normForMatch(s)
        .replace(/[—–\-_,.()]/g, " ")
        .split(" ")
        .filter(Boolean)
    );
  const A = t(a);
  const B = t(b);
  if (!A.size || !B.size) return false;
  return [...A].every((x) => B.has(x)) && [...B].every((x) => A.has(x));
}

type L = "source_confirmed" | "depends_on_disputed";
function labelFor(c: CaseRecord, keys: FactKey[]): L {
  return keys.every((k) => fact(c, k)?.status === "confirmed" && fact(c, k)?.value) ? "source_confirmed" : "depends_on_disputed";
}

const ATT = {
  order: { en: "Order confirmation (screenshot or PDF)", bn: "অর্ডার কনফার্মেশন (স্ক্রিনশট বা পিডিএফ)" },
  delivery: { en: "Photos of the delivered box and item; courier record", bn: "পাওয়া বক্স ও পণ্যের ছবি; কুরিয়ারের রেকর্ড" },
  reject: { en: "The rejection message from the platform or seller", bn: "প্ল্যাটফর্ম বা বিক্রেতার বাতিলের বার্তা" },
  chat: { en: "The full chat with timestamps (not just one reply)", bn: "সময়সহ পুরো চ্যাট (শুধু একটি উত্তর নয়)" },
  pay: { en: "Payment record (bKash / Nagad / card / COD slip)", bn: "পেমেন্টের রেকর্ড (বিকাশ / নগদ / কার্ড / ক্যাশ অন ডেলিভারি স্লিপ)" },
  terms: { en: "The seller's Terms of Sale", bn: "বিক্রেতার বিক্রয়ের শর্তাবলি" },
};

export function buildRoadmap(c: CaseRecord, now = new Date()): Roadmap {
  const clocks = buildDeadlineClocks(c, now);
  const dl = legacyDeadlineFromClocks(clocks);
  const steps: RouteStep[] = [];
  const chat = val(c, "chat_context");
  const prior = val(c, "prior_action");
  const reason = val(c, "rejection_reason");
  const ordered = val(c, "item_ordered");
  const received = val(c, "item_received");
  const mismatch = ordered && received ? !sameItem(ordered, received) : null;

  if (c.channel === "other") {
    return {
      routeId: "out_of_scope",
      headline: {
        en: "This case is outside what AinPath can route today.",
        bn: "এই মামলাটি আজ আইনপথের রুটিংয়ের আওতার বাইরে।",
      },
      clocks,
      deadline: dl,
      steps: [
        {
          id: "oos-review",
          dependsOn: [],
          kind: "review",
          label: "needs_review",
          title: { en: "Get local legal review", bn: "স্থানীয় আইনি পর্যালোচনা নিন" },
          detail: {
            en: "AinPath currently focuses on wrong-item deliveries from online marketplaces and Facebook shops. Use the case summary to explain your situation to a consumer-rights volunteer or lawyer.",
            bn: "আইনপথ এখন প্রধানত অনলাইন মার্কেটপ্লেস ও ফেসবুক শপের ভুল পণ্য ডেলিভারি নিয়ে কাজ করে। আপনার অবস্থা বোঝাতে কেস সারসংক্ষেপটি কোনো ভোক্তা-অধিকার স্বেচ্ছাসেবক বা আইনজীবীকে দেখান।",
          },
          where: { label: { en: "DNCRP hotline 16121", bn: "ডিএনসিআরপি হটলাইন ১৬১২১" }, url: "https://www.dncrp.com/" },
          attach: [ATT.order, ATT.pay, ATT.chat],
          authorityIds: ["DNCRP-FILE"],
        },
      ],
    };
  }

  // 1. compare identifiers (both channels)
  steps.push({
    id: "compare-ids",
    dependsOn: ["item_ordered", "item_received"],
    kind: "evidence",
    label: mismatch === false ? "needs_review" : labelFor(c, ["item_ordered", "item_received"]),
    title: { en: "Compare what you ordered with what arrived", bn: "যা অর্ডার করেছিলেন আর যা এসেছে তা মিলিয়ে দেখুন" },
    detail:
      mismatch === false
        ? {
            en: "The order and the delivered item look like the same product in your records. Check the model name on the box and the order page before going further.",
            bn: "আপনার রেকর্ডে অর্ডার ও পাওয়া পণ্য একই মনে হচ্ছে। এগোনোর আগে বক্সের মডেল নাম ও অর্ডার পেজ মিলিয়ে নিন।",
          }
        : {
            en: `Order records say "${ordered || "—"}"; the delivery record says "${received || "—"}". Keep both identifiers side by side.`,
            bn: `অর্ডারে লেখা "${ordered || "—"}"; ডেলিভারি রেকর্ডে "${received || "—"}"। দুটি শনাক্তকারী পাশাপাশি রাখুন।`,
          },
    attach: [ATT.order, ATT.delivery],
    authorityIds: [],
  });

  if (c.channel === "daraz") {
    const dd = fact(c, "delivery_date");
    const windowEnd = dd?.value ? addDaysIso(dd.value, 14) : "";
    const left = windowEnd ? daysBetween(todayIso(now), windowEnd) : null;
    const winNote: Bi | undefined =
      dd?.status === "confirmed" && left !== null
        ? left >= 0
          ? { en: `Many marketplaces publish a 14-day return window from delivery: about ${left} day(s) left. Check your order page for the exact period.`, bn: `অনেক মার্কেটপ্লেসে ডেলিভারি থেকে ১৪ দিনের রিটার্ন সময়সীমা থাকে: প্রায় ${left} দিন বাকি। সঠিক সময় অর্ডার পেজে দেখুন।` }
          : { en: `The published 14-day window ended about ${-left} day(s) ago. Say so honestly; the platform may still review, and the order page shows what applies.`, bn: `প্রকাশিত ১৪ দিনের সময়সীমা প্রায় ${-left} দিন আগে শেষ হয়েছে। অর্ডার পেজে কী প্রযোজ্য তা দেখুন; প্ল্যাটফর্ম তবুও পর্যালোচনা করতে পারে।` }
        : { en: "Many marketplaces publish a 14-day window from delivery; confirm your delivery date to see where you stand.", bn: "অনেক মার্কেটপ্লেস ডেলিভারি থেকে ১৪ দিনের সময়সীমা প্রকাশ করে; আপনি কোথায় আছেন দেখতে ডেলিভারির তারিখ নিশ্চিত করুন।" };

    if (prior === "none" || prior === "") {
      steps.push({
        id: "daraz-return",
        dependsOn: ["prior_action", "delivery_date"],
        kind: "official",
        label: labelFor(c, ["prior_action", "delivery_date"]),
        title: { en: "Open a return request on the marketplace", bn: "মার্কেটপ্লেসে রিটার্নের অনুরোধ করুন" },
        detail: {
          en: "In the marketplace app or site: My Orders → Return/Refund → choose “I received the wrong item”. Add photos of the box label and the item.",
          bn: "মার্কেটপ্লেস অ্যাপ বা সাইটে: My Orders → Return/Refund → “I received the wrong item” বেছে নিন। বক্সের লেবেল ও পণ্যের ছবি যোগ করুন।",
        },
        where: { label: { en: "Marketplace returns help", bn: "মার্কেটপ্লেস রিটার্ন সহায়তা" }, url: "https://www.daraz.com.bd/helpcenter/return-policy/" },
        attach: [ATT.order, ATT.delivery],
        caveat: winNote,
        authorityIds: ["DARAZ-RETURN"],
      });
    } else if (prior === "platform_return_rejected" || prior === "platform_return_pending") {
      const subReason = reason === "substitute_approved";
      if (subReason && chat === "address_confirmation") {
        steps.push({
          id: "daraz-followup",
          dependsOn: ["prior_action", "rejection_reason", "chat_context"],
          kind: "official",
          label: labelFor(c, ["prior_action", "rejection_reason", "chat_context"]),
          title: { en: "Send a follow-up to platform customer care with the chat", bn: "চ্যাটসহ প্ল্যাটফর্ম কাস্টমার কেয়ারে ফলো-আপ পাঠান" },
          detail: {
            en: "The rejection says you approved a substitute, but the message you replied to asked you to confirm an address. Quote the timestamped lines and ask for the rejection to be reviewed against them.",
            bn: "বাতিলের কারণে বলা হয়েছে আপনি বিকল্প মেনেছেন, কিন্তু আপনি যে বার্তার উত্তর দিয়েছেন সেটি ঠিকানা নিশ্চিত করতে বলেছিল। সময়সহ লাইনগুলো উদ্ধৃত করে পর্যালোচনার অনুরোধ করুন।",
          },
          where: { label: { en: "Platform customer care (in-app chat)", bn: "প্ল্যাটফর্ম কাস্টমার কেয়ার (অ্যাপে চ্যাট)" }, url: "https://www.daraz.com.bd/helpcenter/return-policy/" },
          attach: [ATT.reject, ATT.chat, ATT.order, ATT.delivery],
          caveat: winNote,
          authorityIds: ["DARAZ-RETURN"],
        });
      } else if (subReason && chat === "substitution_approval") {
        steps.push({
          id: "daraz-followup",
          dependsOn: ["prior_action", "rejection_reason", "chat_context"],
          kind: "review",
          label: "needs_review",
          title: { en: "The chat appears to show approval of a substitute — review before escalating", bn: "চ্যাটে বিকল্প অনুমোদনের চিহ্ন দেখা যাচ্ছে — এগোনোর আগে পর্যালোচনা করুন" },
          detail: {
            en: "Your reply follows a message offering Model B. The rejection may be consistent with that. Ask whether the offer clearly named the model and price, and whether anything else was said. Don't assert you never agreed.",
            bn: "আপনার উত্তরটি Model B প্রস্তাবের পরের বার্তা। বাতিলের কারণ এর সঙ্গে সামঞ্জস্যপূর্ণ হতে পারে। প্রস্তাবে মডেল ও দাম স্পষ্ট ছিল কি না এবং আর কী বলা হয়েছিল তা যাচাই করুন। কখনো রাজি হননি বলে দাবি করবেন না।",
          },
          where: { label: { en: "Consumer-rights volunteer or lawyer", bn: "ভোক্তা-অধিকার স্বেচ্ছাসেবক বা আইনজীবী" } },
          attach: [ATT.chat, ATT.reject, ATT.order],
          caveat: { en: "Agreement to a substitute can change the outcome. The full message history matters.", bn: "বিকল্পে সম্মতি ফলাফল বদলাতে পারে। পুরো বার্তা-ইতিহাস গুরুত্বপূর্ণ।" },
          authorityIds: ["CRPA-45"],
        });
      } else if (subReason) {
        steps.push({
          id: "daraz-followup",
          dependsOn: ["prior_action", "rejection_reason", "chat_context"],
          kind: "evidence",
          label: "depends_on_disputed",
          title: { en: "Get the full message history before replying to the rejection", bn: "বাতিলের জবাব দেওয়ার আগে পুরো বার্তা-ইতিহাস সংগ্রহ করুন" },
          detail: {
            en: "We can't tell what your reply was answering. Export the complete chat with timestamps and ask the seller for the underlying order details.",
            bn: "আপনার উত্তর কীসের জবাবে ছিল তা বোঝা যাচ্ছে না। সময়সহ পুরো চ্যাট এক্সপোর্ট করুন এবং বিক্রেতার কাছে অর্ডারের মূল তথ্য চান।",
          },
          attach: [ATT.chat, ATT.order],
          authorityIds: [],
        });
      } else {
        steps.push({
          id: "daraz-followup",
          dependsOn: ["prior_action", "rejection_reason"],
          kind: "official",
          label: labelFor(c, ["prior_action", "rejection_reason"]),
          title: { en: "Reply to the rejection with matching evidence", bn: "মিলিয়ে নেওয়া প্রমাণসহ বাতিলের জবাব দিন" },
          detail: {
            en: "Compare the stated reason with your order and delivery records, then answer that specific reason through platform customer care.",
            bn: "উল্লেখিত কারণ আপনার অর্ডার ও ডেলিভারি রেকর্ডের সঙ্গে মিলিয়ে নিন, তারপর সেই নির্দিষ্ট কারণের জবাব কাস্টমার কেয়ারের মাধ্যমে দিন।",
          },
          where: { label: { en: "Platform customer care", bn: "প্ল্যাটফর্ম কাস্টমার কেয়ার" }, url: "https://www.daraz.com.bd/helpcenter/return-policy/" },
          attach: [ATT.reject, ATT.order, ATT.delivery],
          caveat: winNote,
          authorityIds: ["DARAZ-RETURN"],
        });
      }
    } else {
      steps.push({
        id: "daraz-seller",
        dependsOn: ["prior_action"],
        kind: "info",
        label: labelFor(c, ["prior_action"]),
        title: { en: "Raise it with the marketplace first", bn: "আগে মার্কেটপ্লেসে জানান" },
        detail: { en: "You contacted the seller. Also open a return request on the marketplace so the platform has the case on record.", bn: "আপনি বিক্রেতার সঙ্গে যোগাযোগ করেছেন। প্ল্যাটফর্মে রেকর্ডের জন্য মার্কেটপ্লেসেও রিটার্নের অনুরোধ করুন।" },
        where: { label: { en: "Marketplace returns help", bn: "মার্কেটপ্লেস রিটার্ন সহায়তা" }, url: "https://www.daraz.com.bd/helpcenter/return-policy/" },
        attach: [ATT.order, ATT.delivery, ATT.chat],
        caveat: winNote,
        authorityIds: ["DARAZ-RETURN"],
      });
    }
  } else {
    // facebook
    const receipt = val(c, "has_receipt");
    steps.push(
      receipt === "yes"
        ? {
            id: "fb-evidence",
            dependsOn: ["has_receipt"],
            kind: "evidence",
            label: labelFor(c, ["has_receipt"]),
            title: { en: "Put your proof of purchase in one folder", bn: "ক্রয়ের প্রমাণ এক জায়গায় রাখুন" },
            detail: { en: "Collect the payment record, the page's order message and the chat. These are what the Directorate's guide asks for.", bn: "পেমেন্টের রেকর্ড, পেজের অর্ডার বার্তা ও চ্যাট এক করুন। অধিদপ্তরের নির্দেশিকায় এগুলোই চাওয়া হয়।" },
            attach: [ATT.pay, ATT.order, ATT.chat],
            authorityIds: ["DNCRP-FILE"],
          }
        : {
            id: "fb-evidence",
            dependsOn: ["has_receipt"],
            kind: "evidence",
            label: labelFor(c, ["has_receipt"]),
            title: { en: "Fill the proof-of-purchase gap first", bn: "আগে ক্রয়ের প্রমাণের ঘাটতি পূরণ করুন" },
            detail: { en: "You have no receipt. Get your bKash/Nagad/bank statement entry for the payment, and screenshots of the page's order message. Ask the page in writing for an invoice and keep their reply.", bn: "আপনার রসিদ নেই। পেমেন্টের বিকাশ/নগদ/ব্যাংক স্টেটমেন্ট এন্ট্রি এবং পেজের অর্ডার বার্তার স্ক্রিনশট জোগাড় করুন। পেজের কাছে লিখিতভাবে ইনভয়েস চান এবং উত্তর রেখে দিন।" },
            attach: [ATT.pay, ATT.chat],
            caveat: { en: "Missing proof weakens a complaint but doesn't end it. Payment records and chat can stand in.", bn: "প্রমাণ না থাকলে অভিযোগ দুর্বল হয়, শেষ হয় না। পেমেন্ট রেকর্ড ও চ্যাট বিকল্প হতে পারে।" },
            authorityIds: ["DNCRP-FILE"],
          }
    );
    if (chat === "substitution_approval") {
      steps.push({
        id: "fb-chat-review",
        dependsOn: ["chat_context"],
        kind: "review",
        label: "needs_review",
        title: { en: "Check the substitute offer before you file", bn: "অভিযোগের আগে বিকল্প প্রস্তাব যাচাই করুন" },
        detail: { en: "The chat shows a reply after a substitute was offered. A complaint that says you never agreed would be contradicted by it. Frame it around what was offered and shown.", bn: "বিকল্প প্রস্তাবের পরে আপনার উত্তর চ্যাটে আছে। রাজি হননি বললে চ্যাট তার বিপরীত দেখাবে। কী প্রস্তাব ও দেখানো হয়েছিল তার ভিত্তিতে বলুন।" },
        attach: [ATT.chat],
        authorityIds: ["CRPA-45"],
      });
    }
  }

  // Payment-channel overlays (bKash / Nagad / Card / COD / wallet)
  steps.push(...paymentOverlaySteps(c));

  // DNCRP step (both channels)
  const fbMain = c.channel === "facebook";
  steps.push({
    id: "dncrp",
    dependsOn: ["delivery_date", "delivery_date_alt", "has_receipt"],
    kind: "official",
    label: dl.state === "computed" ? "source_confirmed" : "depends_on_disputed",
    title: fbMain
      ? { en: "File a complaint with DNCRP", bn: "ডিএনসিআরপি-তে অভিযোগ দাখিল করুন" }
      : { en: "If the marketplace does not resolve it: complain to DNCRP", bn: "মার্কেটপ্লেস সমাধান না করলে: ডিএনসিআরপি-তে অভিযোগ করুন" },
    detail: {
      en: "Call 16121 or register on the DNCRP complaint portal with a mobile number verified by OTP. Describe the seller and what happened, then attach your evidence. AinPath prepares the draft; you submit it. AinPath never auto-submits.",
      bn: "১৬১২১-এ ফোন করুন অথবা ওটিপি-যাচাইকৃত মোবাইল নম্বর দিয়ে ডিএনসিআরপি অভিযোগ পোর্টালে নিবন্ধন করুন। বিক্রেতা ও ঘটনা লিখে প্রমাণ সংযুক্ত করুন। খসড়া আইনপথ বানায়; জমা আপনি দেন। আইনপথ কখনো স্বয়ংক্রিয় জমা দেয় না।",
    },
    where: { label: { en: "DNCRP — dncrp.com", bn: "ডিএনসিআরপি — dncrp.com" }, url: "https://www.dncrp.com/" },
    attach: [ATT.order, ATT.pay, ATT.chat, ATT.delivery],
    caveat: dl.note,
    authorityIds: ["DNCRP-FILE", "CRPA-60", "CRPA-45"],
  });

  const headline: Bi =
    c.channel === "daraz"
      ? prior === "platform_return_rejected"
        ? { en: "Your marketplace return was rejected. Here is the next step your evidence supports.", bn: "আপনার মার্কেটপ্লেস রিটার্ন বাতিল হয়েছে। আপনার প্রমাণ অনুযায়ী পরবর্তী ধাপ এখানে।" }
        : { en: "Start with the marketplace return route, then DNCRP if needed.", bn: "প্রথমে মার্কেটপ্লেসের রিটার্ন পথ, দরকার হলে ডিএনসিআরপি।" }
      : { en: "This is a Facebook shop purchase: the route is the DNCRP complaint, once your proof is in order.", bn: "এটি ফেসবুক শপের কেনাকাটা: প্রমাণ গুছিয়ে ডিএনসিআরপি-তে অভিযোগই পথ।" };

  return {
    routeId: c.channel === "daraz" ? "daraz_wrong_item" : "facebook_wrong_item",
    headline,
    steps,
    clocks,
    deadline: dl,
  };
}

export function chatExcerpt(c: CaseRecord): string {
  const chat = c.evidence.filter((e) => e.kind === "chat").map((e) => e.pages.map((p) => p.text).join("\n")).join("\n");
  const lines = chat.split(/\r?\n/).filter((l) => l.trim());
  const idx = lines.findIndex((l, i) => /Buyer\s*:\s*(yes|ok)/i.test(l) && i > 0 && /(substitut|instead|address|ঠিকানা)/i.test(lines[i - 1]));
  if (idx > 0) return `${lines[idx - 1]}\n${lines[idx]}`;
  return lines.slice(1, 3).join("\n");
}

export function buildPositions(c: CaseRecord): Position[] {
  const chat = val(c, "chat_context");
  const excerpt = chatExcerpt(c);
  const ex: Bi = { en: excerpt, bn: excerpt };
  const ordered = val(c, "item_ordered") || "Model A";
  const received = val(c, "item_received") || "Model B";
  const common: Bi = {
    en: `Order records name "${ordered}"; the delivery record names "${received}".`,
    bn: `অর্ডার রেকর্ডে "${ordered}"; ডেলিভারি রেকর্ডে "${received}"।`,
  };

  if (chat === "substitution_approval") {
    return [
      {
        side: "buyer",
        claim: { en: "I did not knowingly agree to receive a different model.", bn: "আমি জেনেশুনে ভিন্ন মডেল নিতে রাজি হইনি।" },
        support: [common],
        missing: [
          { en: "Whether the offer clearly named the model and any price or warranty difference.", bn: "প্রস্তাবে মডেল এবং দাম বা ওয়ারেন্টির পার্থক্য স্পষ্ট ছিল কি না।" },
          { en: "Anything said by phone or in other chats.", bn: "ফোনে বা অন্য চ্যাটে কী বলা হয়েছিল।" },
        ],
        authorityIds: ["CRPA-45"],
      },
      {
        side: "seller",
        claim: { en: "The buyer approved the substitute when it was offered.", bn: "প্রস্তাবের সময় ক্রেতা বিকল্পটি অনুমোদন করেছেন।" },
        support: [ex, { en: "The Terms (page 2) say a substitute is sent only if the buyer approves in writing.", bn: "শর্তাবলিতে (পৃষ্ঠা ২) বলা আছে ক্রেতা লিখিতভাবে অনুমোদন দিলেই বিকল্প পাঠানো হয়।" }],
        missing: [{ en: "Proof the buyer saw which model would be sent.", bn: "কোন মডেল পাঠানো হবে তা ক্রেতা দেখেছেন তার প্রমাণ।" }],
        authorityIds: ["CRPA-45"],
      },
    ];
  }
  if (chat === "address_confirmation") {
    return [
      {
        side: "buyer",
        claim: { en: "My “yes” confirmed my delivery address. I never approved a substitute.", bn: "আমার “yes” ছিল ডেলিভারি ঠিকানা নিশ্চিত করতে। আমি কোনো বিকল্প অনুমোদন করিনি।" },
        support: [common, ex],
        missing: [{ en: "Whether the seller sent a separate message offering Model B that is not in this export.", bn: "এই এক্সপোর্টে নেই এমন আলাদা বার্তায় বিক্রেতা Model B-র প্রস্তাব দিয়েছিল কি না।" }],
        authorityIds: ["CRPA-45"],
      },
      {
        side: "seller",
        claim: { en: "The buyer accepted a substitute.", bn: "ক্রেতা বিকল্প গ্রহণ করেছেন।" },
        support: [{ en: "This is the seller's stated reason; it is the reason on the rejection record.", bn: "এটি বিক্রেতার বলা কারণ এবং বাতিলের রেকর্ডেও এই কারণই আছে।" }],
        missing: [{ en: "A timestamped message that offers a substitute and a reply that answers it. None is in the uploaded chat.", bn: "বিকল্পের প্রস্তাব ও তার জবাবের সময়যুক্ত বার্তা। আপলোড করা চ্যাটে কোনোটিই নেই।" }],
        authorityIds: ["CRPA-45"],
      },
    ];
  }
  return [
    {
      side: "buyer",
      claim: { en: "I ordered one model and received another.", bn: "আমি এক মডেল অর্ডার করেছি, অন্যটি পেয়েছি।" },
      support: [common],
      missing: [{ en: "The full chat is needed to see what, if anything, was agreed.", bn: "কী সম্মতি হয়েছিল দেখতে পুরো চ্যাট দরকার।" }],
      authorityIds: ["CRPA-45"],
    },
    {
      side: "seller",
      claim: { en: "The buyer accepted a substitute.", bn: "ক্রেতা বিকল্প গ্রহণ করেছেন।" },
      support: [{ en: "Stated by the seller; not yet shown by an uploaded record.", bn: "বিক্রেতা বলেছেন; আপলোড করা কোনো রেকর্ডে এখনো দেখা যায়নি।" }],
      missing: [{ en: "The surrounding messages, with timestamps.", bn: "সময়সহ আশেপাশের বার্তাগুলো।" }],
      authorityIds: ["CRPA-45"],
    },
  ];
}

export function buildQuestions(c: CaseRecord): Question[] {
  const route: FactKey[] =
    c.channel === "daraz"
      ? ["item_ordered", "item_received", "prior_action", "rejection_reason", "chat_context", "delivery_date"]
      : c.channel === "facebook"
        ? ["item_ordered", "item_received", "has_receipt", "chat_context", "delivery_date"]
        : [];
  const rest: FactKey[] = ["seller", "order_date", "delivery_estimate_in_order", "has_receipt", "prior_action", "rejection_reason"];
  const qs: Question[] = route.map((key) => ({ key, affectsRoute: true }));
  for (const key of rest) if (!route.includes(key)) qs.push({ key, affectsRoute: false });
  if (fact(c, "delivery_date_alt")) qs.splice(qs.findIndex((q) => q.key === "delivery_date") + 1, 0, { key: "delivery_date_alt", affectsRoute: true });
  return qs;
}
