# AinPath — Hackathon Execution, Submission & Legal Verification Playbook

> **Event:** International AI Builders Congress 2026 (CloudCamp Bangladesh)  
> **Venue & Finale Date:** Daffodil International University (Ashulia, Dhaka) — **26 December 2026** (7:00 AM – 7:30 PM)  
> **Urgent Submission Gate Check:** Verify today (**20 Nov 2026**) whether your team's Idea-to-Unicorn preliminary form is submitted/extended on `cloudcampbd.com/ai-builders-congress` (site lists Idea-to-Unicorn preliminary close Nov 20, 2026; Zero-to-Launch Nov 30, 2026).

---

## 1. Competitor Analysis & Testable Differentiation

| Competitor / Existing Service | Verified Public Functionality (2026) | Gap AinPath Closes | Testable Differentiation Metric |
|---|---|---|---|
| **Daraz Bangladesh Returns** (`pages.daraz.com.bd`) | 14-day return window from delivery across marketplace (extended from 7d on Oct 23, 2025); refunds in 1–10 working days; rejected parcels returned in 6–8d (scrapped after 3 failed attempts). | Explains *why* a return is rejected vs order/chat evidence, checks category exclusions (e.g. SIM-activated phone), and bridges to DNCRP s.60 when platform fails. | Paired rejection tests prove roadmap flips cleanly between `DARAZ_IN_APP_RETURN` and `DARAZ_REJECTION_FOLLOWUP` + `DNCRP_CCMS_WRITTEN`. |
| **DNCRP CCMS Portal** (`dncrp.com`, `dncrp.gov.bd`, Hotline `16121`) | Free written consumer complaint portal; SMS tracking; 60 working days target; `16121` for advice only. | Users struggle to organize timelines, separate statutory violations from policy complaints, and notice the strict **30-day s.60 window** or missing receipt gaps. | Draft pack maps evidence IDs + dates directly to CCMS required fields and blocks unconfirmed deadline math. |
| **AdalotBD** (`adalotbd.com/en`) | Plain-Bangla cited Q&A across 52,000+ sections + guided flows + printable DNCRP consumer complaint template. | Static template & Q&A—does **not** parse the buyer's raw Terms of Sale PDF, run side-by-side chat dispute analysis, or dynamically recompute changed-fact roadmaps. | AinPath audits uploaded seller PDFs with 3 page-anchored findings AND updates route lines when one chat message flips. |
| **Mina** (*arXiv:2511.08605*, Apr 2026) | Academic 2-stage LangGraph RAG legal assistant passing BD Bar Council exams (75–80%) across 595 Acts; colonial/Farsi dictionary. | General legal QA/petition assistant; lacks e-commerce dual deadline engines, OCR confidence correction UI, or buyer-vs-seller contract clause comparison. | AinPath enforces deterministic deadline refusal, authority-strength ranks, and 2-pass quote/entailment verification. |
| **FindmyAdvocate** (`findmyadvocatebd.com`) | AI legal chat + lawyer directory & consultation booking across BD districts. | Lead-gen to advocate booking rather than free pre-filing triage, evidence indexing, or payment-channel (bKash/card/COD) routing for micro-disputes. | AinPath solves sub-Tk 10k consumer disputes without lawyer fees, routing only `OUT_OF_SCOPE` / s.66 civil suits to advocates. |
| **JusticeNetBD** (*Preprints 202507.0475*) | English-first Streamlit beta RAG focused on Bangladeshi women's legal rights (Recall@2=0.90). | Narrow women's-rights domain, English-only initial beta, single-threaded Streamlit Cloud scalability limits. | AinPath is Bangla/Banglish-first for digital commerce, with Next.js + FastAPI cloud architecture & interactive evidence viewer. |
| **LawHelp Interactive** (`lawhelpinteractive.org`) | US non-profit HotDocs/A2J guided interviews for court form assembly. | Form assembly from user Q&A without auditing counterparty terms PDFs or verifying opposing evidence claims. | Couples guided fact confirmation with an adversarial compliance audit of uploaded seller terms on one case record. |

---

## 2. Market Evidence for the Pitch (Dated & Verified)

