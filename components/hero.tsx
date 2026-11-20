"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const { t, lang } = useI18n();
  const L = t.landing;
  const brand = lang === "bn" ? t.brandBn : t.brand;
  const reduce = useReducedMotion();

  return (
    <section className="relative isolate -mt-16 h-svh min-h-svh overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <motion.div
          className="absolute inset-0 origin-right"
          initial={reduce ? false : { scale: 1.04, opacity: 0.85 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Image
            src="/hero-scales.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized
            className="object-cover object-[78%_42%] sm:object-[70%_40%]"
          />
        </motion.div>

        {/* Left reading veil — continuous, no mid-band seam */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, var(--background) 0%, color-mix(in oklch, var(--background) 94%, transparent) 32%, color-mix(in oklch, var(--background) 55%, transparent) 52%, color-mix(in oklch, var(--background) 18%, transparent) 72%, transparent 100%)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, color-mix(in oklch, var(--background) 45%, transparent) 0%, transparent 16%, transparent 88%, var(--background) 100%)",
          }}
          aria-hidden
        />
      </div>

      {/* Copy — left, vertically centered, shared grid with header */}
      <div className="relative mx-auto flex h-full max-w-6xl items-center px-5 pt-16 sm:px-8 lg:px-10">
        <motion.div
          className="w-full max-w-[36rem] py-10"
          initial={reduce ? false : "hidden"}
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
          }}
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: { opacity: 1, y: 0, transition: { duration: 0.65, ease } },
            }}
          >
            <p
              className={cn(
                "font-serif font-semibold text-primary",
                lang === "bn"
                  ? "text-[2.35rem] leading-none sm:text-5xl"
                  : "text-[2.5rem] leading-none tracking-[-0.04em] sm:text-5xl"
              )}
            >
              {brand}
            </p>
            <span
              className="mt-5 block h-px w-12 origin-left bg-primary"
              aria-hidden
            />
          </motion.div>

          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 18 },
              show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
            }}
            className="mt-8 font-serif text-[1.7rem] leading-[1.25] tracking-tight text-foreground sm:mt-9 sm:text-[2.35rem] sm:leading-[1.22] lg:text-[2.6rem]"
          >
            <span className="block sm:whitespace-nowrap">{L.h1a}</span>
            <span className="mt-1.5 block text-foreground/60 sm:whitespace-nowrap">
              {L.h1b}
            </span>
          </motion.h1>

          <motion.p
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
            }}
            className="mt-6 max-w-[34rem] text-base leading-[1.65] text-foreground/70 sm:text-lg sm:leading-[1.55]"
          >
            <span className="block">{L.suba}</span>
            <span className="block">{L.subb}</span>
          </motion.p>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
            }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Button
              nativeButton={false}
              render={<Link href="/demo" />}
              size="lg"
              className="h-12 min-w-[11.5rem] px-6 text-base"
            >
              {L.ctaDemo}
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/demo?own=1" />}
              variant="outline"
              size="lg"
              className="h-12 min-w-[11.5rem] border-border/80 bg-background/40 px-6 text-base backdrop-blur-sm"
            >
              {L.ctaStart}
            </Button>
          </motion.div>

          <motion.p
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { duration: 0.5, delay: 0.15 } },
            }}
            className="mt-8 text-sm text-muted-foreground"
          >
            {L.trust2}
            <span className="mx-2 text-border" aria-hidden>
              ·
            </span>
            {L.trust3}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
