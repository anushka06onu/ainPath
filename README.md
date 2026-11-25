# AinPath (আইনপথ)

You ordered one thing. Something else showed up. The return got rejected. Chat says one story, the order says another, and the clock on filing a complaint is already running.

AinPath is a Bangla/English web app for that mess. You tell what happened, drop in the order, chat, and terms, confirm the facts, and get a next-step path plus a multi-page PDF you can actually use. It does not file anything for you. It is not a lawyer.

Demo fixtures are fictional. No partnership with any marketplace, DNCRP, or anyone else. Corpus lines marked paraphrase still need a human before real-world reliance.

## Run it

Use Node.js 22.13+ for local SQLite and the full test suite.

```bash
npm ci
cp .env.example .env.local
# Set AINPATH_SQLITE_PATH=./ainpath.sqlite in .env.local for a laptop demo.
npm run dev
```

Open [localhost:3000](http://localhost:3000). A hosted deployment instead uses `DATABASE_URL` or `DATABASE_URL_POOLED` for Neon Postgres. Cases and original evidence are stored together, and the schema initializes automatically. For a laptop without Wi-Fi, install dependencies and run the initial build beforehand. Text and PDF fixtures run without an AI key. Image OCR also needs the Bengali and English Tesseract language files locally, configured by `TESSERACT_LANG_PATH`.

| Optional setting | Behavior |
| --- | --- |
| `GROQ_API_KEY`, `GROQ_MODEL` | Enable hosted analysis with current cloud consent. Defaults to `openai/gpt-oss-120b`. |
| `AINPATH_DEMO_CLOUD=1` | Allow hosted AI for the built-in fictional demos. Editing a story or evidence or entering a new fact value disables this shortcut for the case. |
| `AINPATH_LOCAL_MODEL` | Name an installed Ollama model to run on the laptop with its local server listening on port 11434. |
| `MAX_UPLOAD_MB`, `MAX_PDF_PAGES`, `MAX_FILES` | Defaults are 8 MB per upload, 12 extracted PDF pages, and 8 files per case. Hosting platforms may enforce a lower request size. |
| `CRON_SECRET` | Enables the authenticated `GET /api/maintenance/retention` sweep. Run it periodically with `Authorization: Bearer <secret>` to remove inactive expired records. |

## Walkthrough

1. `/demo` → marketplace or Facebook sample (or start empty)
2. Story → Documents → Confirm facts
3. Run analysis
4. Compare → Roadmap (try swap chat) → Memo
5. Export → approve → enter name/mobile → download PDF

Or click through the landing CTAs. Dark + English are the defaults; theme and language toggle in the header.

## What each step is for

| Step | What you get |
|------|----------------|
| Story | Channel, payment channel, narrative → candidate facts |
| Documents | PDF / image OCR / text; fix bad OCR; injection text is flagged, not followed |
| Confirm | Only facts that change the route; confirm / dispute / unreadable |
| Compare | Buyer vs seller positions against evidence |
| Roadmap | Ordered next steps + separate deadline clocks (not merged into one fake countdown) |
| Memo | Findings with page quotes and authority links |
| Export | Approve, fill reporter details, download the PDF report (HTML/MD still available) |

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind v4, Neon (`@neondatabase/serverless`), optional Groq, `unpdf` + `tesseract.js`, PDFKit for reports. Authority text is pinned in `corpus/`, not scraped live on every request.

## Checks

```bash
npm test      # unit: rules, deadlines, routes
npm run eval  # labeled cases and pipeline/lifecycle regression checks
npm run smoke # API rehearsal (dev server up)
npm run e2e   # Playwright
npm run build
```

## Demo evidence

1. Open a marketplace sample, confirm the route-changing facts and run analysis. The memo links findings to the exact document and page and labels paraphrased authority text for review.
2. Swap the sample chat from the roadmap. The comparison shows the affected steps and the stages whose results were reused. Change a confirmed delivery date and rerun to see deadline changes in the same panel.
3. Open the Facebook sample to see the missing-receipt branch. In a new case, upload delivery records with different dates to see the conflicting-date prompt.
4. Approve the current draft and download the PDF. A case edit clears the old approval. The Privacy drawer downloads server-side JSON and can withdraw consent or delete the case.

The intake model proposes facts with exact source quotes. The research model retrieves from the pinned corpus, quotes specific document pages and passes through a deterministic check before independent model review. Model errors fall back to deterministic steps, with separate trace entries for reuse and skipped checks. The automated suite uses synthetic cases, including a stubbed provider for consent and redaction checks.

Expired cases become inaccessible and are removed on lookup, on case creation or by the configured retention sweep. Case deletion also removes stored files. Withdrawal stops new analysis, document changes and report generation. The case JSON remains available until expiry or deletion. In hosted mode, local processing means case text stays on the AinPath server. Opted-in cloud requests send selected text with common personal identifiers masked.

AinPath generates drafts for the user to review and submit. Corpus paraphrases still need a reviewer before real-world reliance.
