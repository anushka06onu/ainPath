import PDFDocument from "pdfkit";
import path from "path";
import type { Bi, CaseRecord, Lang, ReporterDetails } from "./types";
import { toView } from "./cases";
import { factDisplay, redact } from "./export";

const FONTS = {
  sans: path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
  sansBold: path.join(process.cwd(), "public/fonts/NotoSans-SemiBold.ttf"),
  serif: path.join(process.cwd(), "public/fonts/NotoSerif-Regular.ttf"),
  serifBold: path.join(process.cwd(), "public/fonts/NotoSerif-Bold.ttf"),
  bn: path.join(process.cwd(), "public/fonts/NotoSansBengali-Regular.ttf"),
  bnBold: path.join(process.cwd(), "public/fonts/NotoSansBengali-SemiBold.ttf"),
};

const INK = "#1a1d21";
const MUTED = "#5c6570";
const RULE = "#d8dce0";
const ACCENT = "#2b6b57";
const MARGIN = 54;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const FOOTER_Y = PAGE_H - 40;
const CONTENT_BOTTOM = FOOTER_Y - 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

const pick = (b: Bi, l: Lang) => b[l] || b.en;
const T = (l: Lang, en: string, bn: string) => (l === "bn" ? bn : en);

const FACT_LABEL: Record<string, Bi> = {
  item_ordered: { en: "Item ordered", bn: "অর্ডার করা পণ্য" },
  item_received: { en: "Item received", bn: "পাওয়া পণ্য" },
  seller: { en: "Seller", bn: "বিক্রেতা" },
  order_date: { en: "Order date", bn: "অর্ডারের তারিখ" },
  delivery_date: { en: "Delivery date", bn: "ডেলিভারির তারিখ" },
  delivery_date_alt: { en: "Other delivery date", bn: "অন্য ডেলিভারি তারিখ" },
  rejection_reason: { en: "Rejection reason", bn: "বাতিলের কারণ" },
  prior_action: { en: "Prior action", bn: "পূর্ব পদক্ষেপ" },
  has_receipt: { en: "Proof of purchase", bn: "ক্রয়ের প্রমাণ" },
  chat_context: { en: "Chat context", bn: "চ্যাট প্রসঙ্গ" },
  delivery_estimate_in_order: { en: "Delivery estimate", bn: "ডেলিভারি অনুমান" },
};

type Fonts = { body: string; bodyBold: string; display: string; displayBold: string };

function fontsFor(lang: Lang): Fonts {
  if (lang === "bn") {
    return { body: FONTS.bn, bodyBold: FONTS.bnBold, display: FONTS.bn, displayBold: FONTS.bnBold };
  }
  return {
    body: FONTS.sans,
    bodyBold: FONTS.sansBold,
    display: FONTS.serif,
    displayBold: FONTS.serifBold,
  };
}

function registerFonts(doc: PDFKit.PDFDocument, f: Fonts) {
  doc.registerFont("body", f.body);
  doc.registerFont("bodyBold", f.bodyBold);
  doc.registerFont("display", f.display);
  doc.registerFont("displayBold", f.displayBold);
}

async function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/** Absolute text that must never trigger PDFKit auto page-break. */
function absText(
  doc: PDFKit.PDFDocument,
  str: string,
  x: number,
  y: number,
  opts: { width: number; align?: "left" | "center" | "right" | "justify"; height?: number }
) {
  doc.text(str, x, y, { ...opts, lineBreak: false, height: opts.height ?? 14 });
}

class ReportWriter {
  doc: PDFKit.PDFDocument;
  lang: Lang;
  y = MARGIN;
  caseId: string;

  constructor(doc: PDFKit.PDFDocument, lang: Lang, caseId: string) {
    this.doc = doc;
    this.lang = lang;
    this.caseId = caseId;
  }

  sectionPage() {
    this.doc.addPage();
    this.y = MARGIN;
  }

