"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

const TOC = [
  { id: "problem", en: "The problem", bn: "সমস্যা" },
  { id: "solution", en: "How we solve it", bn: "সমাধান" },
  { id: "flow", en: "User flow", bn: "ব্যবহারকারীর পথ" },
  { id: "system", en: "System map", bn: "সিস্টেম মানচিত্র" },
  { id: "ai", en: "AI pipeline", bn: "এআই পাইপলাইন" },
  { id: "deadlines", en: "Deadlines", bn: "সময়সীমা" },
  { id: "stack", en: "Stack", bn: "স্ট্যাক" },
  { id: "safety", en: "Safety", bn: "নিরাপত্তা" },
  { id: "limits", en: "Limits", bn: "সীমা" },
] as const;

const STEPS = [
  { n: "1", en: "Story", bn: "গল্প", dEn: "Write what happened", dBn: "কী ঘটেছে লিখুন" },
  { n: "2", en: "Documents", bn: "নথি", dEn: "Order, chat, receipt…", dBn: "অর্ডার, চ্যাট, রসিদ…" },
  { n: "3", en: "Confirm", bn: "নিশ্চিত", dEn: "Fix the facts", dBn: "তথ্য ঠিক করুন" },
  { n: "4", en: "Both sides", bn: "দুই পক্ষ", dEn: "Buyer vs seller", dBn: "ক্রেতা বনাম বিক্রেতা" },
  { n: "5", en: "Roadmap", bn: "পথ", dEn: "Next steps + clocks", dBn: "পরের ধাপ + সময়" },
  { n: "6", en: "Export", bn: "এক্সপোর্ট", dEn: "PDF you submit", dBn: "পিডিএফ আপনি জমা দেন" },
];

const PIPELINE = [
  { id: "intake", en: "Intake", bn: "ইনটেক", w: 72 },
  { id: "deadlines", en: "Deadlines", bn: "সময়সীমা", w: 88 },
  { id: "research", en: "Research", bn: "রিসার্চ", w: 64 },
  { id: "review", en: "Review", bn: "রিভিউ", w: 58 },
  { id: "verify", en: "Verify", bn: "যাচাই", w: 80 },
  { id: "pass2", en: "Pass 2", bn: "পাস ২", w: 54 },
  { id: "routes", en: "Routes", bn: "রুট", w: 76 },
];

const ISSUES = [
  {
    en: "Order, chat and terms disagree",
    bn: "অর্ডার, চ্যাট ও শর্তাবলি আলাদা কথা বলে",
    fixEn: "User confirms facts before any route is locked.",
    fixBn: "পথ লক হওয়ার আগে ব্যবহারকারী তথ্য নিশ্চিত করেন।",
  },
  {
    en: "One word “yes” can mean address or substitute",
    bn: "একটি “yes” ঠিকানা বা বিকল্প দুটোই হতে পারে",
    fixEn: "Chat context swap re-runs analysis and updates the roadmap.",
    fixBn: "চ্যাট প্রসঙ্গ বদলালে বিশ্লেষণ আবার চলে এবং রোডম্যাপ আপডেট হয়।",
  },
  {
    en: "Fake deadlines when dates are unclear",
    bn: "তারিখ অস্পষ্ট থাকলে নকল সময়সীমা",
    fixEn: "Clocks stay refused until the trigger date is confirmed.",
    fixBn: "ট্রিগার তারিখ নিশ্চিত না হওয়া পর্যন্ত ঘড়ি স্থগিত থাকে।",
  },
  {
    en: "Chatbots invent legal quotes",
    bn: "চ্যাটবট আইনি উদ্ধৃতি বানিয়ে ফেলে",
    fixEn: "Pinned corpus + code checks quotes against real text.",
    fixBn: "পিন করা কর্পাস + কোড আসল লেখার সঙ্গে উদ্ধৃতি মিলায়।",
  },
  {
    en: "Uploads that try to hijack the AI",
    bn: "আপলোড যা এআইকে হাইজ্যাক করতে চায়",
    fixEn: "Injection-like text is flagged and treated as evidence only.",
    fixBn: "নির্দেশ-সদৃশ লেখা চিহ্নিত হয় এবং শুধু প্রমাণ হিসেবে রাখা হয়।",
  },
  {
    en: "App that files for you without control",
    bn: "অ্যাপ যা আপনার হয়ে জমা দেয়",
    fixEn: "AinPath only drafts. You download and submit yourself.",
    fixBn: "আইনপথ শুধু খসড়া করে। জমা আপনি নিজে দেন।",
  },
];

