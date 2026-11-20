"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BrandMark } from "@/components/brand";
import { Hero } from "@/components/hero";
import { Reveal, RevealItem } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/stamp";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { t, lang } = useI18n();
  const L = t.landing;
  const [chat, setChat] = useState<"a" | "b">("a");

  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader transparent />

      <main className="flex-1">
        <Hero />

        {/* Specimen roadmap — one composition: story left, path right */}
        <section className="relative border-b border-border/50">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_20%,color-mix(in_oklch,var(--primary)_7%,transparent),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-20 lg:px-10 lg:py-28">
            <Reveal>
              <p className="text-sm font-medium text-primary">{L.specimenTitle}</p>
              <h2 className="mt-4 font-serif text-3xl leading-snug tracking-tight sm:text-4xl">
                {L.specimenCase}
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                {L.solution.lead}
              </p>
              <div className="mt-8 h-px w-20 bg-gradient-to-r from-primary/70 to-transparent" aria-hidden />
            </Reveal>

            <Reveal delay={0.1}>
              <aside
                aria-label={L.specimenTitle}
                className="relative border-l-2 border-primary/30 pl-8 sm:pl-10"
              >
                <div className="mb-8 flex items-center justify-between gap-3">
                  <BrandMark href={null} size="sm" className="!text-foreground" />
                  <Stamp tone="ok">{lang === "bn" ? "নিশ্চিত" : "Confirmed"}</Stamp>
                </div>
                <ol className="relative space-y-0">
                  {[
                    { t: L.sp1, d: L.sp1d },
                    { t: L.sp2, d: L.sp2d },
                    { t: L.sp3, d: L.sp3d },
                  ].map((s, i, arr) => (
                    <RevealItem key={s.t} delay={0.08 + i * 0.09} className="relative flex gap-5">
                      <div className="relative flex w-3.5 shrink-0 flex-col items-center">
                        <span className="mt-1.5 size-3.5 rounded-full border-2 border-primary bg-background shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_12%,transparent)]" />
                        {i < arr.length - 1 && (
                          <span className="mt-1 w-px flex-1 metro-line min-h-12" aria-hidden />
                        )}
                      </div>
                      <div className={cn("min-w-0 pb-9", i === arr.length - 1 && "pb-0")}>
                        <p className="font-medium leading-snug text-foreground">{s.t}</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                      </div>
                    </RevealItem>
                  ))}
                </ol>
              </aside>
            </Reveal>
          </div>
        </section>

        {/* Problem — three questions, editorial */}
        <section id="problem" className="border-b border-border/50">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
            <Reveal>
              <h2 className="max-w-3xl font-serif text-3xl leading-snug tracking-tight sm:text-4xl lg:text-[2.65rem]">
                {L.problem.title}
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {L.problem.lead}
              </p>
            </Reveal>

            <div className="mt-16 grid gap-0 sm:grid-cols-3">
              {[
                { t: L.problem.c1t, q: L.problem.c1q, d: L.problem.c1d },
                { t: L.problem.c2t, q: L.problem.c2q, d: L.problem.c2d },
                { t: L.problem.c3t, q: L.problem.c3q, d: L.problem.c3d },
              ].map((c, i) => (
                <RevealItem
                  key={c.t}
                  delay={i * 0.08}
                  className={cn(
                    "border-t border-border/70 pt-7 sm:border-t-0 sm:border-l sm:border-border/70 sm:pt-0 sm:pl-8",
                    i === 0 && "sm:border-l-0 sm:pl-0"
                  )}
                >
                  <p className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</p>
                  <p className="mt-3 text-sm font-medium text-primary">{c.t}</p>
                  <p className="mt-4 font-serif text-2xl leading-snug text-foreground">{c.q}</p>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">{c.d}</p>
                </RevealItem>
              ))}
            </div>
            <Reveal delay={0.12} className="mt-14 max-w-2xl border-l-2 border-primary/30 pl-5 text-base leading-relaxed text-muted-foreground">
              {L.problem.after}
            </Reveal>
          </div>
        </section>

        {/* Solution — two outcomes, no cards */}
        <section className="border-b border-border/50">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
            <Reveal>
              <h2 className="max-w-3xl font-serif text-3xl leading-snug tracking-tight sm:text-4xl">
                {L.solution.title}
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {L.solution.lead}
              </p>
            </Reveal>
            <div className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-16">
              {[
                [L.solution.a, L.solution.at, L.solution.ad],
                [L.solution.b, L.solution.bt, L.solution.bd],
              ].map(([a, at, ad], i) => (
                <RevealItem key={at} delay={i * 0.1} className="relative">
                  <span
                    className="absolute -left-1 top-0 hidden h-full w-px bg-gradient-to-b from-primary/50 via-border to-transparent lg:block"
                    aria-hidden
                  />
                  <p className="text-sm font-medium text-primary">{a}</p>
                  <h3 className="mt-3 font-serif text-2xl tracking-tight sm:text-3xl">{at}</h3>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">{ad}</p>
                </RevealItem>
              ))}
            </div>
          </div>
        </section>

        {/* Live demo — interactive proof */}
        <section className="relative border-b border-border/50">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_10%_80%,color-mix(in_oklch,var(--primary)_6%,transparent),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
            <Reveal>
              <h2 className="max-w-3xl font-serif text-3xl leading-snug tracking-tight sm:text-4xl">
                {L.live.title}
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {L.live.lead}
              </p>
            </Reveal>

            <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
              <Reveal className="space-y-3">
                <p className="text-sm font-medium text-foreground">{L.live.msg}</p>
                {(
                  [
                    ["a", L.live.optA],
                    ["b", L.live.optB],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setChat(id)}
                    className={cn(
                      "w-full border-l-2 px-5 py-4 text-left text-base leading-relaxed transition-colors",
                      chat === id
                        ? "border-primary bg-primary/[0.07] text-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
                <p className="pt-4 text-base text-muted-foreground">
                  {L.live.reply}:{" "}
                  <span className="font-medium text-foreground">{L.live.replyText}</span>
                </p>
              </Reveal>

              <Reveal delay={0.1}>
                <div className="border border-border/60 bg-background/80 p-8 sm:p-10">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{L.live.resultTitle}</p>
                    <Stamp tone={chat === "a" ? "ok" : "review"}>
                      {chat === "a" ? L.live.tagA : L.live.tagB}
                    </Stamp>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={chat}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.28 }}
                      className="font-serif text-xl leading-relaxed text-foreground/90 sm:text-2xl"
                    >
                      {chat === "a" ? L.live.ra : L.live.rb}
                    </motion.p>
                  </AnimatePresence>
                  <p className="mt-6 text-sm text-muted-foreground">{L.live.foot}</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* How — six steps as a path */}
        <section id="how" className="border-b border-border/50">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
            <Reveal>
              <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">{L.how.title}</h2>
            </Reveal>
            <ol className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [L.how.s1, L.how.s1d],
                [L.how.s2, L.how.s2d],
                [L.how.s3, L.how.s3d],
                [L.how.s4, L.how.s4d],
                [L.how.s5, L.how.s5d],
                [L.how.s6, L.how.s6d],
              ].map(([title, d], i) => (
                <RevealItem key={title} delay={(i % 3) * 0.06} className="group">
                  <span className="font-mono text-sm text-primary transition-colors group-hover:text-primary/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-3 text-lg font-medium text-foreground">{title}</p>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">{d}</p>
                  <span
                    className="mt-5 block h-px w-10 bg-primary/25 transition-all group-hover:w-16 group-hover:bg-primary/50"
                    aria-hidden
                  />
                </RevealItem>
              ))}
            </ol>
          </div>
        </section>

        {/* Trust */}
        <section className="border-b border-border/50">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
            <Reveal>
              <h2 className="max-w-3xl font-serif text-3xl leading-snug tracking-tight sm:text-4xl">
                {L.trust.title}
              </h2>
            </Reveal>
            <ul className="mt-14 grid gap-10 sm:grid-cols-2 sm:gap-x-16 sm:gap-y-12">
              {[
                [L.trust.t1, L.trust.t1d],
                [L.trust.t2, L.trust.t2d],
                [L.trust.t3, L.trust.t3d],
                [L.trust.t4, L.trust.t4d],
              ].map(([title, d], i) => (
                <RevealItem key={title} delay={(i % 2) * 0.08} className="border-l-2 border-primary/30 pl-5">
                  <p className="text-lg font-medium">{title}</p>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">{d}</p>
                </RevealItem>
              ))}
            </ul>
            <Reveal delay={0.1} className="mt-14 max-w-2xl border border-dashed border-border/80 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
              {L.trust.limit}
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 80% 60% at 100% 50%, color-mix(in oklch, white 25%, transparent), transparent)",
            }}
            aria-hidden
          />
          <Reveal className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-20 sm:flex-row sm:items-center sm:px-8 lg:px-10 lg:py-24">
            <div className="max-w-xl">
              <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">{L.ctaBandTitle}</h2>
              <p className="mt-3 text-lg text-primary-foreground/80">{L.ctaBandSub}</p>
            </div>
            <Button
              nativeButton={false}
              render={<Link href="/demo" />}
              variant="secondary"
              size="lg"
              className="h-12 bg-background px-7 text-base text-foreground hover:bg-background/90"
            >
              {L.ctaDemo}
            </Button>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
