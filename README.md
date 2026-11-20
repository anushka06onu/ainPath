# AinPath (আইনপথ)

Local demo that helps a Bangladeshi buyer who received the wrong product: tell the story → add documents → confirm facts → get a personal roadmap and a sourced reviewer memo.

**Not legal advice.** Demo uses fictional records. No partnership with Daraz, DNCRP, or any platform is claimed. Corpus passages marked `paraphrase` need a human reviewer before any live use.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). English + dark are the defaults; use **EN / বাং** and the theme toggle as needed.

### Environment

Copy `.env.example` → `.env.local` and fill real values (or set the same keys in Vercel):

```bash
DATABASE_URL=...
DATABASE_URL_POOLED=...
GROQ_API_KEY=...
# optional: GROQ_MODEL=llama-3.3-70b-versatile
```

Without `GROQ_API_KEY`, intake and analysis fall back to deterministic rules. Cases and uploads are stored in Neon Postgres (not local disk).

## Try the sample

1. `/demo` → pick Daraz or Facebook + chat variant → **Open this case**
2. Walk Story → Documents → Confirm → Run analysis
3. Compare both sides → Roadmap (try **swap chat**) → Memo → Export
4. Approve drafts, download the PDF report, or delete the case

## What it does

| Screen | Job |
|--------|-----|
| Story | Channel + narrative → candidate facts |
| Documents | Upload PDF/images/text; OCR correction; injection flag |
| Confirm | Only route-changing facts; statuses নিশ্চিত / বিতর্কিত / পড়া যায়নি |
| Compare | Buyer vs seller vs evidence; three terms risks |
| Roadmap | Metro-line next steps; deadline under s.60 when trigger confirmed |
| Memo | Page-linked findings + citation drawer |
| Export | Approve → buyer draft, evidence index, reviewer memo |

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Neon Postgres (cases + evidence files)
- Pinned authority corpus in code
- Rules engine always; Groq optional
- `unpdf` + `tesseract.js` for extraction
- PDFKit case reports

## Verify

```bash
npm test          # Vitest: rules + citation normalisation
npm run eval      # 24 stub cases scaffold (schema check)
npm run smoke     # needs `npm run dev` — API Daraz rehearsal
npm run e2e       # Playwright happy path (starts dev server)
npm run build
```

Smoke variants:

```bash
npm run smoke -- daraz address
npm run smoke -- daraz substitution
npm run smoke -- facebook address
```

## Scope honesty

- Drafts only — nothing is auto-submitted
- Sources are pinned with `dateChecked` / `version`; paraphrases are labelled
- Prompt-like text in uploads is treated as evidence only
- Light/dark theme; reduced-motion respected

## One-page summary

AinPath turns a wrong-item delivery into a confirmed case record, then shows (1) what to do next and (2) a memo a reviewer can check against the original pages and Bangladesh sources — all offline on your laptop.