function SectionTitle({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="scroll-mt-24 font-serif text-2xl sm:text-3xl">
      {children}
    </h2>
  );
}

function FlowGraph({ bn }: { bn: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {bn ? "ইনপুট → এআই ও নিয়ম → আউটপুট" : "Input → AI & rules → Output"}
      </p>
      <div className="mt-5 flex min-w-[640px] items-stretch gap-2">
        {[
          {
            title: bn ? "ইনপুট" : "Input",
            items: bn
              ? ["গল্প", "অর্ডার / চ্যাট", "সম্মতি"]
              : ["Story", "Order / chat", "Consent"],
          },
          {
            title: bn ? "প্রক্রিয়া" : "Process",
            items: bn
              ? ["তথ্য খসড়া", "যাচাই", "রুট ইঞ্জিন"]
              : ["Draft facts", "Verify quotes", "Route engine"],
          },
          {
            title: bn ? "আউটপুট" : "Output",
            items: bn
              ? ["রোডম্যাপ", "স্মারক", "পিডিএফ"]
              : ["Roadmap", "Memo", "PDF report"],
          },
        ].map((col, i) => (
          <div key={col.title} className="flex flex-1 items-center gap-2">
            <div className="flex-1 rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-medium text-primary">{col.title}</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {col.items.map((x) => (
                  <li
                    key={x}
                    className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-foreground"
                  >
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            {i < 2 ? (
              <div className="shrink-0 text-primary" aria-hidden>
                →
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemGraph({ bn }: { bn: boolean }) {
  const boxes = bn
    ? [
        { t: "ওয়েব অ্যাপ", d: "Next.js · React" },
        { t: "এপিআই", d: "কেস · আপলোড · বিশ্লেষণ" },
        { t: "ডাটা", d: "Neon Postgres" },
        { t: "এআই", d: "Groq Llama (ঐচ্ছিক)" },
        { t: "নিয়ম", d: "রুট · সময়সীমা" },
        { t: "কর্পাস", d: "পিন করা আইন / নীতি" },
      ]
    : [
        { t: "Web app", d: "Next.js · React" },
        { t: "API", d: "Cases · upload · analyse" },
        { t: "Data", d: "Neon Postgres" },
        { t: "AI", d: "Groq Llama (optional)" },
        { t: "Rules", d: "Routes · deadlines" },
        { t: "Corpus", d: "Pinned law / policy" },
      ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {boxes.map((b, i) => (
        <motion.div
          key={b.t}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.04 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <p className="font-medium text-foreground">{b.t}</p>
          <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
        </motion.div>
      ))}
    </div>
  );
}

function PipelineBars({ bn }: { bn: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="text-sm text-muted-foreground">
        {bn
          ? "প্রতিটি ধাপ আলাদা। পাস ২ আগের যুক্তি দেখে না।"
          : "Each stage is separate. Pass 2 does not see earlier reasoning."}
      </p>
      <ul className="mt-5 space-y-3">
        {PIPELINE.map((p) => (
          <li key={p.id} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[7.5rem_1fr]">
            <span className="text-sm font-medium">{bn ? p.bn : p.en}</span>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                whileInView={{ width: `${p.w}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">
        {bn
          ? "বারগুলো আপেক্ষিক কাজের ওজন দেখায় (ডেমো ভিজ্যুয়াল), লাইভ মেট্রিক নয়।"
          : "Bars show relative stage weight (demo visual), not live telemetry."}
      </p>
    </div>
  );
}

function DualClockGraph({ bn }: { bn: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-medium text-primary">
          {bn ? "ঘড়ি ক" : "Clock A"}
        </p>
        <p className="mt-2 font-serif text-xl">
          {bn ? "মার্কেটপ্লেস রিটার্ন (১৪ দিন)" : "Marketplace return (14 days)"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {bn
            ? "ডেলিভারি তারিখ নিশ্চিত হলেই হিসাব।"
            : "Counted only after delivery date is confirmed."}
        </p>
        <div className="mt-4 h-2 rounded-full bg-muted">
          <div className="h-full w-2/5 rounded-full bg-[var(--warn)]" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-medium text-primary">
          {bn ? "ঘড়ি খ" : "Clock B"}
        </p>
        <p className="mt-2 font-serif text-xl">
          {bn ? "ডিএনসিআরপি অভিযোগ (৩০ দিন)" : "DNCRP complaint (30 days)"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {bn
            ? "কারণ তারিখ নিশ্চিত না হলে স্থগিত।"
            : "Refused until the cause date is confirmed."}
        </p>
        <div className="mt-4 h-2 rounded-full bg-muted">
          <div className="h-full w-3/5 rounded-full bg-primary/70" />
        </div>
      </div>
      <p className="sm:col-span-2 text-sm text-muted-foreground">
        {bn
          ? "দুটি ঘড়ি কখনো এক করে দেখানো হয় না। অনুমান করা হয় না।"
          : "The two clocks are never merged into one fake countdown. No guessing."}
      </p>
    </div>
  );
}

export default function DocsPage() {
  const { t, lang } = useI18n();
  const bn = lang === "bn";

  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
            <p className="text-sm font-medium text-primary">
              {bn ? "লাইভ ডকস" : "Live docs"}
            </p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
              {bn ? "আইনপথ কী, কেন, কীভাবে" : "What AinPath is, why it exists, how it works"}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {bn
                ? "বিচারক ও পর্যালোচকের জন্য সহজ ব্যাখ্যা। সমস্যা, সমাধান, সিস্টেম মানচিত্র, এআই পাইপলাইন ও সীমা এক জায়গায়।"
                : "A simple brief for judges and reviewers. Problem, solution, system map, AI pipeline, and limits in one place."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button nativeButton={false} render={<Link href="/demo" />} size="lg" className="h-11 px-5">
                {t.nav.demo}
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/about" />}
                variant="outline"
                size="lg"
                className="h-11 px-5"
              >
                {t.nav.sources}
              </Button>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-5xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[14rem_1fr] lg:gap-16 lg:px-10 lg:py-16">
          {/* TOC */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {bn ? "সূচি" : "On this page"}
            </p>
            <nav className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1" aria-label="Docs sections">
              {TOC.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {bn ? item.bn : item.en}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 space-y-16">
            {/* Problem */}
            <section>
              <SectionTitle id="problem">
                {bn ? "মূল সমস্যা" : "The main problem"}
              </SectionTitle>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {bn
                  ? "কেউ অনলাইনে একটা জিনিস অর্ডার করে। অন্য কিছু আসে। রিটার্ন বাতিল হয়। চ্যাট এক কথা বলে, অর্ডার অন্য কথা। সময়সীমা চলতে থাকে, আর মানুষ জানে না পরের ধাপ কী: প্ল্যাটফর্ম, পেমেন্ট বিরোধ, নাকি ডিএনসিআরপি।"
                  : "Someone orders one thing online. Something else arrives. The return is rejected. Chat says one story, the order says another. Deadlines keep running, and people do not know the next step: platform help, payment dispute, or DNCRP."}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {(bn
                  ? [
                      ["ছড়ানো নথি", "অর্ডার, চ্যাট, শর্তাবলি আলাদা"],
                      ["অস্পষ্ট “yes”", "ঠিকানা নাকি বিকল্প?"],
                      ["মিস হওয়া সময়", "১৪ দিন ও ৩০ দিনের ঘড়ি"],
                    ]
                  : [
                      ["Scattered proof", "Order, chat, terms disagree"],
                      ["Ambiguous “yes”", "Address or substitute?"],
                      ["Missed clocks", "14-day and 30-day windows"],
                    ]
                ).map(([t1, t2]) => (
                  <div key={t1} className="rounded-xl border border-border bg-card p-4">
                    <p className="font-medium">{t1}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t2}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Solution */}
            <section>
              <SectionTitle id="solution">
                {bn ? "কীভাবে সমাধান করি" : "How we solve it"}
              </SectionTitle>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {bn
                  ? "আইনপথ গল্প ও নথি পড়ে, আপনাকে দিয়ে তথ্য নিশ্চিত করায়, তারপর দুটি জিনিস দেয়: আপনার জন্য ধাপে ধাপে রোডম্যাপ, আর পর্যালোচকের জন্য উৎসসহ স্মারক। জমা আপনি নিজে দেন।"
                  : "AinPath reads the story and documents, lets you confirm the facts, then gives two things: a step-by-step roadmap for you, and a sourced memo for a reviewer. You submit anything yourself."}
              </p>
              <ul className="mt-6 space-y-3">
                {ISSUES.map((row) => (
                  <li
                    key={row.en}
                    className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
                  >
                    <div>
                      <p className="text-xs font-medium text-[var(--warn)]">
                        {bn ? "সমস্যা" : "Issue"}
                      </p>
                      <p className="mt-1 text-sm font-medium">{bn ? row.bn : row.en}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-primary">
                        {bn ? "সমাধান" : "Fix"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {bn ? row.fixBn : row.fixEn}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* User flow */}
            <section>
              <SectionTitle id="flow">
                {bn ? "ব্যবহারকারীর পথ" : "User flow"}
              </SectionTitle>
              <p className="mt-4 text-muted-foreground">
                {bn
                  ? "ছয়টি ছোট ধাপ। প্রতিটি ধাপের একটাই কাজ।"
                  : "Six short steps. Each step has one job."}
              </p>
              <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {STEPS.map((s) => (
                  <li key={s.n} className="rounded-xl border border-border bg-card p-4">
                    <p className="font-mono text-xs text-primary">{s.n}</p>
                    <p className="mt-1 font-medium">{bn ? s.bn : s.en}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {bn ? s.dBn : s.dEn}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="mt-8">
                <FlowGraph bn={bn} />
              </div>
            </section>

            {/* System */}
            <section>
              <SectionTitle id="system">
                {bn ? "সিস্টেম মানচিত্র" : "System map"}
              </SectionTitle>
              <p className="mt-4 text-muted-foreground">
                {bn
                  ? "ওয়েব অ্যাপ এপিআই ডাকে। কেস ও ফাইল Postgres-এ থাকে। এআই ঐচ্ছিক। নিয়ম ও কর্পাস সবসময় চলে।"
                  : "The web app talks to APIs. Cases and files live in Postgres. AI is optional. Rules and the corpus always run."}
              </p>
              <div className="mt-6">
                <SystemGraph bn={bn} />
              </div>
            </section>

            {/* AI */}
            <section>
              <SectionTitle id="ai">
                {bn ? "এআই পাইপলাইন" : "AI pipeline"}
              </SectionTitle>
              <p className="mt-4 text-muted-foreground">
                {bn
                  ? "Groq-এ Llama ব্যবহার হয় JSON মোডে। কী না থাকলে নিয়ম দিয়ে চলে। ডকুমেন্ট টেক্সট UNTRUSTED ব্লকে যায়।"
                  : "Groq hosts Llama in JSON mode. Without a key, rules still run. Document text goes in an UNTRUSTED block."}
              </p>
              <div className="mt-6">
                <PipelineBars bn={bn} />
              </div>
            </section>

            {/* Deadlines */}
            <section>
              <SectionTitle id="deadlines">
                {bn ? "সময়সীমার ঘড়ি" : "Deadline clocks"}
              </SectionTitle>
              <p className="mt-4 text-muted-foreground">
                {bn
                  ? "দুটি আলাদা ঘড়ি। একটা নকল কাউন্টডাউনে মিলিয়ে দেওয়া হয় না।"
                  : "Two separate clocks. Never blended into one fake countdown."}
              </p>
              <div className="mt-6">
                <DualClockGraph bn={bn} />
              </div>
            </section>

            {/* Stack */}
            <section>
              <SectionTitle id="stack">{bn ? "স্ট্যাক" : "Stack"}</SectionTitle>
              <div className="mt-6 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">{bn ? "স্তর" : "Layer"}</th>
                      <th className="px-4 py-3 font-medium">{bn ? "কী ব্যবহার" : "What we use"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(bn
                      ? [
                          ["ফ্রন্টএন্ড", "Next.js 16 · React 19 · Tailwind · shadcn"],
                          ["ব্যাকএন্ড", "App Router API · Zod"],
                          ["ডাটা", "Neon Postgres (serverless)"],
                          ["এআই", "Groq Llama 3.3 70B (ঐচ্ছিক)"],
                          ["নথি", "unpdf / pdfjs · tesseract.js · PDFKit"],
                          ["টেস্ট", "Vitest · Playwright"],
                          ["ডিপ্লয়", "Vercel"],
                        ]
                      : [
                          ["Frontend", "Next.js 16 · React 19 · Tailwind · shadcn"],
                          ["Backend", "App Router API · Zod"],
                          ["Data", "Neon Postgres (serverless)"],
                          ["AI", "Groq Llama 3.3 70B (optional)"],
                          ["Documents", "unpdf / pdfjs · tesseract.js · PDFKit"],
                          ["Tests", "Vitest · Playwright"],
                          ["Deploy", "Vercel"],
                        ]
                    ).map(([a, b]) => (
                      <tr key={a}>
                        <td className="px-4 py-3 font-medium">{a}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Safety */}
            <section>
              <SectionTitle id="safety">{bn ? "নিরাপত্তা" : "Safety"}</SectionTitle>
              <ul className="mt-6 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {(bn
                  ? [
                      "আপলোডের আগে সম্মতি (লোকাল / আঞ্চলিক, ধরে রাখার সময়, প্রত্যাহার, মুছে ফেলা)।",
                      "প্রম্পট-ইনজেকশন সদৃশ লেখা শুধু প্রমাণ হিসেবে।",
                      "উদ্ধৃতি কোডে যাচাই; দুর্বল ভিত্তি পাস ২ / অনুক্রমে চিহ্নিত।",
                      "প্যারাফ্রেজ উৎসে VERIFY লেবেল।",
                      "কখনো প্ল্যাটফর্ম বা ডিএনসিআরপি-তে স্বয়ংক্রিয় জমা নেই।",
                    ]
                  : [
                      "Consent before uploads (local / regional, retention, withdraw, delete).",
                      "Prompt-injection-like text treated as evidence only.",
                      "Quotes checked in code; weak support flagged by Pass 2 / hierarchy.",
                      "VERIFY labels on paraphrase sources.",
                      "Never auto-submits to a platform or DNCRP.",
                    ]
                ).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            {/* Limits */}
            <section>
              <SectionTitle id="limits">{bn ? "সীমা" : "Limits"}</SectionTitle>
              <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm leading-relaxed text-muted-foreground">
                <p>{t.landing.trust.limit}</p>
                <p className="mt-3">
                  {bn
                    ? "ডেমো ফিক্সচার কাল্পনিক। লাইভ মামলায় যোগ্য মানুষ দিয়ে যাচাই করুন। আইনপথ আইনজীবী নয়।"
                    : "Demo fixtures are fictional. For live matters, get a qualified person to review. AinPath is not a lawyer."}
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button nativeButton={false} render={<Link href="/demo" />} size="lg" className="h-11 px-5">
                  {t.nav.demo}
                </Button>
                <Button nativeButton={false} render={<Link href="/" />} variant="outline" size="lg" className="h-11 px-5">
                  {t.nav.home}
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
