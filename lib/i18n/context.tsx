"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Lang } from "@/lib/types";
import { DICTS, type Dict } from "./dict";

export const LANG_STORAGE_KEY = "ainpath.lang";
export const LANG_COOKIE = "ainpath.lang";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  bi: (v: { bn: string; en: string }) => string;
  fmt: (template: string, vars: Record<string, string | number>) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

function writeLang(l: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, l);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${LANG_COOKIE}=${l};path=/;max-age=31536000;samesite=lax`;
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l;
  document.documentElement.setAttribute("data-lang", l);
}

function readClientLang(fallback: Lang): Lang {
  try {
    const fromDom = document.documentElement.getAttribute("data-lang");
    if (fromDom === "en" || fromDom === "bn") return fromDom;
    const fromStore = localStorage.getItem(LANG_STORAGE_KEY);
    if (fromStore === "en" || fromStore === "bn") return fromStore;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function I18nProvider({
  children,
  initialLang = "bn",
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // Before paint: align with what the head script / localStorage already chose.
  useLayoutEffect(() => {
    const next = readClientLang(initialLang);
    if (next !== lang) setLangState(next);
    writeLang(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeLang(l);
  }, []);

  const value = useMemo<I18nCtx>(() => {
    const t = DICTS[lang];
    return {
      lang,
      setLang,
      t,
      bi: (v) => (lang === "bn" ? v.bn : v.en) || v.en || v.bn,
      fmt: (template, vars) =>
        Object.entries(vars).reduce(
          (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
          template
        ),
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
