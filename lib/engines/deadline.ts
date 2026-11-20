/**
 * Deterministic dual/multi-clock DeadlineEngine (plan §10).
 * LLMs never compute dates. Unconfirmed triggers → REFUSED_UNCONFIRMED_TRIGGER.
 */
import type {
  Bi,
  CaseRecord,
  ClockId,
  ClockStatus,
  DeadlineClock,
  Fact,
  FactKey,
  PaymentChannel,
  Roadmap,
} from "../types";

const DAY = 86400000;
export const addDaysIso = (iso: string, n: number) =>
  new Date(new Date(iso + "T00:00:00Z").getTime() + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / DAY);
export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);

const fact = (c: CaseRecord, k: FactKey): Fact | undefined => c.facts.find((f) => f.key === k);

const EXPIRING_SOON_DAYS = 3;

function clockStatus(due: string, now: Date): ClockStatus {
  const left = daysBetween(todayIso(now), due);
  if (left < 0) return "EXPIRED";
  if (left <= EXPIRING_SOON_DAYS) return "EXPIRING_SOON";
  return "ACTIVE";
}

function refused(
  clockId: ClockId,
  name: Bi,
  authorityId: string,
  reason: Bi,
  triggerFactKey?: string
): DeadlineClock {
  return {
    clockId,
    name,
    authorityId,
    triggerFactKey,
    status: "REFUSED_UNCONFIRMED_TRIGGER",
    note: reason,
    refusalReason: reason,
  };
}

function na(clockId: ClockId, name: Bi, authorityId: string, note: Bi): DeadlineClock {
  return { clockId, name, authorityId, status: "NOT_APPLICABLE", note };
}

function computed(
  clockId: ClockId,
  name: Bi,
  authorityId: string,
  trigger: Fact,
  windowDays: number,
  now: Date,
  extraNote?: Bi
): DeadlineClock {
  const due = addDaysIso(trigger.value, windowDays);
  const left = daysBetween(todayIso(now), due);
  const status = clockStatus(due, now);
  const remaining: Bi =
    left < 0
      ? {
          en: `Window ended ${-left} day(s) ago.`,
          bn: `সময়সীমা ${-left} দিন আগে শেষ হয়েছে।`,
        }
      : { en: `${left} day(s) remaining.`, bn: `${left} দিন বাকি।` };
  return {
    clockId,
    name,
    authorityId,
    triggerFactKey: trigger.key,
    triggerDate: trigger.value,
    dueDate: due,
    daysRemaining: left,
    status,
    note: {
      en: `${name.en}: ${windowDays} calendar days from ${trigger.value}. ${remaining.en}${extraNote ? " " + extraNote.en : ""}`,
      bn: `${name.bn}: ${trigger.value} থেকে ${windowDays} ক্যালেন্ডার দিন। ${remaining.bn}${extraNote ? " " + extraNote.bn : ""}`,
    },
  };
}

function triggerOk(f: Fact | undefined): f is Fact & { value: string } {
  return !!f?.value && f.status === "confirmed";
}

function conflictRefuse(
  clockId: ClockId,
  name: Bi,
  authorityId: string,
  d: Fact,
  alt: Fact
): DeadlineClock {
  return refused(clockId, name, authorityId, {
    en: `Conflicting dates on record (${d.value} vs ${alt.value}). Confirm one trigger on the facts screen before a deadline is shown.`,
    bn: `রেকর্ডে দুটি তারিখ আছে (${d.value} বনাম ${alt.value})। সময়সীমা দেখানোর আগে একটি ট্রিগার নিশ্চিত করুন।`,
  }, "delivery_date");
}

