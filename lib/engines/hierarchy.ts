/**
 * Authority hierarchy + Bangla-prevails enforcement (plan §6 / §9 Pass 1).
 */
import type { Authority, AuthorityStrength, Bi, Finding, Pass2Verdict } from "../types";

export const STRENGTH_RANK: Record<AuthorityStrength, 1 | 2 | 3 | 4 | 5 | 6> = {
  STATUTE: 1,
  DELEGATED_LEGISLATION: 2,
  GUIDELINE: 3,
  OFFICIAL_FILING_INSTRUCTION: 4,
  PLATFORM_POLICY: 5,
  TRANSACTION_EVIDENCE: 6,
};

export function strengthFromLegacyType(type: Authority["type"]): AuthorityStrength {
  switch (type) {
    case "statute":
      return "STATUTE";
    case "delegated":
      return "DELEGATED_LEGISLATION";
    case "gazette":
      return "GUIDELINE";
    case "filing_instruction":
      return "OFFICIAL_FILING_INSTRUCTION";
    case "marketplace_policy":
      return "PLATFORM_POLICY";
    default:
      return "TRANSACTION_EVIDENCE";
  }
}

export function normalizeAuthority(a: Authority): Authority {
  const strength = a.strength ?? strengthFromLegacyType(a.type);
  return {
    ...a,
    strength,
    hierarchyRank: a.hierarchyRank ?? STRENGTH_RANK[strength],
  };
}

/** CRPA s.82(2): Bangla statutory text prevails over English translation. */
export const BANGLA_PREVAILS: Bi = {
  en: "Under CRPA s.82(2), the Bangla statutory text prevails if it conflicts with an English translation.",
  bn: "সিআরপিএ ধারা ৮২(২) অনুযায়ী, ইংরেজি অনুবাদের সঙ্গে দ্বন্দ্ব থাকলে বাংলা আইনের পাঠ প্রাধান্য পাবে।",
};

const CRIME_CLAIM =
  /\b(criminal|offence|offense|punishable|imprisonment|jail|felony)\b/i;

/**
 * Reject findings that treat GUIDELINE / PLATFORM_POLICY as statutory criminal law.
 */
export function checkHierarchyClaim(
  claimText: string,
  strength: AuthorityStrength
): { ok: boolean; verdict?: Pass2Verdict; reason?: Bi } {
  if (
    (strength === "GUIDELINE" || strength === "PLATFORM_POLICY") &&
    CRIME_CLAIM.test(claimText)
  ) {
    return {
      ok: false,
      verdict: "FLAG_HIERARCHY",
      reason: {
        en: `${strength} cannot be framed as a statutory criminal offence. Treat as policy/compliance context supporting (not replacing) CRPA review.`,
        bn: `${strength} কে আইনি ফৌজদারি অপরাধ বলা যাবে না। এটি নীতি/কমপ্লায়েন্স প্রসঙ্গ; সিআরপিএ পর্যালোচনার বিকল্প নয়।`,
      },
    };
  }
  return { ok: true };
}

/** Platform policy cannot waive CRPA statutory filing rights. */
export function platformCannotWaiveStatute(note: string): Bi | null {
  if (/no\s+refund|cannot\s+complain|waive.*right|bar.*dncrp|bar.*crpa/i.test(note)) {
    return {
      en: "A platform or seller clause cannot waive statutory rights under CRPA 2009.",
      bn: "প্ল্যাটফর্ম বা বিক্রেতার ধারা সিআরপিএ ২০০৯-এর আইনি অধিকার মওকুফ করতে পারে না।",
    };
  }
  return null;
}

export function applyHierarchyToFinding(
  f: Finding,
  authorities: Authority[]
): Finding {
  const primary = authorities.find((a) => f.authorityIds.includes(a.id));
  if (!primary) return f;
  const strength = primary.strength ?? strengthFromLegacyType(primary.type);
  const claim = `${f.risk.en} ${f.title.en}`;
  const check = checkHierarchyClaim(claim, strength);
  let next: Finding = { ...f, authorityStrength: strength };
  if (!check.ok) {
    next = {
      ...next,
      status: "review",
      pass2Verdict: check.verdict,
      statusReason: check.reason!,
      pass2Note: check.reason,
    };
  }
  if (primary.verifyRequired) {
    next = {
      ...next,
      statusReason: {
        en: `${next.statusReason.en} VERIFY: authority ${primary.id} awaits legal reviewer sign-off.`,
        bn: `${next.statusReason.bn} VERIFY: কর্তৃপক্ষ ${primary.id} আইনি পর্যালোচকের অনুমোদন অপেক্ষমাণ।`,
      },
    };
  }
  if (strength === "STATUTE") {
    next = {
      ...next,
      assumptions: {
        en: `${next.assumptions.en} ${BANGLA_PREVAILS.en}`,
        bn: `${next.assumptions.bn} ${BANGLA_PREVAILS.bn}`,
      },
    };
  }
  return next;
}
