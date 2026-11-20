/** Bengali numerals + BST date helpers (plan §10). */
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;

export function toBnDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);
}

export function fromBnDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
}

const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
] as const;

/** Format ISO date YYYY-MM-DD for display. */
export function formatDateDisplay(iso: string, lang: "bn" | "en"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (lang === "en") {
    return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return `${toBnDigits(d)} ${BN_MONTHS[mo - 1]} ${toBnDigits(y)}`;
}

export function formatDaysLeft(n: number, lang: "bn" | "en"): string {
  if (lang === "bn") return `${toBnDigits(Math.abs(n))} দিন ${n < 0 ? "আগে" : "বাকি"}`;
  return n < 0 ? `${-n} day(s) ago` : `${n} day(s) left`;
}