1. **58,720 e-commerce complaints, Tk 3,869 crore claimed:** Stated in Parliament by Commerce Minister Khandaker Abdul Muktadir on **30 August 2026** (*The Business Standard* & *Dhaka Tribune*); Tk 472 crore of Tk 531 crore stuck in payment gateways refunded via Ministry/DNCRP/Bangladesh Bank mediation.
2. **High historical backlog / unresolved share:**
   - By **end-2023**, DNCRP had received **34,667** e-commerce complaints: 15,225 settled and **19,442 unresolved (~56%)**, including 5,879 against Facebook-page sellers (*JagoNews24*).
   - By **31 July 2024**, DNCRP had received **35,437** compensation complaints and settled 16,667, leaving **18,770 unresolved (~53%)** (*The Daily Star*).
3. **Online shopping fraud dominates recent intake:** Nearly **61% of 52,459 DNCRP complaints** in the last cited fiscal year involved online-shopping fraud—non-delivery, counterfeit, or mismatch with advertisement (*Independent Television*, **22 October 2026**, cited by WiseNod **9 November 2026**).

---

## 3. Feature Triage: MVP, Phase 2, Future & Explicit Cuts

### Feature Roadmap
- **MVP (Must Work in Live Demo):**
  - *Bilingual Intake (Bangla / English / Banglish) + PDPA 2026 Consent Gate:* Captures channel, payment method, and narrative safely.
  - *PDF + Screenshot Pipeline + Evidence Viewer with OCR Override:* Extracts page anchors, flags `<0.75` Tesseract confidence, allows instant manual fix.
  - *Deterministic Dual-Clock Deadline Engine + Trigger Refusal:* Separates Daraz 14d, CRPA s.60 30d, DCOG 72h/10d, and refuses unconfirmed dates.
  - *4-Agent + 2-Pass Verification Pipeline + Authority Strength Badges:* Produces 3 page-linked memo findings with `STATUTE` vs `GUIDELINE` vs `PLATFORM_POLICY` separation and independent Pass 2 mis-grounding check.
  - *Channel + Payment-Aware Roadmap + Evidence-Sensitivity Diff View:* Supports Daraz rejection, Facebook shop (including Bangla-terms risk), bKash/Nagad/Card/COD overlays, and changed-line highlighting on fact flips.
  - *Human-Approved Bilingual Export:* Outputs editable DNCRP / Daraz draft, checklist, and reviewer memo (zero auto-submit).
- **Phase 2 (Post-Congress Pilot with Legal-Aid Partner):**
  - *Volunteer / Legal-Reviewer Queue & Annotation UI:* Multi-case clinic triage dashboard with reviewer sign-off workflow.
  - *Cloud Vision Escalation Toggle + Automated Corpus Monitor:* Opt-in Google Cloud Vision OCR for messy handwritten courier slips + weekly `dncrp.gov.bd` / Daraz URL drift alerts.
  - *Banglish-Tuned Dense Reranker (`bangla-embed-e5-small-banglish`):* Higher precision on informal Messenger romanized Bengali threads.
- **Future (Scale-Up):**
  - *Additional Storefronts & Categories:* Chaldal, Foodpanda, Pickaboo, Pathao Food, plus warranty/defective-service disputes beyond wrong-item.
  - *Bangla Speech-to-Text Intake (`Whisper` fine-tuned):* Accessible voice intake for low-literacy buyers.
  - *DBID / e-CAB Seller Registry Lookup:* Automated check of seller Digital Business ID status where public APIs exist.

### Explicit Cuts / Defers for the 5-Week Timeline
| Cut / Deferred Item | Reason for Cutting Before Dec 26 |
|---|---|
| **Voice input (Bangla ASR)** | Adds noisy audio preprocessing + hallucinated Bengali transcripts that destabilize exact model/date extraction; typed Bangla + Banglish + chat screenshots deliver cleaner demo reliability. |
| **Other storefronts (Chaldal, Pickaboo, etc.)** | Two well-tested channels (`DARAZ_BD` + `FACEBOOK_SHOP`) already prove marketplace vs unregulated social-commerce branching; more storefronts dilute legal corpus validation. |
| **Whole-document 100-page load tests** | Competition scope caps uploads at `<= 25 pages / 10 MB`; section-level chunking + parent context retrieval solves realistic 4–12 page BD Terms PDFs reliably. |
| **Any auto-submission to Daraz / DNCRP / BB** | Legal & ethical risk: CRPA s.76 & Dec 2025 Daily Star reporting emphasize complainant personal filing, CAPTCHA/OTP NID gates on `dncrp.com`, and liability under CRPA s.54 for false/unverified filings. |