/** Build all applicable clocks for a case. */
export function buildDeadlineClocks(c: CaseRecord, now = new Date()): DeadlineClock[] {
  const clocks: DeadlineClock[] = [];
  const delivery = fact(c, "delivery_date");
  const alt = fact(c, "delivery_date_alt");
  const pay = c.paymentChannel ?? "UNKNOWN";

  if (c.channel === "other") {
    clocks.push(
      na("CRPA_S60_30D", { en: "CRPA s.60 (30 days)", bn: "সিআরপিএ ধারা ৬০ (৩০ দিন)" }, "CRPA-60", {
        en: "Not calculated for out-of-scope cases.",
        bn: "আওতার বাইরের মামলার জন্য হিসাব করা হয়নি।",
      })
    );
    return clocks;
  }

  // ——— DARAZ_RETURN_14D ———
  if (c.channel === "daraz") {
    const name: Bi = { en: "Marketplace return (14 days)", bn: "মার্কেটপ্লেস রিটার্ন (১৪ দিন)" };
    if (alt && delivery?.value && alt.value !== delivery.value && delivery.status !== "confirmed") {
      clocks.push(conflictRefuse("DARAZ_RETURN_14D", name, "DARAZ-RETURN", delivery, alt));
    } else if (!triggerOk(delivery)) {
      clocks.push(
        refused(
          "DARAZ_RETURN_14D",
          name,
          "DARAZ-RETURN",
          {
            en: "Delivery date unconfirmed — marketplace 14-day window not calculated.",
            bn: "ডেলিভারির তারিখ নিশ্চিত নয় — মার্কেটপ্লেসের ১৪ দিনের হিসাব স্থগিত।",
          },
          "delivery_date"
        )
      );
    } else {
      clocks.push(
        computed("DARAZ_RETURN_14D", name, "DARAZ-RETURN", delivery, 14, now, {
          en: "Unused item, tags intact; SIM/Wi-Fi activated phones may be excluded — check order page.",
          bn: "অব্যবহৃত পণ্য, ট্যাগসহ; সিম/ওয়াই-ফাই চালু ফোন বাদ থাকতে পারে — অর্ডার পেজ দেখুন।",
        })
      );
    }
  }

  // ——— CRPA_S60_30D ———
  {
    const name: Bi = { en: "CRPA s.60 complaint (30 days)", bn: "সিআরপিএ ধারা ৬০ অভিযোগ (৩০ দিন)" };
    if (alt && delivery?.value && alt.value !== delivery.value && delivery.status !== "confirmed") {
      clocks.push(conflictRefuse("CRPA_S60_30D", name, "CRPA-60", delivery, alt));
    } else if (!triggerOk(delivery)) {
      clocks.push(
        refused(
          "CRPA_S60_30D",
          name,
          "CRPA-60",
          {
            en: "No confirmed cause-of-action date. Confirm delivery (or rejection) date to compute the 30-day statutory window.",
            bn: "নিশ্চিত কারণ-উদ্ভব তারিখ নেই। ৩০ দিনের আইনি সময়সীমা হিসাব করতে ডেলিভারি (বা বাতিল) তারিখ নিশ্চিত করুন।",
          },
          "delivery_date"
        )
      );
    } else {
      clocks.push(
        computed("CRPA_S60_30D", name, "CRPA-60", delivery, 30, now, {
          en: "Assumes cause of action arose on delivery; a reviewer should confirm the trigger.",
          bn: "ধরে নেওয়া হয়েছে ডেলিভারিতে কারণ উদ্ভূত; পর্যালোচক ট্রিগার নিশ্চিত করবেন।",
        })
      );
    }
  }

  // ——— CRPA_S61_90D (only after DNCRP filed — we don't track that yet → N/A) ———
  clocks.push(
    na("CRPA_S61_90D", { en: "CRPA s.61 magistrate (90 days)", bn: "সিআরপিএ ধারা ৬১ ম্যাজিস্ট্রেট (৯০ দিন)" }, "CRPA-61", {
      en: "Applies only after a written DNCRP s.60 complaint is filed.",
      bn: "লিখিত ডিএনসিআরপি ধারা ৬০ অভিযোগ দাখিলের পরেই প্রযোজ্য।",
    })
  );

  // ——— DCOG_COMPLAINT_72H ———
  {
    const name: Bi = { en: "DCOG seller reply (72 hours)", bn: "ডিসিওজি বিক্রেতা জবাব (৭২ ঘণ্টা)" };
    clocks.push(
      na("DCOG_COMPLAINT_72H", name, "DCOG-3.4.2", {
        en: "Guideline (policy, not statute). Starts when a written seller complaint is confirmed — not yet tracked as a confirmed fact.",
        bn: "নির্দেশিকা (নীতি, আইন নয়)। লিখিত বিক্রেতা অভিযোগ নিশ্চিত হলে শুরু — এখনো নিশ্চিত তথ্য হিসেবে নেই।",
      })
    );
  }

  // ——— DCOG_REFUND_10D ———
  clocks.push(
    na("DCOG_REFUND_10D", { en: "DCOG same-channel refund (10 days)", bn: "ডিসিওজি একই চ্যানেলে ফেরত (১০ দিন)" }, "DCOG-3.5.1", {
      en: "Guideline. VERIFY clause numbering against Gazette 40432_35501.pdf before relying publicly.",
      bn: "নির্দেশিকা। প্রকাশ্যে নির্ভরের আগে গেজেট ৪০৪৩২_৩৫৫০১.pdf-এ ধারা নম্বর VERIFY করুন।",
    })
  );

  // ——— DNCRP_TARGET_60WD ———
  clocks.push(
    na("DNCRP_TARGET_60WD", { en: "DNCRP target (60 working days)", bn: "ডিএনসিআরপি লক্ষ্য (৬০ কর্মদিবস)" }, "DNCRP-FILE", {
      en: "Administrative target after filing — not a statutory bar.",
      bn: "দাখিলের পর প্রশাসনিক লক্ষ্য — আইনি বাধা নয়।",
    })
  );

  // ——— Payment overlays ———
  if (pay === "CARD_DEBIT_CREDIT") {
    const name: Bi = { en: "Card chargeback (60–120 days)", bn: "কার্ড চার্জব্যাক (৬০–১২০ দিন)" };
    if (!triggerOk(delivery)) {
      clocks.push(
        refused(
          "CARD_CHARGEBACK",
          name,
          "BB-PAYMENT",
          {
            en: "Confirm transaction/delivery date; issuing-bank window is typically 60–120 days (VERIFY).",
            bn: "লেনদেন/ডেলিভারি তারিখ নিশ্চিত করুন; ইস্যুয়িং ব্যাংকের সময়সীমা সাধারণত ৬০–১২০ দিন (VERIFY)।",
          },
          "delivery_date"
        )
      );
    } else {
      // Advisory range: show 60-day early edge as computed advisory
      const due60 = addDaysIso(delivery.value, 60);
      const left = daysBetween(todayIso(now), due60);
      clocks.push({
        clockId: "CARD_CHARGEBACK",
        name,
        authorityId: "BB-PAYMENT",
        triggerFactKey: "delivery_date",
        triggerDate: delivery.value,
        dueDate: due60,
        daysRemaining: left,
        status: clockStatus(due60, now),
        note: {
          en: `Issuing-bank chargeback window is typically 60–120 days from ${delivery.value}. Confirm with your bank (VERIFY). Early edge shown: ${due60}.`,
          bn: `${delivery.value} থেকে সাধারণত ৬০–১২০ দিন। আপনার ব্যাংকের সঙ্গে নিশ্চিত করুন (VERIFY)। আগের সীমা: ${due60}।`,
        },
      });
    }
  }

  if (pay === "MFS_BKASH" || pay === "MFS_NAGAD" || pay === "MFS_ROCKET") {
    clocks.push({
      clockId: "BANGLA_QR_45D",
      name: { en: "MFS / Bangla QR dispute (advisory)", bn: "এমএফএস / বাংলা কিউআর বিরোধ (পরামর্শমূলক)" },
      authorityId: "BB-PAYMENT",
      status: "NOT_APPLICABLE",
      note: {
        en:
          pay === "MFS_BKASH"
            ? "Report TxID to bKash 16247 promptly; escalate unresolved tickets to BB CIPC 16236. Bangla QR merchant path: 45-day NPSB DMS (VERIFY circular)."
            : pay === "MFS_NAGAD"
              ? "Report TxID to Nagad 16167; escalate to BB CIPC 16236 if unresolved."
              : "Report via Rocket support channels; escalate to BB CIPC 16236 if unresolved.",
        bn:
          pay === "MFS_BKASH"
            ? "বিকাশ ১৬২৪৭-এ TxID জানান; অমীমাংসিত টিকিট বিবি সিআইপিসি ১৬২৩৬-এ তুলুন।"
            : pay === "MFS_NAGAD"
              ? "নগদ ১৬১৬৭-এ TxID জানান; অমীমাংসিত হলে বিবি সিআইপিসি ১৬২৩৬।"
              : "রকেট সাপোর্টে জানান; অমীমাংসিত হলে বিবি সিআইপিসি ১৬২৩৬।",
      },
    });
  }

  return clocks;
}

