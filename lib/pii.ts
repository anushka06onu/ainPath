const ASCII_DIGITS = "0123456789";
const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";
const NUMBER = /[0-9০-৯](?:[0-9০-৯ -]*[0-9০-৯])?/g;
const EMAIL = /[\w.+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const PAYMENT_REFERENCE = /\b(?:TrxID|TxnID|Transaction\s*ID)\s*[:=]?\s*[A-Z0-9]{8,}\b/gi;

export function redactPii(text: string): string {
  return text
    .replace(EMAIL, "[email removed]")
    .replace(PAYMENT_REFERENCE, "[transaction reference removed]")
    .replace(NUMBER, (value, offset: number, source: string) => {
      const digits = value.replace(/[০-৯]/g, (d) => ASCII_DIGITS[BANGLA_DIGITS.indexOf(d)]).replace(/[^0-9]/g, "");
      const phone = /^(?:880|0)1[3-9]\d{8}$/.test(digits);
      if (phone) return "[phone removed]";
      if ([10, 13, 16, 17].includes(digits.length)) return "[identifier removed]";
      if (source[offset - 1] === "+" && digits.startsWith("880")) return "[phone removed]";
      return value;
    });
}
