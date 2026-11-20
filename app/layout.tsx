import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  Fraunces,
  Hind_Siliguri,
  JetBrains_Mono,
  Noto_Serif_Bengali,
  Source_Sans_3,
} from "next/font/google";
import { Providers } from "@/components/providers";
import { PrefsScript } from "@/components/prefs-script";
import type { Lang } from "@/lib/types";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoBn = Noto_Serif_Bengali({
  variable: "--font-bn-serif",
  subsets: ["bengali"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const hind = Hind_Siliguri({
  variable: "--font-bn-sans",
  subsets: ["bengali", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "আইনপথ · AinPath",
  description:
    "ভুল পণ্য পেয়েছেন? জানুন এখন ঠিক কী করবেন। Wrong item delivered? Know exactly what to do next — with proof.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const raw = jar.get("ainpath.lang")?.value;
  const initialLang: Lang = raw === "en" || raw === "bn" ? raw : "bn";

  return (
    <html
      lang={initialLang}
      data-lang={initialLang}
      suppressHydrationWarning
      className={`${sourceSans.variable} ${fraunces.variable} ${jetbrains.variable} ${notoBn.variable} ${hind.variable} h-full`}
    >
      <head>
        <PrefsScript />
      </head>
      <body className="paper-grain flex min-h-full flex-col font-sans antialiased">
        <Providers initialLang={initialLang}>{children}</Providers>
      </body>
    </html>
  );
}