/** Legacy Roadmap.deadline summary from CRPA_S60 clock. */
export function legacyDeadlineFromClocks(clocks: DeadlineClock[]): Roadmap["deadline"] {
  const s60 = clocks.find((c) => c.clockId === "CRPA_S60_30D");
  if (!s60) return { state: "not_applicable", note: { en: "Not applicable.", bn: "প্রযোজ্য নয়।" } };
  if (s60.status === "REFUSED_UNCONFIRMED_TRIGGER") {
    const conflict = /conflict|দুটি তারিখ/i.test(s60.refusalReason?.en ?? s60.note.en);
    return {
      state: conflict ? "conflict" : "needs_trigger",
      note: s60.refusalReason ?? s60.note,
    };
  }
  if (s60.status === "NOT_APPLICABLE") return { state: "not_applicable", note: s60.note };
  return { state: "computed", date: s60.dueDate, note: s60.note };
}

export function paymentNeedsOverlay(pay: PaymentChannel): boolean {
  return pay !== "UNKNOWN" && pay !== "CASH_ON_DELIVERY";
}

/** Exported for tests — hours helper unused for calendar clocks. */
export function hoursBetween(aIso: string, bIso: string): number {
  return (new Date(bIso).getTime() - new Date(aIso).getTime()) / 3600000;
}

// silence unused FactKey import warning if tree-shaken oddly
export type _FactKey = FactKey;