### Non-Obvious Differentiators Judges Will Notice
1. **Evidence-Sensitivity Diff View (DAG Hash Replay):** Flipping one Messenger message (`Address Confirmation` ↔ `Substitution Approval`) skips unchanged OCR/Deadline stages and highlights the exact changed roadmap lines and memo statuses in `<10s`.
2. **Dual-Clock Trigger Refusal Guard:** Unlike generic chatbots that invent fake dates, AinPath explicitly *refuses* to compute deadlines when delivery/rejection dates conflict, displaying both sources side by side.
3. **Authority-Strength Enforcement in Code:** Prevents treating Ministry *Guidelines (2021)* or *Daraz Policy* as statutory criminal law, and enforces CRPA s.82(2) Bangla-text primacy.
4. **Independent Pass 2 Mis-Grounding Detector:** Separate model context checks whether a *real* statute section actually supports the claim (catching false-ad s.44 vs non-delivery s.45 swaps!).
5. **Untrusted-Document Prompt-Injection Quarantine:** Visible demonstration of hidden PDF white-text instructions stripped and flagged rather than corrupting the legal memo.

---

## 4. Week-by-Week Execution Plan (Nov 20 – Dec 26, 2026) — 4-Role Team

| Week | Dates | Legal & Content Lead | AI & Data Engineer | Product & Engineering (FE/BE) | Demo & Evaluation Lead |
|---|---|---|---|---|---|
| **W1** | Nov 20 – Nov 26 | Verify `VERIFY` checklist items against Bangla Gazette `40432_35501.pdf` & `bdlaws`; build corpus JSONs + 4-page bilingual Terms PDF fixture. | Design Pydantic schemas, hybrid search prototype (`FTS + bge-m3`), Bangla/Banglish normalizer & PII redactor. | Init monorepo (`backend` FastAPI + `frontend` Next.js 15), DB schema, Deadline & Route engines, Consent Modal + Screen 1. | Confirm CloudCamp submission status today; draft 12 Daraz + 12 Facebook test case specs; get independent reviewer onboarding. |
| **W2** | Nov 27 – Dec 3 | Label ground truth on 24 eval cases + 8 paired sensitivity cases + 3 main PDF risks; draft Bangla/English complaint templates. | Implement PyMuPDF + OpenCV + Tesseract `ben+eng` OCR + injection guard; tune chunker & retrieval recall. | Build Screen 2 Evidence Viewer (bounding boxes + manual OCR override), Screen 3 Facts UI, Case/Evidence APIs. | Measure real Tesseract `ben` accuracy on 10 sample BD invoices/terms to replace `~88%` assumption with measured baseline. |
| **W3** | Dec 4 – Dec 10 | Review first AI memo runs; flag mis-grounded citations & missing exceptions to harden Pass 2 prompts. | Implement 4-Agent Orchestrator, Input-Hash DAG caching, Pass 1 & Pass 2 Verifier, `LLMGateway` (local + Vertex regional). | Build Screen 4 Buyer/Seller Split + Citation Drawer, Screen 5 Roadmap + `DiffHighlighter`, Screen 6 Export + SSE stream. | Build automated `eval/run_eval.py`; run baseline comparison vs generic ChatGPT/Gemini prompt on 10 cases. |
| **W4** | Dec 11 – Dec 17 | Final audit of all exported Bangla/English drafts, disclaimers, and `VERIFY` tags; sign off on 1-page summary. | Freeze pinned corpus + quantized local GGUF (`qwen3-4b` + `gemma-3-4b`) + Vertex `asia-south1` API config. | Deploy Cloud Run + Cloud SQL (`ap-south-1`/`asia-south1`) + Cloudflare/Vercel; Playwright E2E + mobile 3G testing. | Run full 24-case + 8-pair + 10-adversarial evaluation; generate final honest metrics table & capture clean demo recording. |
| **W5** | Dec 18 – Dec 26 | Prepare Q&A defense sheet for legal/policy judges (CRPA 2009, DCOG 2021, PDPA 2026). | Package offline Docker/laptop fallback bundle; verify cold-start speed on presentation hardware. | Final UI polish, offline/cloud toggle test, backup static replay fallback for stage screen. | Rehearse 3-minute pitch (`1m transition + 3m pitch + 1m scoring` Congress format) 5+ times; finalize AI provenance disclosure. |