  ensure(needed: number) {
    if (this.y + needed > CONTENT_BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  measure(str: string, width: number, size: number, font = "body") {
    this.doc.font(font).fontSize(size);
    return this.doc.heightOfString(str, { width, lineGap: 2 });
  }

  rule() {
    this.ensure(16);
    this.doc
      .strokeColor(RULE)
      .lineWidth(0.7)
      .moveTo(MARGIN, this.y)
      .lineTo(PAGE_W - MARGIN, this.y)
      .stroke();
    this.y += 14;
  }

  accentRule(w = 36) {
    this.doc
      .strokeColor(ACCENT)
      .lineWidth(1.2)
      .moveTo(MARGIN, this.y)
      .lineTo(MARGIN + w, this.y)
      .stroke();
    this.y += 16;
  }

  h1(s: string) {
    const h = this.measure(s, CONTENT_W, 18, "displayBold");
    this.ensure(h + 16);
    this.doc.font("displayBold").fontSize(18).fillColor(INK).text(s, MARGIN, this.y, {
      width: CONTENT_W,
      lineGap: 1,
      height: h + 2,
    });
    this.y += h + 10;
  }

  h2(s: string) {
    const h = this.measure(s, CONTENT_W, 11.5, "displayBold");
    this.ensure(h + 24);
    this.y += 8;
    this.doc.font("displayBold").fontSize(11.5).fillColor(INK).text(s, MARGIN, this.y, {
      width: CONTENT_W,
      height: h + 2,
    });
    this.y += h + 4;
    this.doc
      .strokeColor(RULE)
      .lineWidth(0.5)
      .moveTo(MARGIN, this.y)
      .lineTo(PAGE_W - MARGIN, this.y)
      .stroke();
    this.y += 10;
  }

  p(s: string, opts?: { muted?: boolean; size?: number }) {
    const size = opts?.size ?? 10;
    const h = this.measure(s, CONTENT_W, size);
    this.ensure(h + 12);
    this.doc
      .font("body")
      .fontSize(size)
      .fillColor(opts?.muted ? MUTED : INK)
      .text(s, MARGIN, this.y, { width: CONTENT_W, lineGap: 2, height: h + 4 });
    this.y += h + 10;
  }

  quote(s: string) {
    if (!s.trim()) return;
    const w = CONTENT_W - 12;
    const h = this.measure(s, w, 9.5);
    this.ensure(h + 18);
    const startY = this.y;
    this.doc
      .font("body")
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(s, MARGIN + 12, this.y, { width: w, lineGap: 1.5, height: h + 4 });
    this.doc
      .strokeColor(ACCENT)
      .lineWidth(2)
      .moveTo(MARGIN, startY - 1)
      .lineTo(MARGIN, startY + h + 2)
      .stroke();
    this.y = startY + h + 12;
  }

  bullets(items: string[]) {
    for (const item of items) {
      const h = this.measure(item, CONTENT_W - 14, 10);
      this.ensure(h + 10);
      this.doc.font("body").fontSize(10).fillColor(INK);
      absText(this.doc, "•", MARGIN, this.y, { width: 12 });
      this.doc.text(item, MARGIN + 14, this.y, {
        width: CONTENT_W - 14,
        lineGap: 1.5,
        height: h + 2,
      });
      this.y += h + 6;
    }
    this.y += 4;
  }

  metaRow(label: string, value: string) {
    const h = Math.max(
      this.measure(label, 130, 9, "bodyBold"),
      this.measure(value, CONTENT_W - 136, 9.5)
    );
    this.ensure(h + 8);
    this.doc.font("bodyBold").fontSize(9).fillColor(MUTED).text(label, MARGIN, this.y, {
      width: 130,
      height: h + 2,
    });
    this.doc.font("body").fontSize(9.5).fillColor(INK).text(value, MARGIN + 136, this.y, {
      width: CONTENT_W - 136,
      height: h + 2,
    });
    this.y += h + 6;
  }

  table(head: string[], rows: string[][]) {
    const cols = head.length;
    const widths =
      cols === 3
        ? [140, (CONTENT_W - 140) / 2, (CONTENT_W - 140) / 2]
        : cols === 4
          ? [72, 210, 80, CONTENT_W - 362]
          : head.map(() => CONTENT_W / cols);

    const drawRow = (cells: string[], header: boolean) => {
      this.doc.font(header ? "bodyBold" : "body").fontSize(8.5);
      const heights = cells.map((c, i) =>
        this.doc.heightOfString(c || "—", { width: widths[i]! - 10 })
      );
      const h = Math.max(16, ...heights) + 8;
      this.ensure(h + 2);
      if (header) {
        this.doc.save().rect(MARGIN, this.y, CONTENT_W, h).fill("#f3f5f4").restore();
      }
      let x = MARGIN;
      for (let i = 0; i < cells.length; i++) {
        this.doc
          .font(header ? "bodyBold" : "body")
          .fontSize(8.5)
          .fillColor(header ? MUTED : INK)
          .text(cells[i] || "—", x + 5, this.y + 4, {
            width: widths[i]! - 10,
            height: h - 4,
          });
        x += widths[i]!;
      }
      this.doc
        .strokeColor(RULE)
        .lineWidth(0.4)
        .moveTo(MARGIN, this.y + h)
        .lineTo(PAGE_W - MARGIN, this.y + h)
        .stroke();
      this.y += h;
    };

    drawRow(head, true);
    for (const row of rows) drawRow(row, false);
    this.y += 10;
  }

  step(n: number, title: string, detail?: string, url?: string, caveat?: string) {
    const titleH = this.measure(title, CONTENT_W - 22, 10, "bodyBold");
    const detailH = detail ? this.measure(detail, CONTENT_W - 22, 9) : 0;
    const urlH = url ? this.measure(url, CONTENT_W - 22, 8.5) : 0;
    const caveatH = caveat ? this.measure(caveat, CONTENT_W - 22, 8.5) : 0;
    const total = titleH + detailH + urlH + caveatH + 16;
    this.ensure(total);

    this.doc.font("bodyBold").fontSize(10).fillColor(ACCENT);
    absText(this.doc, String(n), MARGIN, this.y, { width: 18 });

    this.doc
      .font("bodyBold")
      .fontSize(10)
      .fillColor(INK)
      .text(title, MARGIN + 22, this.y, { width: CONTENT_W - 22, height: titleH + 2 });
    this.y += titleH + 2;

    if (detail) {
      this.doc
        .font("body")
        .fontSize(9)
        .fillColor(MUTED)
        .text(detail, MARGIN + 22, this.y, { width: CONTENT_W - 22, height: detailH + 2 });
      this.y += detailH + 2;
    }
    if (url) {
      this.doc
        .font("body")
        .fontSize(8.5)
        .fillColor(ACCENT)
        .text(url, MARGIN + 22, this.y, { width: CONTENT_W - 22, height: urlH + 2 });
      this.y += urlH + 2;
    }
    if (caveat) {
      this.doc
        .font("body")
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(caveat, MARGIN + 22, this.y, { width: CONTENT_W - 22, height: caveatH + 2 });
      this.y += caveatH + 2;
    }
    this.y += 10;
  }
}

function paintFooters(doc: PDFKit.PDFDocument, lang: Lang, caseId: string) {
  const range = doc.bufferedPageRange();
  const label = T(lang, "AinPath case report", "আইনপথ কেস রিপোর্ট");
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .strokeColor(RULE)
      .lineWidth(0.6)
      .moveTo(MARGIN, FOOTER_Y - 8)
      .lineTo(PAGE_W - MARGIN, FOOTER_Y - 8)
      .stroke();
    doc.font("body").fontSize(8).fillColor(MUTED);
    absText(doc, `${label} · ${caseId}`, MARGIN, FOOTER_Y, { width: CONTENT_W * 0.7 });
    absText(doc, `${i + 1} / ${range.count}`, MARGIN, FOOTER_Y, {
      width: CONTENT_W,
      align: "right",
    });
  }
}

export async function buildCasePdf(
  c: CaseRecord,
  lang: Lang,
  doRedact: boolean,
  reporter?: ReporterDetails | null
): Promise<Buffer> {
  const v = toView(c);
  const r = doRedact ? redact : (s: string) => s;
  const f = fontsFor(lang);
  const generated = new Date().toISOString().slice(0, 10);
  const details = reporter ?? c.reporter;
  const channelLabel =
    c.channel === "daraz"
      ? T(lang, "Online marketplace", "অনলাইন মার্কেটপ্লেস")
      : c.channel === "facebook"
        ? T(lang, "Facebook shop", "ফেসবুক শপ")
        : T(lang, "Other", "অন্য");

  const doc = new PDFDocument({
    size: "A4",
    // Zero margins so absolute footer drawing never auto-paginates
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Title: `AinPath — ${c.id}`,
      Author: "AinPath",
      Subject: T(lang, "Case report", "কেস রিপোর্ট"),
      Creator: "AinPath",
    },
  });
  registerFonts(doc, f);
  doc.fillColor(INK);

