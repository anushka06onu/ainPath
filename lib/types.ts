export type Lang = "bn" | "en";
export type Bi = { bn: string; en: string };
export type Channel = "daraz" | "facebook" | "other";

/** Payment overlay used by RouteEngine (plan §11.2). */
export type PaymentChannel =
  | "MFS_BKASH"
  | "MFS_NAGAD"
  | "MFS_ROCKET"
  | "CARD_DEBIT_CREDIT"
  | "CASH_ON_DELIVERY"
  | "PLATFORM_WALLET"
  | "UNKNOWN";

export type ProcessingMode = "LOCAL_OFFLINE" | "CLOUD_REGIONAL";

export type FactStatus = "candidate" | "confirmed" | "disputed" | "unreadable" | "missing";

export type FactKey =
  | "item_ordered"
  | "item_received"
  | "seller"
  | "order_date"
  | "delivery_date"
  | "delivery_date_alt"
  | "rejection_reason"
  | "prior_action"
  | "has_receipt"
  | "chat_context"
  | "delivery_estimate_in_order";

export interface Fact {
  key: FactKey;
  value: string; // normalised, language-neutral where possible (e.g. "yes"/"no", ISO date)
  status: FactStatus;
  evidenceIds: string[];
  /** where the value came from, shown to the user */
  source: "user" | "model" | "document" | "rule";
}

export type EvidenceKind =
  | "terms"
  | "order"
  | "chat"
  | "receipt"
  | "rejection"
  | "delivery"
  | "other";

export interface EvidencePage {
  page: number;
  text: string;
  /** 0..1; 1 for born-digital text, lower for OCR */
  confidence: number;
}

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  filename: string;
  mime: string;
  sha256: string;
  bytes: number;
  pages: EvidencePage[];
  extraction: "text" | "ocr" | "manual" | "failed";
  /** user-corrected text overrides OCR output */
  corrected?: boolean;
  /** suspected prompt injection found in the document text */
  injectionFlag?: boolean;
  createdAt: string;
}

/** Plan authority_strength ranks 1–6. */
export type AuthorityStrength =
  | "STATUTE"
  | "DELEGATED_LEGISLATION"
  | "GUIDELINE"
  | "OFFICIAL_FILING_INSTRUCTION"
  | "PLATFORM_POLICY"
  | "TRANSACTION_EVIDENCE";

export interface Authority {
  id: string;
  type: "statute" | "gazette" | "filing_instruction" | "marketplace_policy" | "delegated";
  /** Prefer strength; type kept for backwards UI. */
  strength: AuthorityStrength;
  hierarchyRank: 1 | 2 | 3 | 4 | 5 | 6;
  title: Bi;
  section: string;
  jurisdiction: string;
  version: string;
  dateChecked: string;
  url: string;
  urlStatus?: "OK" | "STALE" | "UNREACHABLE";
  /** verbatim = quoted from official text; paraphrase = secondary summary, reviewer must check */
  textKind: "verbatim" | "paraphrase";
  passage: string;
  passageBn?: string;
  neighbours?: string;
  /** Legal reviewer must VERIFY before public citation. */
  verifyRequired?: boolean;
  /** "terms": may be cited when reviewing a seller's Terms of Sale */
  scope?: "terms";
}

export type VerificationStatus =
  | "verified"
  | "unresolved"
  | "review"
  | "disputed_fact_dependent"
  | "rejected_ungrounded";

export type Pass2Verdict =
  | "PASS"
  | "FLAG_MISGROUNDED"
  | "FLAG_HIERARCHY"
  | "FLAG_MISSING_EXCEPTION"
  | "SKIPPED";

export interface Finding {
  id: string;
  title: Bi;
  risk: Bi; // what the problem is
  riskCategory?:
    | "DELIVERY_UNCLEAR"
    | "PRIVACY_CONSENT"
    | "WARRANTY_CONFLICT"
    | "TERMS_NOT_BANGLA"
    | "SUBSTITUTION_DISPUTE"
    | "ADVANCE_ESCROW"
    | "OTHER";
  anchor: { evidenceId: string; page: number; quote: string };
  secondAnchor?: { evidenceId: string; page: number; quote: string };
  authorityIds: string[];
  authorityQuote: string;
  authorityStrength?: AuthorityStrength;
  counterpoint: Bi;
  assumptions: Bi;
  nextCheck: Bi;
  status: VerificationStatus;
  statusReason: Bi;
  pass2Verdict?: Pass2Verdict;
  pass2Note?: Bi;
  origin: "model" | "rules" | "both";
}

