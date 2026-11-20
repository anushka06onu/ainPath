"use client";

import type { AuthorityStrength } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL: Record<AuthorityStrength, { en: string; bn: string }> = {
  STATUTE: { en: "Statute", bn: "আইন" },
  DELEGATED_LEGISLATION: { en: "Delegated", bn: "প্রতিনিধিত্বমূলক" },
  GUIDELINE: { en: "Guideline (policy)", bn: "নির্দেশিকা (নীতি)" },
  OFFICIAL_FILING_INSTRUCTION: { en: "Filing guide", bn: "দাখিল নির্দেশিকা" },
  PLATFORM_POLICY: { en: "Platform policy", bn: "প্ল্যাটফর্ম নীতি" },
  TRANSACTION_EVIDENCE: { en: "Evidence", bn: "প্রমাণ" },
};

export function AuthorityStrengthBadge({
  strength,
  lang = "en",
  className,
}: {
  strength: AuthorityStrength;
  lang?: "bn" | "en";
  className?: string;
}) {
  const tone =
    strength === "STATUTE"
      ? "border-[var(--ok)]/40 bg-[color-mix(in_oklch,var(--ok)_12%,transparent)]"
      : strength === "GUIDELINE" || strength === "PLATFORM_POLICY"
        ? "border-[var(--warn)]/40 bg-[color-mix(in_oklch,var(--warn)_10%,transparent)]"
        : "border-border bg-muted/40";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        tone,
        className
      )}
      title={strength}
    >
      <span aria-hidden>{strength === "STATUTE" ? "§" : strength === "GUIDELINE" ? "◉" : "•"}</span>
      {LABEL[strength][lang]}
    </span>
  );
}