  const w = new ReportWriter(doc, lang, c.id);

  // ——— Cover ———
  w.y = 100;
  const brand = lang === "bn" ? "আইনপথ" : "AinPath";
  const brandH = w.measure(brand, CONTENT_W, 26, "displayBold");
  doc.font("displayBold").fontSize(26).fillColor(ACCENT).text(brand, MARGIN, w.y, {
    width: CONTENT_W,
    height: brandH + 2,
  });
  w.y += brandH + 10;
  w.accentRule(48);

  const reportTitle = T(lang, "Case report", "কেস রিপোর্ট");
  const rtH = w.measure(reportTitle, CONTENT_W, 16, "displayBold");
  doc.font("displayBold").fontSize(16).fillColor(INK).text(reportTitle, MARGIN, w.y, {
    width: CONTENT_W,
    height: rtH + 2,
  });
  w.y += rtH + 14;

  w.p(
    T(lang, "Prepared for your review and submission.", "আপনার পর্যালোচনা ও জমার জন্য প্রস্তুত।"),
    { muted: true, size: 10 }
  );
  w.y += 8;

  w.metaRow(T(lang, "Case ID", "কেস আইডি"), c.id);
  w.metaRow(T(lang, "Channel", "চ্যানেল"), channelLabel);
  w.metaRow(T(lang, "Generated", "তৈরি"), generated);
  w.metaRow(T(lang, "Language", "ভাষা"), lang === "bn" ? "বাংলা" : "English");
  if (c.approvedAt) w.metaRow(T(lang, "Approved", "অনুমোদিত"), c.approvedAt.slice(0, 10));

