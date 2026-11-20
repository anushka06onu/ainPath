# AinPath (আইনপথ)

You ordered one thing. Something else showed up. The return got rejected. Chat says one story, the order says another, and the clock on filing a complaint is already running.

AinPath is a Bangla/English web app for that mess. You tell what happened, drop in the order, chat, and terms, confirm the facts, and get a next-step path plus a multi-page PDF you can actually use. It does not file anything for you. It is not a lawyer.

Demo fixtures are fictional. No partnership with Daraz, DNCRP, or anyone else. Corpus lines marked paraphrase still need a human before real-world reliance.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Env

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | yes | Neon Postgres |
| `DATABASE_URL_POOLED` | yes on Vercel | use the pooler URL |
| `GROQ_API_KEY` | no | without it, rules still run; LLM steps skip |
| `GROQ_MODEL` | no | defaults to `llama-3.3-70b-versatile` |
| `MAX_UPLOAD_MB` / `MAX_PDF_PAGES` / `MAX_FILES` | no | defaults 8 / 12 / 8 |

Same names go in Vercel → Project → Environment Variables. Do not commit `.env.local`.

Cases and uploads live in Postgres. Tables are created on first request.

## Walkthrough

1. `/demo` → Daraz or Facebook sample (or start empty)
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
npm run eval  # eval case scaffold
npm run smoke # API rehearsal (dev server up)
npm run e2e   # Playwright
npm run build
```

## Honest limits

- Drafts only. You submit to Daraz / DNCRP yourself.
- Deadlines refuse to invent a start date when the trigger fact is unconfirmed.
- Prompt-like junk inside uploads is treated as evidence text, not instructions.
- Image OCR on tiny serverless timeouts can fail; text/PDF fixtures are the reliable path for demos.
- Paraphrased corpus entries are labelled. Verify Gazette text before public use.