---

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Hallucinated or mis-grounded legal citation during live demo** | Medium | Critical | Corpus-pinned IDs only; Pass 1 deterministic quote check (`>=0.92`) + Pass 2 independent entailment check; pre-rehearsed golden fixtures + deterministic rule outputs even if LLM degrades. |
| **Congress Hall Wi-Fi fails at DIU (5,000+ attendees)** | High | High | Dual-mode architecture: `LOCAL_OFFLINE` (`SQLite + llama.cpp`) runs 100% locally on laptop with 1-click toggle; keep cloud deployment URL + pre-recorded backup clips ready. |
| **Tesseract mangles low-res Bangla Messenger screenshots** | High | Medium | OpenCV deskew/upscale + `<0.75` token confidence flags + inline zoom-crop Manual OCR Correction UI on Screen 2 + optional Google Cloud Vision escalation when internet is active. |
| **Prompt injection or PII leak in demo files** | Medium | High | Use 100% synthetic/fictional cases at DIU (per CloudCamp AI Policy §7–8); run `injection_guard` + `pii_redactor` before logs and external APIs. |
| **Judges challenge Digital Commerce Guidelines clause numbers / PDPA 2026 status** | Medium | Medium | Show `AuthorityStrengthBadge` (`GUIDELINE` vs `STATUTE`), display `snapshot_date`, and transparently flag unresolved Gazette numbering in the reviewer memo. |
| **Time crunch across 4 roles (5 weeks)** | High | High | Enforce Week 1 cuts (no voice ASR, no extra storefronts, no auto-submit); ship end-to-end thin vertical slice by end of Week 3. |

---

## 6. Three-Minute Pitch & Live Demo Script

*Aligned with CloudCamp Bangladesh judging criteria (`Innovation 20%`, `Technical Execution 20%`, `Business/Global 20%`, `Impact/Responsible AI 20%`, `Scalability/NRB 10%`, `Presentation 10%`) and the `1 min transition + 3 min pitch` live format:*

| Time | Screen / Action (Show) | Narrative (Say) |
|---|---|---|
| **0:00 – 0:25** | **Screen 1 (`/cases/new`) & Problem Stat Overlay:** Show Bangla wrong-item Daraz complaint + rejection notice beside verified DNCRP scale (`58,720 e-commerce complaints; ~61% recent filings online shopping fraud`). | *"Over 60% of recent consumer complaints in Bangladesh involve online shopping fraud—wrong items, missed refunds, confusing rules. When a buyer orders Model A on Daraz and receives Model B—and gets rejected—what can they actually do within 14 or 30 days?"* |
| **0:25 – 0:55** | **Screen 2 & 3 (`/documents` → `/facts`):** Upload 4-page bilingual Terms PDF + order + bKash receipt + chat screenshot. Hover low-confidence Bangla OCR highlight and confirm corrected model & delivery date. Show PDPA 2026 Consent badge. | *"AinPath extracts evidence with page-level bounding boxes, flags uncertain Bangla OCR for instant human correction, redacts phone/NID PII before cloud inference, and asks only facts that change the legal route."* |
| **0:55 – 1:35** | **Screen 4 (`/compare`):** Open Sourced Reviewer Memo showing **3 page-linked compliance risks** (`Delivery timeline`, `Marketing privacy consent`, `Warranty conflict`). Click `Inspect Source` to open pinned Gazette/CRPA passage + `GUIDELINE` vs `STATUTE` badge + `Pass 2 Independent Verification: PASS`. | *"Behind the scenes on regional cloud infrastructure—with full offline fallback—four agents extract, retrieve, challenge counterarguments, and run a second independent verification pass to prevent hallucinated or mis-grounded laws."* |
| **1:35 – 2:15** | **Screen 3 → Screen 5 (`/roadmap` Diff View):** Flip the chat fixture from *"Address Confirmation"* to *"Substitution Approval"*. Show DAG cache skipping OCR/Deadlines and inline **Changed-Line Diff** updating `SOURCE_CONFIRMED` → `DISPUTED_FACT_DEPENDENT`, plus Dual Clocks (`14d Daraz` vs `30d CRPA s.60`). | *"Watch our dependency-hashed DAG recompute only affected reasoning—not the whole file—and highlight the exact roadmap lines and statutory clocks that shifted."* |
| **2:15 – 2:40** | **Switch to Facebook Shop Case (`MFS bKash` payment):** Show missing-receipt gap, `"Terms not in Bangla"` guideline flag, and payment-specific branch (`bKash 16247` → `BB CIPC 16236` → `DNCRP CCMS` written draft, zero auto-submit). | *"Switch from Daraz to a Facebook bKash purchase: no platform portal exists, so AinPath flags the Bangla-terms risk, checks MFS recovery steps, and prepares an editable DNCRP filing—never auto-submitting."* |
| **2:40 – 3:00** | **Screen 6 (`/export`) + Eval Scorecard Slide:** Approve draft & export bilingual bundle; show measured 24-case accuracy, 100% verified citation integrity, and cloud cost (`~$0.01/case` cloud, `BDT 0` offline). | *"Buyers get a concrete, plain-Bangla next step; legal-aid reviewers get an auditable memo. Built for Bangladesh today, engineered on cloud-native architecture to scale."* |

