"use client";

import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n/context";
import { Toaster } from "@/components/ui/sonner";
import type { Lang } from "@/lib/types";

export function Providers({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang: Lang;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="theme"
    >
      <I18nProvider initialLang={initialLang}>
        {children}
        <Toaster richColors position="bottom-center" />
      </I18nProvider>
    </ThemeProvider>
  );
}
