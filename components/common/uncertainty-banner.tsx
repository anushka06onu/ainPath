"use client";

import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export type UncertaintyKind =
  | "conflicting_dates"
  | "missing_proof"
  | "weak_support"
  | "stale_policy"
  | "ocr_injection"
  | "out_of_scope";

const COPY: Record<UncertaintyKind, { en: string; bn: string }> = {
  conflicting_dates: {
    en: "Conflicting dates are on record. Deadlines stay refused until you confirm one trigger on the facts screen.",
    bn: "রেকর্ডে দ্বন্দ্বমূলক তারিখ আছে। একটি ট্রিগার নিশ্চিত না করা পর্যন্ত সময়সীমা স্থগিত।",
  },
  missing_proof: {
    en: "Required proof is missing (e.g. receipt/TrxID). This step cannot be marked source-confirmed yet.",
    bn: "প্রয়োজনীয় প্রমাণ নেই (যেমন রসিদ/TxID)। এই ধাপ এখনো source-confirmed নয়।",
  },
  weak_support: {
    en: "Pass 2 or hierarchy checks flagged weak legal support. See Unresolved items in the memo — nothing is hidden.",
    bn: "পাস ২ বা অনুক্রম দুর্বল আইনি ভিত্তি চিহ্নিত করেছে। স্মারকের অমীমাংসিত অংশে দেখুন — কিছু লুকানো নেই।",
  },
  stale_policy: {
    en: "An official link was flagged stale/unreachable. Showing the pinned snapshot — VERIFY live portal before filing.",
    bn: "সরকারি লিংক পুরনো/অপ্রাপ্য চিহ্নিত। পিন করা স্ন্যাপশট দেখানো হচ্ছে — দাখিলের আগে লাইভ পোর্টাল VERIFY করুন।",
  },
  ocr_injection: {
    en: "Hidden or instruction-like text was quarantined in an upload. Treated strictly as untrusted evidence.",
    bn: "আপলোডে লুকানো/নির্দেশমূলক লেখা আলাদা করা হয়েছে। শুধু অবিশ্বস্ত প্রমাণ হিসেবে রাখা।",
  },
  out_of_scope: {
    en: "Outside prototype scope. Civil remedies (CRPA ss.66–67) or advocate referral may apply — AinPath will not force a Daraz/DNCRP step.",
    bn: "প্রোটোটাইপের আওতার বাইরে। দেওয়ানি প্রতিকার (ধারা ৬৬–৬৭) বা আইনজীবী রেফারেল হতে পারে।",
  },
};

export function UncertaintyBanner({
  kind,
  className,
}: {
  kind: UncertaintyKind;
  className?: string;
}) {
  const { lang } = useI18n();
  const text = COPY[kind][lang];
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border border-[color-mix(in_oklch,var(--warn)_35%,var(--border))] bg-[color-mix(in_oklch,var(--warn)_10%,transparent)] px-4 py-3 text-sm",
        className
      )}
    >
      <p className="font-medium">{lang === "bn" ? "সতর্কতা" : "Attention"}</p>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </div>
  );
}