---

## 7. One-Page Submission Summary Outline

Use this structure for the official CloudCamp Bangladesh 1-page PDF submission:
1. **Header:** Project Name (`AinPath`), Domain (`JusticeSphere AI` / `Online Commerce`), Team Roles, Date.
2. **Problem Statement (3–4 lines):** Wrong-item e-commerce disputes across Daraz & Facebook shops; `58,720` cumulative e-commerce complaints at DNCRP (`~61%` of FY filings online fraud); fragmented rules across CRPA 2009, 2021 Guidelines, platform windows, and payment channels.
3. **AI-Native & Cloud Solution:** 4-agent + 2-pass citation verification pipeline over a confirmed case record; hybrid Bangla/English/Banglish retrieval (`FTS + BGE-M3/mE5`); deterministic dual-clock deadline & route engines; GCP/AWS Mumbai regional cloud (`<45 ms` to Dhaka) + `LOCAL_OFFLINE` laptop fallback.
4. **Localization & Responsible AI:** Plain-Bangla & English UI (`Noto Sans Bengali`, Bengali digits), OCR confidence correction UI, PDPA 2026 explicit consent & PII redaction, untrusted-evidence prompt-injection quarantine, zero autonomous filing.
5. **Measured Evaluation Targets & Traction Plan:** 24 bilingual scored cases (`>=20/24` route accuracy), 8 paired fact-sensitivity tests (`>=7/8`), 100% verified citation integrity, pilot partner path via consumer-rights / university legal-aid clinics.
6. **AI Usage & Provenance Statement:** Concise summary referencing full provenance ledger below.

---

## 8. AI Usage & Provenance Credit List *(Required by CloudCamp AI Policy v1.1)*

Document every external asset transparently in your final submission appendix:
- **Models Evaluated / Used:** Quantized local models (`Qwen3-4B-Instruct`, `Gemma-3-4B-it` via `llama.cpp`/Ollama), hosted API (`Gemini 2.5 Flash` on Vertex AI `asia-south1`), embeddings (`BAAI/bge-m3`, `intfloat/multilingual-e5-large`, `kazalbrur/bangla-embed-e5-small-banglish`), OCR (`Tesseract 5 ben+eng`, optional `Google Cloud Vision`).
- **Open-Source Frameworks:** FastAPI, Pydantic, PostgreSQL + `pgvector`, PyMuPDF, OpenCV, Next.js, Tailwind CSS, `pdfjs-dist`, TanStack Query.
- **Public Legal & Policy Sources:** CRPA 2009 (`bdlaws.minlaw.gov.bd` / `bangladeshtradeportal.gov.bd`), Digital Commerce Operation Guidelines 2021 (`dpp.gov.bd`), DNCRP CCMS & filing guides (`dncrp.gov.bd`, `dncrp.com`), Daraz BD Return Policy (`pages.daraz.com.bd`), Personal Data Protection Act 2026 audit sources.
- **AI Coding / Planning Assistants:** Explicitly declare coding assistants (e.g., Cursor / Claude / GPT) used during architecture, boilerplate, or UI drafting, noting that all legal citations, deterministic rules, and test evaluations were independently reviewed and executed by the team.
- **Data Integrity Pledge:** All demo cases use 100% synthetic/fictional names, orders, and chat records; zero real citizen PII or fabricated benchmark numbers are submitted.

