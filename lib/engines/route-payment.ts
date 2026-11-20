/**
 * Payment-channel overlay steps (plan §11.2).
 */
import type { Bi, CaseRecord, RouteStep } from "../types";

const ATT_PAY: Bi = {
  en: "Payment record (bKash / Nagad / card / COD slip)",
  bn: "পেমেন্টের রেকর্ড (বিকাশ / নগদ / কার্ড / ক্যাশ অন ডেলিভারি স্লিপ)",
};

export function paymentOverlaySteps(c: CaseRecord): RouteStep[] {
  const pay = c.paymentChannel ?? "UNKNOWN";
  const steps: RouteStep[] = [];

  if (pay === "CASH_ON_DELIVERY") {
    steps.push({
      id: "pay-cod",
      dependsOn: ["has_receipt"],
      kind: "evidence",
      label: "source_confirmed",
      title: { en: "COD: keep courier & unboxing proof", bn: "সিওডি: কুরিয়ার ও আনবক্সিং প্রমাণ রাখুন" },
      detail: {
        en: "No bank chargeback exists for cash on delivery. Keep airway bill, unboxing photos/video, and seller contact for marketplace or DNCRP routes.",
        bn: "ক্যাশ অন ডেলিভারিতে ব্যাংক চার্জব্যাক নেই। এয়ারওয়ে বিল, আনবক্সিং ছবি/ভিডিও ও বিক্রেতার যোগাযোগ রাখুন।",
      },
      attach: [ATT_PAY],
      authorityIds: ["DNCRP-FILE"],
    });
  }

  if (pay === "MFS_BKASH") {
    steps.push({
      id: "pay-bkash",
      dependsOn: ["has_receipt"],
      kind: "official",
      label: "source_confirmed",
      title: { en: "bKash dispute: 16247 → BB CIPC 16236", bn: "বিকাশ বিরোধ: ১৬২৪৭ → বিবি সিআইপিসি ১৬২৩৬" },
      detail: {
        en: "For merchant or P2P Send Money: report the TxID to bKash 16247 immediately. If unresolved, escalate to Bangladesh Bank CIPC 16236 / cms.bb.org.bd / bb.cipc@bb.org.bd, then parallel DNCRP. P2P has no automatic chargeback — speed matters.",
        bn: "মার্চেন্ট বা পি২পি সেন্ড মানি: TxID সাথে সাথে বিকাশ ১৬২৪৭-এ জানান। অমীমাংসিত হলে বিবি সিআইপিসি ১৬২৩৬ / cms.bb.org.bd, তারপর সমান্তরাল ডিএনসিআরপি। পি২পিতে স্বয়ংক্রিয় চার্জব্যাক নেই।",
      },
      where: { label: { en: "BB CIPC", bn: "বিবি সিআইপিসি" }, url: "https://cms.bb.org.bd" },
      attach: [ATT_PAY],
      authorityIds: ["BB-PAYMENT", "DNCRP-FILE"],
    });
  }

  if (pay === "MFS_NAGAD") {
    steps.push({
      id: "pay-nagad",
      dependsOn: ["has_receipt"],
      kind: "official",
      label: "source_confirmed",
      title: { en: "Nagad dispute: 16167 → BB CIPC 16236", bn: "নগদ বিরোধ: ১৬১৬৭ → বিবি সিআইপিসি ১৬২৩৬" },
      detail: {
        en: "Report TxID to Nagad 16167; escalate unresolved tickets to BB CIPC 16236, then DNCRP in parallel.",
        bn: "TxID নগদ ১৬১৬৭-এ জানান; অমীমাংসিত টিকিট বিবি সিআইপিসি ১৬২৩৬, তারপর ডিএনসিআরপি।",
      },
      where: { label: { en: "BB CIPC", bn: "বিবি সিআইপিসি" }, url: "https://cms.bb.org.bd" },
      attach: [ATT_PAY],
      authorityIds: ["BB-PAYMENT", "DNCRP-FILE"],
    });
  }

  if (pay === "MFS_ROCKET") {
    steps.push({
      id: "pay-rocket",
      dependsOn: ["has_receipt"],
      kind: "official",
      label: "source_confirmed",
      title: { en: "Rocket dispute → BB CIPC 16236", bn: "রকেট বিরোধ → বিবি সিআইপিসি ১৬২৩৬" },
      detail: {
        en: "Log the dispute with Dutch-Bangla Rocket support using the TxID, then escalate to BB CIPC 16236 if unresolved.",
        bn: "TxID দিয়ে ডাচ-বাংলা রকেট সাপোর্টে লগ করুন; অমীমাংসিত হলে বিবি সিআইপিসি ১৬২৩৬।",
      },
      where: { label: { en: "BB CIPC", bn: "বিবি সিআইপিসি" }, url: "https://cms.bb.org.bd" },
      attach: [ATT_PAY],
      authorityIds: ["BB-PAYMENT"],
    });
  }

  if (pay === "CARD_DEBIT_CREDIT") {
    steps.push({
      id: "pay-card",
      dependsOn: ["has_receipt", "delivery_date"],
      kind: "official",
      label: "source_confirmed",
      title: { en: "Issuing-bank card chargeback", bn: "ইস্যুয়িং ব্যাংক কার্ড চার্জব্যাক" },
      detail: {
        en: "File a chargeback with your issuing bank (Goods Not as Described / Incorrect Item). Attach order ID, promised specs, photo of received item, and rejection screenshot. VERIFY the bank’s 60–120 day network window.",
        bn: "ইস্যুয়িং ব্যাংকে চার্জব্যাক দাখিল করুন (বর্ণিত পণ্য নয় / ভুল পণ্য)। অর্ডার আইডি, প্রতিশ্রুত স্পেক, পাওয়া পণ্যের ছবি ও বাতিলের স্ক্রিনশট যোগ করুন। ব্যাংকের ৬০–১২০ দিনের সময়সীমা VERIFY করুন।",
      },
      attach: [ATT_PAY],
      caveat: {
        en: "Gateway cannot force store credit instead of original-channel refund for seller-caused failure (DCOG same-channel rule — VERIFY).",
        bn: "বিক্রেতা-জনিত ব্যর্থতায় গেটওয়ে স্টোর ক্রেডিট চাপিয়ে দিতে পারে না (ডিসিওজি একই-চ্যানেল নিয়ম — VERIFY)।",
      },
      authorityIds: ["BB-PAYMENT", "DCOG-3.5.1"],
    });
  }

  if (pay === "PLATFORM_WALLET") {
    steps.push({
      id: "pay-wallet",
      dependsOn: ["has_receipt"],
      kind: "official",
      label: "source_confirmed",
      title: { en: "Gateway / wallet escrow ticket", bn: "গেটওয়ে / ওয়ালেট এসক্রো টিকিট" },
      detail: {
        en: "Open an escrow/hold ticket with the payment gateway (SSLCOMMERZ / aamarPay / platform wallet). Flag that seller-caused refunds should return via the original channel, not forced vouchers (VERIFY DCOG 3.5.1).",
        bn: "পেমেন্ট গেটওয়েতে (SSLCOMMERZ / aamarPay / প্ল্যাটফর্ম ওয়ালেট) হোল্ড টিকিট খুলুন। বিক্রেতা-জনিত ফেরত মূল চ্যানেলে হওয়া উচিত — জোর করে ভাউচার নয় (VERIFY)।",
      },
      attach: [ATT_PAY],
      authorityIds: ["BB-PAYMENT", "DCOG-3.5.1"],
    });
  }

  if (c.channel === "facebook" && (pay === "MFS_BKASH" || pay === "MFS_NAGAD" || pay === "UNKNOWN")) {
    const receipt = c.facts.find((f) => f.key === "has_receipt")?.value;
    if (receipt !== "yes") {
      steps.push({
        id: "pay-fb-gap",
        dependsOn: ["has_receipt"],
        kind: "evidence",
        label: "needs_review",
        title: { en: "Facebook purchase: fill payment proof gap", bn: "ফেসবুক কেনাকাটা: পেমেন্ট প্রমাণের ঘাটতি পূরণ" },
        detail: {
          en: "No platform portal exists. Collect MFS TxID + page URL + full chat before DNCRP can be SOURCE_CONFIRMED.",
          bn: "প্ল্যাটফর্ম পোর্টাল নেই। ডিএনসিআরপি SOURCE_CONFIRMED হওয়ার আগে এমএফএস TxID + পেজ ইউআরএল + পুরো চ্যাট সংগ্রহ করুন।",
        },
        attach: [ATT_PAY],
        authorityIds: ["DNCRP-FILE"],
      });
    }
  }

  return steps;
}