export interface RouteStep {
  id: string;
  /** which facts this step depends on */
  dependsOn: FactKey[];
  kind: "official" | "evidence" | "review" | "info";
  label: "source_confirmed" | "depends_on_disputed" | "needs_review";
  title: Bi;
  detail: Bi;
  where?: { label: Bi; url?: string };
  attach: Bi[];
  caveat?: Bi;
  authorityIds: string[];
}

export type ClockId =
  | "DARAZ_RETURN_14D"
  | "CRPA_S60_30D"
  | "CRPA_S61_90D"
  | "DCOG_COMPLAINT_72H"
  | "DCOG_REFUND_10D"
  | "DNCRP_TARGET_60WD"
  | "CARD_CHARGEBACK"
  | "BANGLA_QR_45D";

export type ClockStatus =
  | "ACTIVE"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "REFUSED_UNCONFIRMED_TRIGGER"
  | "NOT_APPLICABLE";

export interface DeadlineClock {
  clockId: ClockId;
  name: Bi;
  authorityId: string;
  triggerFactKey?: string;
  triggerDate?: string;
  dueDate?: string;
  daysRemaining?: number;
  status: ClockStatus;
  note: Bi;
  refusalReason?: Bi;
}

export interface Roadmap {
  routeId: string;
  headline: Bi;
  steps: RouteStep[];
  /** Dual/multi clocks — never merge into one countdown. */
  clocks: DeadlineClock[];
  /** Legacy single CRPA s.60 summary for older UI / export. */
  deadline: {
    state: "computed" | "needs_trigger" | "conflict" | "not_applicable";
    date?: string;
    note: Bi;
  };
}

export interface ConsentRecord {
  version: string;
  processingMode: ProcessingMode;
  cloudRegion: string | null;
  purposes: string[];
  sensitiveDataAck: boolean;
  retentionDays: number;
  grantedAt: string;
  withdrawnAt?: string;
}

export interface PipelineRunSnapshot {
  id: string;
  parentRunId?: string;
  status: "queued" | "running" | "completed" | "failed";
  inputManifestHash: string;
  stageHashes: Record<string, string>;
  reusedStages: string[];
  recomputedStages: string[];
  roadmap: Roadmap;
  findings: Finding[];
  createdAt: string;
  latencyMs?: number;
}

export interface Position {
  side: "buyer" | "seller";
  claim: Bi;
  support: Bi[];
  missing: Bi[];
  authorityIds: string[];
}

export interface AgentRun {
  agent: "intake" | "research" | "review" | "verify" | "verify_p2" | "deadlines" | "routes";
  status: "idle" | "running" | "done" | "fallback" | "error";
  model: string;
  inputHash: string;
  ms: number;
  note?: string;
  at: string;
}

export interface Analysis {
  findings: Finding[];
  positions: Position[];
  counterpoints: { findingId: string; text: Bi }[];
  runs: AgentRun[];
  evidenceHash: string;
  factsHash: string;
  runId?: string;
  baseRunId?: string;
  createdAt: string;
}

export interface Question {
  key: FactKey;
  affectsRoute: boolean;
}

/** Contact details collected before PDF export for the complaint draft. */
export interface ReporterDetails {
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  orderRef?: string;
}

export interface IntakeCandidate {
  value: string;
  evidenceIds: string[];
}

export interface PipelineCache {
  intake?: {
    hash: string;
    candidates: Partial<Record<FactKey, IntakeCandidate>>;
    run: AgentRun;
  };
  terms?: {
    hash: string;
    findings: Finding[];
    runs: AgentRun[];
  };
  pass2?: {
    hash: string;
    findings: Finding[];
    run: AgentRun;
  };
  roadmap?: {
    hash: string;
    deadlineHash: string;
    value: Roadmap;
  };
}

export interface CaseRecord {
  id: string;
  caseCode?: string;
  lang: Lang;
  channel: Channel;
  paymentChannel: PaymentChannel;
  processingMode: ProcessingMode;
  story: string;
  facts: Fact[];
  evidence: Evidence[];
  analysis?: Analysis;
  consent?: ConsentRecord;
  runs?: PipelineRunSnapshot[];
  activeRunId?: string;
  retentionExpiresAt?: string;
  approvedAt?: string;
  reporter?: ReporterDetails;
  fixture?: string;
  demoModelEligible?: boolean;
  pipelineCache?: PipelineCache;
  createdAt: string;
  updatedAt: string;
}

export interface CaseView extends Omit<CaseRecord, "pipelineCache" | "demoModelEligible"> {
  roadmap: Roadmap;
  authorities: Authority[];
  limits: { maxMb: number; maxPages: number; maxFiles: number };
  llm: { enabled: boolean; model: string };
}
