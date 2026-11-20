"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export function BrandMark({
  href = "/",
  className,
  size = "md",
}: {
  href?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "hero";
}) {
  const { lang, t } = useI18n();
  const label = lang === "bn" ? t.brandBn : t.brand;

  const sizeClass = {
    sm: "text-base",
    md: "text-xl sm:text-2xl",
    lg: "text-3xl sm:text-4xl",
    hero: "text-4xl sm:text-5xl md:text-6xl",
  }[size];

  const classNames = cn(
    "font-serif font-semibold tracking-tight text-primary",
    lang === "en" && "tracking-[-0.02em]",
    sizeClass,
    className
  );

  if (href === null) return <span className={classNames}>{label}</span>;
  return (
    <Link href={href} className={cn(classNames, "hover:opacity-90")}>
      {label}
    </Link>
  );
}
