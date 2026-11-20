import type { EvidencePage } from "./types";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function normalizeDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/** Whitespace/digit-insensitive form used for quote matching. */
export function normForMatch(s: string): string {
  return normalizeDigits(s)
    .normalize("NFC")
    .replace(/[\u200b\u200c\u200d]/g, "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const INJECTION = [
  /ignore (all |any )?(the )?(previous|prior|above) (instructions|rules)/i,
  /disregard (the )?(previous|above|system)/i,
  /you are now/i,
  /system prompt/i,
  /submit (the )?(complaint|form) (automatically|now)/i,
  /(open|navigate to|go to) https?:\/\//i,
  /reveal (your )?(prompt|key|instructions)/i,
  /পূর্ববর্তী নির্দেশ(না)? (উপেক্ষা|অগ্রাহ্য)/,
];

export function looksLikeInjection(text: string): boolean {
  return INJECTION.some((r) => r.test(text));
}

export async function extractPdf(
  buf: Buffer,
  maxPages: number
): Promise<{ pages: EvidencePage[]; truncated: boolean; total: number }> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const arr = (Array.isArray(text) ? text : [text]).slice(0, maxPages);
  const pages = arr.map((raw, i) => cleanPdfPage(raw, i + 1));
  return { pages, truncated: totalPages > maxPages, total: totalPages };
}

export const UNREADABLE_LINE = "[unreadable line — please correct]";

/**
 * Some PDF fonts lose their Unicode mapping for Bengali conjuncts and extraction yields NUL
 * characters. Lines with such damage are replaced by a visible marker and page confidence drops,
 * so the UI can ask the user to correct them instead of silently analysing garbage.
 */
export function cleanPdfPage(raw: string, page: number): EvidencePage {
  const lines = raw.replace(/[ \t]+\n/g, "\n").split("\n");
  let bad = 0;
  let total = 0;
  const out = lines.map((l) => {
    if (!l.trim()) return l;
    total++;
    const nul = (l.match(/\u0000/g) || []).length;
    if (nul >= 2) {
      bad++;
      return UNREADABLE_LINE;
    }
    return l.replace(/\u0000/g, "");
  });
  const confidence = total ? Math.max(0.2, 1 - bad / total) : 1;
  return { page, text: out.join("\n").trim(), confidence: Number(confidence.toFixed(2)) };
}

export async function extractImage(buf: Buffer): Promise<EvidencePage[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("ben+eng");
  try {
    const { data } = await worker.recognize(buf);
    return [
      {
        page: 1,
        text: (data.text || "").trim(),
        confidence: Math.max(0, Math.min(1, (data.confidence ?? 0) / 100)),
      },
    ];
  } finally {
    await worker.terminate();
  }
}

export function extractPlain(text: string): EvidencePage[] {
  return [{ page: 1, text: text.trim(), confidence: 1 }];
}

/** Find which page of a set contains a (normalised) quote. */
export function findQuotePage(pages: EvidencePage[], quote: string): number | null {
  const q = normForMatch(quote);
  if (!q) return null;
  for (const p of pages) if (normForMatch(p.text).includes(q)) return p.page;
  return null;
}
