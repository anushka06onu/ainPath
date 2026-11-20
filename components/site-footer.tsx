"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { BrandMark } from "@/components/brand";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-auto border-t border-border/80 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-14 text-sm leading-relaxed text-muted-foreground sm:px-8 lg:px-10">
        <BrandMark className="!text-foreground" size="md" />
        <p>{t.footer.line1}</p>
        <p>{t.footer.line2}</p>
        <div className="flex flex-wrap gap-4 pt-2 text-xs">
          <Link href="/docs" className="hover:text-foreground">
            {t.nav.docs}
          </Link>
          <Link href="/about" className="hover:text-foreground">
            {t.nav.sources}
          </Link>
          <Link href="/demo" className="hover:text-foreground">
            {t.nav.demo}
          </Link>
        </div>
      </div>
    </footer>
  );
}