  if (details?.fullName || details?.mobile) {
    w.y += 6;
    w.h2(T(lang, "Reporter", "প্রতিবেদক"));
    if (details.fullName) w.metaRow(T(lang, "Name", "নাম"), r(details.fullName));
    if (details.mobile) w.metaRow(T(lang, "Mobile", "মোবাইল"), r(details.mobile));
    if (details.email) w.metaRow(T(lang, "Email", "ইমেইল"), r(details.email));
    if (details.address) w.metaRow(T(lang, "Address", "ঠিকানা"), r(details.address));
    if (details.orderRef) w.metaRow(T(lang, "Order ID", "অর্ডার আইডি"), r(details.orderRef));
  }

  w.y += 10;
  w.rule();
  w.p(
    T(
      lang,
      "This report is a draft navigation aid. AinPath does not file complaints, give legal advice, or decide that any law was broken. You review, edit, and submit yourself.",
      "এই রিপোর্ট একটি খসড়া নেভিগেশন সহায়ক। আইনপথ অভিযোগ জমা দেয় না, আইনি পরামর্শ দেয় না, বা কোনো আইন ভঙ্গ হয়েছে বলে সিদ্ধান্ত দেয় না। পর্যালোচনা, সম্পাদনা ও জমা আপনি নিজে করবেন।"
    ),
    { muted: true, size: 9 }
  );

  if (v.roadmap) {
    w.y += 6;
    w.h2(T(lang, "At a glance", "এক নজরে"));
    w.p(pick(v.roadmap.headline, lang));
  }

  // ——— Facts ———
  w.sectionPage();
  w.h1(T(lang, "1. Confirmed facts", "১. নিশ্চিত তথ্য"));
  w.p(
    T(
      lang,
      "Facts drawn from your story and documents. Status shows what you confirmed.",
      "আপনার গল্প ও নথি থেকে নেওয়া তথ্য। অবস্থা দেখায় আপনি কী নিশ্চিত করেছেন।"
    ),
    { muted: true, size: 9 }
  );

  const factRows = c.facts
    .filter((x) => x.value)
    .map((x) => [
      pick(FACT_LABEL[x.key] ?? { en: x.key, bn: x.key }, lang),
      r(factDisplay(x.key, x.value, lang)),
      T(
        lang,
        x.status === "confirmed"
          ? "Confirmed"
          : x.status === "disputed"
            ? "Disputed"
            : x.status === "candidate"
              ? "Pending"
              : x.status,
        x.status === "confirmed"
          ? "নিশ্চিত"
          : x.status === "disputed"
            ? "বিতর্কিত"
            : x.status === "candidate"
              ? "অপেক্ষমাণ"
              : x.status
      ),
    ]);

  if (factRows.length) {
    w.table(
      [T(lang, "Fact", "তথ্য"), T(lang, "Value", "মান"), T(lang, "Status", "অবস্থা")],
      factRows
    );
  } else {
    w.p(T(lang, "No facts recorded.", "কোনো তথ্য নেই।"), { muted: true });
  }

