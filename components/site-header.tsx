"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#how", key: "how" as const },
  { href: "/docs", key: "docs" as const },
  { href: "/about", key: "sources" as const },
  { href: "/demo", key: "demo" as const },
];

export function SiteHeader({
  className,
  transparent = false,
}: {
  className?: string;
  transparent?: boolean;
}) {
  const { t, lang, setLang } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const drawer =
    mounted &&
    createPortal(
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[200] md:hidden" role="presentation">
            <motion.button
              type="button"
              aria-label={t.nav.closeMenu}
              className="absolute inset-0 bg-black/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label={t.nav.menu}
              className="absolute inset-y-0 left-0 flex h-dvh min-h-dvh w-[min(20rem,88vw)] flex-col border-r border-border bg-background text-foreground shadow-2xl"
              style={{ backgroundColor: "var(--background)" }}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.85 }}
            >
              <div
                className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5"
                style={{ backgroundColor: "var(--background)" }}
              >
                <BrandMark size="sm" className="!text-foreground" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t.nav.closeMenu}
                  onClick={() => setOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              </div>

              <nav
                className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
                style={{ backgroundColor: "var(--background)" }}
                aria-label="Mobile"
              >
                {NAV_LINKS.map((item, i) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.06 + i * 0.045,
                      duration: 0.28,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <Link
                      href={item.href}
                      className="block rounded-xl px-4 py-3.5 text-base font-medium text-foreground hover:bg-muted"
                      onClick={() => setOpen(false)}
                    >
                      {t.nav[item.key]}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              <div
                className="mt-auto shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
                style={{ backgroundColor: "var(--background)" }}
              >
                <Button
                  nativeButton={false}
                  render={<Link href="/demo" />}
                  size="lg"
                  className="h-11 w-full"
                  onClick={() => setOpen(false)}
                >
                  {t.nav.start}
                </Button>
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>,
      document.body
    );

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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={t.nav.menu}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <BrandMark size="sm" className="!text-foreground sm:!text-xl" />
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            >
              {t.nav[item.key]}
            </Link>
          ))}
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

      {drawer}
    </header>
  );
}
