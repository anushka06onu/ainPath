import PDFDocument from "pdfkit";
import path from "path";
import type { Bi, CaseRecord, Lang } from "./types";
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
const PAPER = "#ffffff";
const MARGIN = 54;
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
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

class ReportWriter {
  doc: PDFKit.PDFDocument;
  lang: Lang;
  page = 1;
  y = MARGIN;
  caseId: string;

  constructor(doc: PDFKit.PDFDocument, lang: Lang, caseId: string) {
    this.doc = doc;
    this.lang = lang;
    this.caseId = caseId;
  }

  footer() {
    const label = T(this.lang, "AinPath case report", "আইনপথ কেস রিপোর্ট");
    this.doc
      .save()
      .strokeColor(RULE)
      .lineWidth(0.6)
      .moveTo(MARGIN, PAGE_H - 36)
      .lineTo(PAGE_W - MARGIN, PAGE_H - 36)
      .stroke()
      .restore();
    this.doc
      .font("body")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`${label} · ${this.caseId}`, MARGIN, PAGE_H - 28, {
        width: CONTENT_W / 2,
        lineBreak: false,
      })
      .text(String(this.page), MARGIN, PAGE_H - 28, {
        width: CONTENT_W,
        align: "right",
        lineBreak: false,
      });
  }

  newPage() {
    this.footer();
    this.doc.addPage();
    this.page += 1;
    this.y = MARGIN;
  }

  ensure(needed: number) {
    if (this.y + needed > PAGE_H - 52) this.newPage();
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
    this.ensure(40);
    this.doc.font("displayBold").fontSize(20).fillColor(INK).text(s, MARGIN, this.y, {
      width: CONTENT_W,
    });
    this.y = this.doc.y + 8;
  }

  h2(s: string) {
    this.ensure(36);
    this.y += 6;
    this.doc.font("displayBold").fontSize(12).fillColor(INK).text(s, MARGIN, this.y, {
      width: CONTENT_W,
    });
    this.y = this.doc.y + 4;
    this.doc
      .strokeColor(RULE)
      .lineWidth(0.5)
      .moveTo(MARGIN, this.y)
      .lineTo(PAGE_W - MARGIN, this.y)
      .stroke();
    this.y += 10;
  }

  p(s: string, opts?: { muted?: boolean; size?: number }) {
    this.ensure(28);
    this.doc
      .font("body")
      .fontSize(opts?.size ?? 10)
      .fillColor(opts?.muted ? MUTED : INK)
      .text(s, MARGIN, this.y, { width: CONTENT_W, lineGap: 2 });
    this.y = this.doc.y + 8;
  }

  quote(s: string) {
    if (!s.trim()) return;
    this.ensure(40);
    const x = MARGIN + 10;
    const w = CONTENT_W - 10;
    const startY = this.y;
    this.doc
      .font("body")
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(s, x, this.y, { width: w, lineGap: 1.5 });
    const endY = this.doc.y;
    this.doc
      .strokeColor(ACCENT)
      .lineWidth(2)
      .moveTo(MARGIN, startY - 1)
      .lineTo(MARGIN, endY + 1)
      .stroke();
    this.y = endY + 12;
  }

  bullets(items: string[]) {
    for (const item of items) {
      this.ensure(22);
      this.doc.font("body").fontSize(10).fillColor(INK);
      this.doc.text("•", MARGIN, this.y, { width: 12, continued: false });
      this.doc.text(item, MARGIN + 14, this.y, { width: CONTENT_W - 14, lineGap: 1.5 });
      this.y = this.doc.y + 5;
    }
    this.y += 4;
  }

  metaRow(label: string, value: string) {
    this.ensure(18);
    this.doc.font("bodyBold").fontSize(9).fillColor(MUTED).text(label, MARGIN, this.y, {
      width: 130,
      lineBreak: false,
    });
    this.doc.font("body").fontSize(9.5).fillColor(INK).text(value, MARGIN + 136, this.y, {
      width: CONTENT_W - 136,
    });
    this.y = Math.max(this.y + 14, this.doc.y + 4);
  }

  table(head: string[], rows: string[][]) {
    const cols = head.length;
    const widths = head.map((_, i) => {
      if (cols === 2) return i === 0 ? 150 : CONTENT_W - 150;
      if (cols === 3) return i === 0 ? 140 : (CONTENT_W - 140) / 2;
      if (cols === 4) return [120, 160, 90, CONTENT_W - 370][i]!;
      return CONTENT_W / cols;
    });

    const drawRow = (cells: string[], header: boolean) => {
      this.doc.font(header ? "bodyBold" : "body").fontSize(8.5);
      const heights = cells.map((c, i) =>
        this.doc.heightOfString(c || "—", {
          width: widths[i]! - 10,
        })
      );
      const h = Math.max(18, ...heights) + 8;
      this.ensure(h + 2);
      let x = MARGIN;
      if (header) {
        this.doc.save().rect(MARGIN, this.y, CONTENT_W, h).fill("#f3f5f4").restore();
      }
      for (let i = 0; i < cells.length; i++) {
        this.doc
          .font(header ? "bodyBold" : "body")
          .fontSize(8.5)
          .fillColor(header ? MUTED : INK)
          .text(cells[i] || "—", x + 5, this.y + 4, {
            width: widths[i]! - 10,
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
}

export async function buildCasePdf(
  c: CaseRecord,
  lang: Lang,
  doRedact: boolean
): Promise<Buffer> {
  const v = toView(c);
  const r = doRedact ? redact : (s: string) => s;
  const f = fontsFor(lang);
  const generated = new Date().toISOString().slice(0, 10);
  const channelLabel =
    c.channel === "daraz"
      ? "Daraz"
      : c.channel === "facebook"
        ? T(lang, "Facebook shop", "ফেসবুক শপ")
        : T(lang, "Other", "অন্য");

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: `AinPath — ${c.id}`,
      Author: "AinPath",
      Subject: T(lang, "Case report", "কেস রিপোর্ট"),
      Creator: "AinPath",
    },
    autoFirstPage: true,
  });
  registerFonts(doc, f);
  doc.fillColor(INK);

  const w = new ReportWriter(doc, lang, c.id);

  // ——— Cover ———
  w.y = 120;
  doc.font("displayBold").fontSize(28).fillColor(ACCENT).text(
    lang === "bn" ? "আইনপথ" : "AinPath",
    MARGIN,
    w.y,
    { width: CONTENT_W }
  );
  w.y = doc.y + 10;
  w.accentRule(48);
  doc
    .font("displayBold")
    .fontSize(18)
    .fillColor(INK)
    .text(T(lang, "Case report", "কেস রিপোর্ট"), MARGIN, w.y, { width: CONTENT_W });
  w.y = doc.y + 18;

  doc
    .font("body")
    .fontSize(10)
    .fillColor(MUTED)
    .text(T(lang, "Prepared for your review and submission.", "আপনার পর্যালোচনা ও জমার জন্য প্রস্তুত।"), MARGIN, w.y, {
      width: CONTENT_W,
    });
  w.y = doc.y + 28;

  w.metaRow(T(lang, "Case ID", "কেস আইডি"), c.id);
  w.metaRow(T(lang, "Channel", "চ্যানেল"), channelLabel);
  w.metaRow(T(lang, "Generated", "তৈরি"), generated);
  w.metaRow(
    T(lang, "Language", "ভাষা"),
    lang === "bn" ? "বাংলা" : "English"
  );
  if (c.approvedAt) {
    w.metaRow(T(lang, "Approved", "অনুমোদিত"), c.approvedAt.slice(0, 10));
  }

  w.y += 20;
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
    w.y += 12;
    w.h2(T(lang, "At a glance", "এক নজরে"));
    w.p(pick(v.roadmap.headline, lang));
  }

  // ——— Facts ———
  w.newPage();
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
  w.newPage();
  w.h1(T(lang, "2. Your path", "২. আপনার পথ"));
  if (v.roadmap) {
    w.p(pick(v.roadmap.headline, lang));
    w.h2(T(lang, "Next steps", "পরবর্তী ধাপ"));
    v.roadmap.steps.forEach((s, i) => {
      w.ensure(48);
      doc
        .font("bodyBold")
        .fontSize(10)
        .fillColor(ACCENT)
        .text(`${i + 1}`, MARGIN, w.y, { width: 18 });
      doc
        .font("bodyBold")
        .fontSize(10)
        .fillColor(INK)
        .text(pick(s.title, lang), MARGIN + 22, w.y, { width: CONTENT_W - 22 });
      w.y = doc.y + 2;
      if (s.detail) {
        doc
          .font("body")
          .fontSize(9)
          .fillColor(MUTED)
          .text(pick(s.detail, lang), MARGIN + 22, w.y, { width: CONTENT_W - 22 });
        w.y = doc.y + 2;
      }
      if (s.where?.url) {
        doc
          .font("body")
          .fontSize(8.5)
          .fillColor(ACCENT)
          .text(s.where.url, MARGIN + 22, w.y, { width: CONTENT_W - 22 });
        w.y = doc.y + 2;
      }
      if (s.caveat) {
        doc
          .font("body")
          .fontSize(8.5)
          .fillColor(MUTED)
          .text(pick(s.caveat, lang), MARGIN + 22, w.y, { width: CONTENT_W - 22 });
        w.y = doc.y + 2;
      }
      w.y += 10;
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
        [
          T(lang, "Clock", "ঘড়ি"),
          T(lang, "Due", "শেষ তারিখ"),
          T(lang, "Status", "অবস্থা"),
        ],
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
  w.newPage();
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
    `${T(lang, "Name", "নাম")}: [${T(lang, "your name", "আপনার নাম")}]`,
    `${T(lang, "Mobile", "মোবাইল")}: [${T(lang, "your mobile", "আপনার মোবাইল")}]`,
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
    w.newPage();
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
      w.ensure(80);
      w.h2(pick(finding.title, lang));
      w.p(pick(finding.risk, lang));
      if (finding.anchor?.quote) {
        w.quote(
          `${T(lang, "Page", "পৃষ্ঠা")} ${finding.anchor.page}: “${finding.anchor.quote}”`
        );
      }
      if (finding.authorityQuote) {
        w.quote(`“${finding.authorityQuote}”`);
      }
      w.p(`${T(lang, "Counterpoint", "পাল্টা যুক্তি")}: ${pick(finding.counterpoint, lang)}`, {
        size: 9,
        muted: true,
      });
      w.p(`${T(lang, "Next check", "পরবর্তী যাচাই")}: ${pick(finding.nextCheck, lang)}`, {
        size: 9,
        muted: true,
      });
    }
  }

  // ——— Evidence ———
  w.newPage();
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
      [
        T(lang, "ID", "আইডি"),
        T(lang, "File", "ফাইল"),
        T(lang, "Type", "ধরন"),
        "SHA-256",
      ],
      c.evidence.map((e) => [
        e.id,
        e.filename,
        e.kind,
        e.sha256.slice(0, 16) + "…",
      ])
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

  w.footer();
  return collect(doc);
}