  if (c.story?.trim()) {
    w.h2(T(lang, "Your story", "আপনার বিবরণ"));
    w.p(r(c.story.trim()));
  }

  // ——— Roadmap ———
  w.sectionPage();
  w.h1(T(lang, "2. Your path", "২. আপনার পথ"));
  if (v.roadmap) {
    w.p(pick(v.roadmap.headline, lang));
    w.h2(T(lang, "Next steps", "পরবর্তী ধাপ"));
    v.roadmap.steps.forEach((s, i) => {
      w.step(
        i + 1,
        pick(s.title, lang),
        s.detail ? pick(s.detail, lang) : undefined,
        s.where?.url,
        s.caveat ? pick(s.caveat, lang) : undefined
      );
    });

    w.h2(T(lang, "Deadlines", "সময়সীমা"));
    if (v.roadmap.deadline) {
      w.metaRow(
        T(lang, "Statutory (s.60)", "আইনি (ধারা ৬০)"),
        `${v.roadmap.deadline.date ?? "—"} · ${pick(v.roadmap.deadline.note, lang)}`
      );
    }
    const clocks = v.roadmap.clocks ?? [];
    if (clocks.length) {
      w.table(
        [T(lang, "Clock", "ঘড়ি"), T(lang, "Due", "শেষ তারিখ"), T(lang, "Status", "অবস্থা")],
        clocks.map((cl) => [
          pick(cl.name, lang),
          cl.dueDate ?? "—",
          cl.status.replace(/_/g, " "),
        ])
      );
    }
  } else {
    w.p(T(lang, "No roadmap yet.", "এখনো কোনো রোডম্যাপ নেই।"), { muted: true });
  }

  // ——— Buyer draft ———
  w.sectionPage();
  w.h1(T(lang, "3. Draft to submit", "৩. জমার খসড়া"));
  w.p(
    T(
      lang,
      "Copy, edit, and send this yourself. AinPath does not submit it.",
      "কপি করে সম্পাদনা করে নিজে পাঠান। আইনপথ এটি জমা দেয় না।"
    ),
    { muted: true, size: 9 }
  );

  const get = (k: string) => c.facts.find((x) => x.key === k)?.value ?? "";
  const draftTitle =
    c.channel === "daraz"
      ? T(lang, "Follow-up / return note — wrong item", "ফলো-আপ / রিটার্ন নোট — ভুল পণ্য")
      : T(lang, "Complaint draft — wrong item delivered", "অভিযোগের খসড়া — ভুল পণ্য ডেলিভারি");

  w.h2(draftTitle);
  w.bullets([
    `${T(lang, "Name", "নাম")}: ${details?.fullName ? r(details.fullName) : `[${T(lang, "your name", "আপনার নাম")}]`}`,
    `${T(lang, "Mobile", "মোবাইল")}: ${details?.mobile ? r(details.mobile) : `[${T(lang, "your mobile", "আপনার মোবাইল")}]`}`,
    ...(details?.email ? [`${T(lang, "Email", "ইমেইল")}: ${r(details.email)}`] : []),
    ...(details?.address ? [`${T(lang, "Address", "ঠিকানা")}: ${r(details.address)}`] : []),
    ...(details?.orderRef
      ? [`${T(lang, "Order ID", "অর্ডার আইডি")}: ${r(details.orderRef)}`]
      : []),
    `${T(lang, "Seller", "বিক্রেতা")}: ${r(get("seller") || "—")}`,
    `${T(lang, "Channel", "চ্যানেল")}: ${channelLabel}`,
    `${T(lang, "Order date", "অর্ডারের তারিখ")}: ${get("order_date") || "—"}`,
    `${T(lang, "Delivery date", "ডেলিভারির তারিখ")}: ${get("delivery_date") || "—"}`,
  ]);

  w.h2(T(lang, "What happened", "কী ঘটেছে"));
  w.p(
    T(
      lang,
      `I ordered "${r(get("item_ordered") || "—")}". The item delivered was "${r(get("item_received") || "—")}".`,
      `আমি "${r(get("item_ordered") || "—")}" অর্ডার করেছিলাম। যে পণ্য এসেছে তা "${r(get("item_received") || "—")}"।`
    )
  );

