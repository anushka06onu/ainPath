"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader({
  className,
  transparent = false,
}: {
  className?: string;
  transparent?: boolean;
}) {
  const { t, lang, setLang } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors",
        transparent
          ? "sticky top-0 border-b border-transparent bg-background/45 backdrop-blur-md supports-[backdrop-filter]:bg-background/35"
          : "sticky top-0 border-b border-border/80 bg-background/90 backdrop-blur-md",
        className
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <BrandMark size="sm" className="!text-foreground sm:!text-xl" />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          <Link
            href="/#how"
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          >
            {t.nav.how}
          </Link>
          <Link
            href="/about"
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          >
            {t.nav.sources}
          </Link>
          <Link
            href="/demo"
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          >
            {t.nav.demo}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-11 bg-background/60 font-medium backdrop-blur-sm"
            onClick={() => setLang(lang === "bn" ? "en" : "bn")}
            aria-label={t.nav.language}
          >
            {lang === "bn" ? "EN" : "বাং"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.nav.theme}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/demo" />}
            size="sm"
            className="hidden h-9 px-4 sm:inline-flex"
          >
            {t.nav.start}
          </Button>
        </div>
      </div>
    </header>
  );
}