---

## 9. Consolidated Legal Reviewer `VERIFY` Checklist

Every item below MUST be checked and signed off by a qualified Bangladesh legal reviewer before any public pilot (and verified before final Congress slides):

| # | Area | Exact Claim / Assumption to Verify | Primary Source to Check |
|---|---|---|---|
| **V1** | **Digital Commerce Guidelines Clause Numbering** | Proposal cites `3.1.2` (delivery terms) and `3.1.7` (personal data consent), while legal guides cite `3.1.17` (Bangla terms), `3.1.14` (6-yr retention), `3.2.10` (10% advance / escrow), `3.3.1` (48h courier), `3.3.2` (5d/10d delivery), `3.4.1–3.4.2` (compliance officer / 72h), `3.4.4` (force majeure), `3.5.1` (10d refund). Reconcile exact Bangla Gazette clause numbering. | Official Gazette PDF `https://www.dpp.gov.bd/upload_file/gazettes/40432_35501.pdf` & Ministry of Commerce (`mincom.gov.bd`) for any 2022–2026 amendments. |
| **V2** | **CRPA 2009 Statutory Text & Bangla Primacy** | Under CRPA s.82(2), **Bangla text prevails** over English translation. Confirm s.44, s.45, s.53, s.60, s.61, s.66, s.76 Bangla statutory phrasing matches our pinned corpus and check whether any e-commerce-specific CRPA amendment passed in 2025–2026. | `bdlaws.minlaw.gov.bd` (Act No. 26 of 2009 Bangla PDF) & check Sept 2026 news report of DNCRP DG referring certain online cases to Ministry of Commerce / CID. |
| **V3** | **DNCRP Personal Filing & URL Consistency** | Confirm whether legal-aid volunteers / advocates can file on a buyer's behalf on `dncrp.com` (Dec 2025 Daily Star Bangla report stated third-party filings are rejected), and verify whether `dncrp.gov.bd`, `dncrp.portal.gov.bd`, or `dncrp.com` is the current official CCMS link. | Live check of `https://dncrp.gov.bd/`, `https://dncrp.com/`, and 16121 CCMS guidelines. |
| **V4** | **Daraz Bangladesh Return Exceptions** | Verify current Nov/Dec 2026 category exclusions to the 14-day return policy (e.g., SIM/Wi-Fi-activated smartphones, brand-seal laptops, non-returnable sub-items, and 6–8d rejected-parcel return / 3-attempt scrap rule). | `https://pages.daraz.com.bd/wow/i/bd/help-pages/return-policy` + Daraz Warranty Policy & Terms. |
| **V5** | **Personal Data Protection Act, 2026 Status** | Verify enacted Gazette text of **PDPA 2026 (Act No. 63 of 2026)** repealing PDPO 2025 & Feb 2026 Amendment, confirm s.29(4) destination technical-adequacy regulations and Schedule classification tiers (`public/internal/confidential/restricted`), and confirm deferral status of s.23 & ss.31–35. | Bangladesh Gazette / Legislative & Parliamentary Affairs Division (`bdlaws.minlaw.gov.bd`) & National Data Management Authority notices. |
| **V6** | **Payment-Channel Dispute Windows & Circulars** | Verify exact Bangladesh Bank Payment Systems Department circular numbers for: (a) gateway escrow settlement rules (`SSLCOMMERZ`/`aamarPay`), (b) Bangla QR 45-day / 2-day NPSB DMS dispute timeline, (c) P2P bKash/Nagad freeze limits, and (d) local Visa/Mastercard issuer chargeback window (60 vs 120 days). | Bangladesh Bank PSD circulars (`bb.org.bd`), CIPC (`16236`), bKash/Nagad merchant & consumer terms. |
| **V7** | **Public Holidays & "Working Days" Calendar** | Verify 2026–2027 Bangladesh public holiday dates for the `60 working days` DNCRP target calculator (`DeadlineEngine`). | Cabinet Division official 2026/2027 holiday gazette. |
| **V8** | **Tesseract `ben` Real OCR Benchmark** | Verify the claimed `~88%` Tesseract Bengali character accuracy on AinPath's actual scanned BD invoices, Messenger screenshots, and bilingual Terms PDFs before citing any number publicly. | Internal benchmark run on `eval/` synthetic & sample fixture scans in Week 2. |