  w.h2(T(lang, "What I am asking for", "আমার অনুরোধ"));
  w.p(
    c.channel === "facebook"
      ? T(
          lang,
          "Please review this complaint and ask the seller to supply the ordered item or refund my payment.",
          "অনুগ্রহ করে এই অভিযোগ পর্যালোচনা করুন এবং বিক্রেতাকে অর্ডার করা পণ্য দিতে বা টাকা ফেরত দিতে বলুন।"
        )
      : T(
          lang,
          "Please review the decision against the attached order and delivery records, and arrange the correct item or a refund.",
          "অনুগ্রহ করে সংযুক্ত অর্ডার ও ডেলিভারি রেকর্ডের সঙ্গে মিলিয়ে সিদ্ধান্ত পর্যালোচনা করুন এবং সঠিক পণ্য বা টাকা ফেরতের ব্যবস্থা করুন।"
        )
  );

  // ——— Findings ———
  const findings = c.analysis?.findings ?? [];
  if (findings.length) {
    w.sectionPage();
    w.h1(T(lang, "4. Findings", "৪. পর্যবেক্ষণ"));
    w.p(
      T(
        lang,
        "Observations from uploaded terms, with sources. For a qualified reviewer.",
        "আপলোড করা শর্তাবলি থেকে পর্যবেক্ষণ, উৎসসহ। যোগ্য পর্যালোচকের জন্য।"
      ),
      { muted: true, size: 9 }
    );

    for (const finding of findings) {
      w.h2(r(pick(finding.title, lang)));
      w.p(r(pick(finding.risk, lang)));
      for (const anchor of [finding.anchor, finding.secondAnchor]) {
        if (!anchor?.quote) continue;
        w.quote(anchor.evidenceId + " · " + T(lang, "Page", "পৃষ্ঠা") + " " + anchor.page + " · “" + r(anchor.quote) + "”");
      }
      if (finding.authorityQuote) w.quote("“" + finding.authorityQuote + "”");
      for (const authorityId of finding.authorityIds) {
        const authority = v.authorities.find((a) => a.id === authorityId);
        if (authority) w.p(pick(authority.title, lang) + " · " + authority.section + " · " + authority.url, { muted: true, size: 9 });
      }
      w.p(T(lang, "Verification", "যাচাই") + " · " + r(pick(finding.statusReason, lang)), { size: 9, muted: true });
      w.p(T(lang, "Counterpoint", "পাল্টা যুক্তি") + " · " + r(pick(finding.counterpoint, lang)), { size: 9, muted: true });
      w.p(T(lang, "Next check", "পরবর্তী যাচাই") + " · " + r(pick(finding.nextCheck, lang)), { size: 9, muted: true });
    }
  }

  // ——— Evidence ———
  w.sectionPage();
  w.h1(
    findings.length
      ? T(lang, "5. Evidence index", "৫. প্রমাণের সূচি")
      : T(lang, "4. Evidence index", "৪. প্রমাণের সূচি")
  );
  w.p(
    T(
      lang,
      "Files attached to this case. SHA-256 prefixes let you verify integrity.",
      "এই কেসে সংযুক্ত ফাইল। SHA-256 উপসর্গ দিয়ে অখণ্ডতা যাচাই করা যায়।"
    ),
    { muted: true, size: 9 }
  );

  if (c.evidence.length) {
    w.table(
      [T(lang, "ID", "আইডি"), T(lang, "File", "ফাইল"), T(lang, "Type", "ধরন"), "SHA-256"],
      c.evidence.map((e) => [e.id, e.filename, e.kind, e.sha256.slice(0, 16) + "…"])
    );
  } else {
    w.p(T(lang, "No files attached.", "কোনো ফাইল সংযুক্ত নেই।"), { muted: true });
  }

  w.h2(T(lang, "Closing note", "শেষ কথা"));
  w.p(
    T(
      lang,
      "Keep this PDF with your evidence. Submit only through the official channel listed in your path. Delete the case from AinPath when you no longer need it on this computer.",
      "এই পিডিএফ আপনার প্রমাণের সঙ্গে রাখুন। শুধু আপনার পথে উল্লেখিত অফিসিয়াল চ্যানেলে জমা দিন। এই কম্পিউটারে আর প্রয়োজন না হলে আইনপথ থেকে কেস মুছে ফেলুন।"
    ),
    { muted: true, size: 9 }
  );

  paintFooters(doc, lang, c.id);
  return collect(doc);
}
