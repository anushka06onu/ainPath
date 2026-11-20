"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

const SOURCES = [
  {
    id: "CRPA-44",
    title: "Consumer Rights Protection Act 2009 — §44",
    note: "False or misleading representation",
    kind: "paraphrase / needs reviewer check",
  },
  {
    id: "CRPA-45",
    title: "Consumer Rights Protection Act 2009 — §45",
    note: "Sale of goods different from agreed description",
    kind: "paraphrase / needs reviewer check",
  },
  {
    id: "CRPA-60",
    title: "Consumer Rights Protection Act 2009 — §60",
    note: "Complaint filing window (30 days from cause)",
    kind: "paraphrase / needs reviewer check",
  },
  {
    id: "DCOG-3.1.2",
    title: "Digital Commerce Operational Guidelines — 3.1.2",
    note: "Delivery timeline disclosure",
    kind: "paraphrase / needs reviewer check",
  },
  {
    id: "DCOG-3.1.7",
    title: "Digital Commerce Operational Guidelines — 3.1.7",
    note: "Marketing / reuse of consumer data",
    kind: "paraphrase / needs reviewer check",
  },
  {
    id: "DNCRP",
    title: "DNCRP complaint guide",
    note: "How to file with the Directorate",
    kind: "filing instruction",
  },
  {
    id: "DARAZ-RETURN",
    title: "Marketplace return policy (sample snapshot)",
    note: "Used by the sample marketplace fixture; verify live policy before filing",
    kind: "marketplace policy snapshot",
  },
];

export default function AboutPage() {
  const { t, lang } = useI18n();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-medium text-primary">{t.nav.sources}</p>
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl">
          {lang === "bn" ? "উৎস, পদ্ধতি ও সীমা" : "Sources, method, and limits"}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          {lang === "bn"
            ? "আইনপথ একটি স্থানীয় ডেমো। এটি আইনি পরামর্শ নয়। প্রতিটি আইনি উল্লেখের উৎস ও যাচাই অবস্থা নিচে।"
            : "AinPath is a local demonstration. It is not legal advice. Every legal reference below shows its verification status."}
        </p>

        <section className="mt-10">
          <h2 className="text-xl">
            {lang === "bn" ? "কীভাবে কাজ করে" : "Method"}
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              {lang === "bn"
                ? "আপনার গল্প ও নথি থেকে তথ্য বের করে, আপনি নিশ্চিত করেন।"
                : "Facts are drafted from your story and documents, then you confirm them."}
            </li>
            <li>
              {lang === "bn"
                ? "নিয়ম ইঞ্জিন (এবং ঐচ্ছিকভাবে Groq) ঝুঁকি ও পথ প্রস্তাব করে।"
                : "A rule engine (and optionally Groq) proposes risks and a route."}
            </li>
            <li>
              {lang === "bn"
                ? "উদ্ধৃতি কোড দিয়ে মিলিয়ে দেখা হয় — না মিললে ‘পর্যালোচনা’।"
                : "Citations are checked in code; mismatches become ‘needs review’."}
            </li>
            <li>
              {lang === "bn"
                ? "সবকিছু এই কম্পিউটারে থাকে। জমা আপনি নিজে দেবেন।"
                : "Everything stays on this computer. You submit anything yourself."}
            </li>
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-xl">{lang === "bn" ? "কর্পাস" : "Corpus"}</h2>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {SOURCES.map((s) => (
              <li key={s.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs text-primary">{s.id}</p>
                  <p className="text-xs text-muted-foreground">{s.kind}</p>
                </div>
                <p className="mt-1 font-medium">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
          <p>{t.landing.trust.limit}</p>
        </section>

        <div className="mt-10">
          <Button render={<Link href="/demo" />} size="lg" className="h-11 px-5">
            {t.nav.demo}
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
