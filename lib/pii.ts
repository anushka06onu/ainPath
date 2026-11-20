/**
 * PII redaction before logs / external LLM prompts (PDPA 2026 alignment).
 */
const NID = /\b(?:\d{10}|\d{13}|\d{17})\b/g;
const PHONE = /(?:\+?880|0)1[3-9]\d{8}\b/g;
const CARD = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const MFS = /\b(?:TrxID|TxnID|Transaction\s*ID)\s*[:=]?\s*[A-Z0-9]{8,}\b/gi;

export function redactPii(text: string): string {
  return text
    .replace(CARD, (m) => `****${m.replace(/\D/g, "").slice(-4)}`)
    .replace(PHONE, (m) => `***${m.slice(-4)}`)
    .replace(NID, (m) => `NID-***${m.slice(-4)}`)
    .replace(MFS, (m) => {
      const digits = m.replace(/\W/g, "");
      return `TrxID-***${digits.slice(-4)}`;
    });
}

export function countRedactions(original: string, redacted: string): number {
  if (original === redacted) return 0;
  // rough: count *** markers added
  return (redacted.match(/\*{3}/g) ?? []).length;
}
