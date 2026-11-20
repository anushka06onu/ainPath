"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { createCase } from "@/lib/client";
import type { PaymentChannel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function DemoInner() {
  const { t, lang } = useI18n();
  const D = t.demo;
  const router = useRouter();
  const params = useSearchParams();
  const own = params.get("own") === "1";

  const [channel, setChannel] = useState<"daraz" | "facebook">("daraz");
  const [variant, setVariant] = useState<"address" | "substitution">("address");
  const [payment, setPayment] = useState<PaymentChannel>("PLATFORM_WALLET");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const pay =
        channel === "facebook" && payment === "PLATFORM_WALLET" ? "MFS_BKASH" : payment;
      if (!own) {
        const c = await createCase({ lang, fixture: channel, variant, paymentChannel: pay });
        router.push(`/case/${c.id}/story`);
      } else {
        const c = await createCase({ lang, channel: "daraz", story: "", paymentChannel: pay });
        router.push(`/case/${c.id}/story`);
      }
    } catch {
      toast.error(t.common.error);
      setBusy(false);
    }
  }

  const card =
    "w-full rounded-xl border px-3.5 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-sm font-medium text-primary">{t.nav.demo}</p>
      <h1 className="mt-2 font-serif text-2xl leading-snug sm:text-3xl">{D.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{D.lead}</p>

      {!own ? (
        <div className="mt-6 space-y-5">
          <fieldset>
            <legend className="text-sm font-medium text-foreground">{D.channel}</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  ["daraz", D.daraz, D.darazD],
                  ["facebook", D.fb, D.fbD],
                ] as const
              ).map(([id, title, desc]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChannel(id)}
                  className={cn(
                    card,
                    channel === id
                      ? "border-primary bg-primary/8"
                      : "border-border bg-card hover:border-foreground/20"
                  )}
                >
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{desc}</p>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">{D.chat}</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  ["address", D.chatA],
                  ["substitution", D.chatB],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVariant(id)}
                  className={cn(
                    card,
                    variant === id
                      ? "border-primary bg-primary/8"
                      : "border-border bg-card hover:border-foreground/20"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">{D.payment}</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  ["MFS_BKASH", D.payBkash],
                  ["MFS_NAGAD", D.payNagad],
                  ["MFS_ROCKET", D.payRocket],
                  ["CARD_DEBIT_CREDIT", D.payCard],
                  ["CASH_ON_DELIVERY", D.payCod],
                  ["PLATFORM_WALLET", D.payWallet],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPayment(id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors sm:text-sm",
                    payment === id
                      ? "border-primary bg-primary/8"
                      : "border-border bg-card hover:border-foreground/20"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
            <Button size="lg" className="h-11 px-5" disabled={busy} onClick={() => void start()}>
              {busy ? D.creating : D.go}
            </Button>
            <Button variant="ghost" className="h-11" render={<Link href="/demo?own=1" />}>
              {D.own}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          <p className="text-sm text-muted-foreground">{D.own}</p>
          <Button size="lg" className="h-11 px-5" disabled={busy} onClick={() => void start()}>
            {busy ? D.creating : t.nav.start}
          </Button>
          <div>
            <Button variant="link" className="px-0" render={<Link href="/demo" />}>
              ← {D.title}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DemoPage() {
  return (
    <div className="flex min-h-full flex-col overflow-x-hidden">
      <SiteHeader />
      <main className="min-w-0 flex-1">
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">…</div>}>
          <DemoInner />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
