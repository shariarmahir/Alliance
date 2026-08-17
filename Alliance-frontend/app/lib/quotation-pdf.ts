import { jsPDF } from "jspdf";
import type { Quotation, OrderConfirmation, Order, QuotationTerms } from "./types";
import { amountInWords, DEFAULT_TERMS } from "./order-confirmation";

// Draws the company's Price Quotation document to match their existing Word
// template. Runs in the browser (admin download, customer download and the
// order invoice), so it is deliberately not server-only.
//
// Both the order confirmation and the order invoice render through the same
// drawing code via the neutral PdfDocument shape below — they are the same
// document to the customer, differing only in title and a couple of rows, so
// duplicating ~300 lines of layout for the invoice would guarantee the two
// drift apart.
//
// Coordinates are millimetres on A4 (210 x 297). The table geometry below is
// the load-bearing part: COLS widths must sum to the content width, or the
// right-hand border of the header will not line up with the body rows.

export type PdfLine = {
  productId: string;
  name: string;
  partNumber: string;
  image: string;
  specifications: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

// Extra rows printed under the grand total (the invoice's shipping/subtotal
// breakdown). Empty for a quotation, which quotes a single figure.
export type PdfSummaryRow = { label: string; value: string };

export type PdfDocument = {
  title: string; // highlighted heading, e.g. "Price Quotation"
  refLabel: string; // "Ref" or "Invoice"
  refNumber: string;
  date: string; // yyyy-mm-dd
  recipient: { jobTitle: string; company: string; address: string; contact: string };
  subject: string;
  intro: string;
  lines: PdfLine[];
  grandTotal: number;
  summaryRows: PdfSummaryRow[];
  terms: QuotationTerms;
  trackingId: string;
  fileName: string;
};

const PAGE_W = 210;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2; // 174

// Vertical budget. The footer rule sits at 275, so content must stop above it;
// these drive the page-break decisions rather than hand-tuned magic numbers.
const BODY_BOTTOM = 265;
const PAGE_TOP = 38; // first usable y on a continuation page
const MIN_ROW_H = 14; // tall enough for the Picture cell without wasting page
const TOTAL_ROW_H = 8;
const TERMS_BLOCK_H = 96; // "Inword" + 7 terms + tracking + sign-off block

const BLUE: [number, number, number] = [0, 125, 204];
const GOLD: [number, number, number] = [255, 185, 0];
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [140, 150, 165];
const HEAD_BG: [number, number, number] = [238, 244, 250];

// S/N, Item Name, Picture, Specifications, Qty, Unit, Unit price, Total.
// Must sum to CONTENT_W or the header and body borders won't align.
const COLS = [11, 30, 20, 45, 12, 14, 21, 21];
const COL_X: number[] = [];
for (let i = 0, x = MARGIN; i < COLS.length; x += COLS[i], i++) COL_X.push(x);

// BDT amounts on the PDF are plain digits + a "BDT" column header rather than
// the ৳ glyph: jsPDF's built-in Helvetica is WinAnsi-encoded and cannot render
// U+09F3, which would silently come out as garbage in the printed document.
function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function setColor(doc: jsPDF, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}

// jsPDF's built-in Helvetica is WinAnsi-encoded, so characters outside that
// set are dropped silently — an em dash typed into a terms field would just
// vanish from the printed document. Admin-authored text (subject, terms,
// specifications) reaches this file verbatim, so fold the common typographic
// characters down to ASCII equivalents rather than losing them.
const CHAR_FALLBACKS: [RegExp, string][] = [
  // Dashes: hyphen variants, en/em, figure dash, non-breaking hyphen and the
  // minus sign. These paste in from Word looking identical to a plain hyphen.
  [/[\u2010-\u2015\u2212]/g, "-"],
  [/\u00ad/g, ""], // soft hyphen is invisible, so drop it rather than substitute
  [/[\u2018\u2019\u201b]/g, "'"], // curly single quotes
  [/[\u201c\u201d]/g, '"'], // curly double quotes
  [/\u2026/g, "..."], // ellipsis
  [/[\u00a0\u2007\u202f]/g, " "], // non-breaking / figure / narrow spaces
  [/[\u2022\u00b7]/g, "-"], // bullets
  [/\u09f3/g, "BDT "], // Taka sign
  [/\u20b9/g, "INR "], // Rupee sign
];

function ascii(text: string): string {
  return CHAR_FALLBACKS.reduce((s, [re, to]) => s.replace(re, to), text);
}

function drawHeader(doc: jsPDF, logo: string | null, title: string) {
  if (logo) {
    try {
      // The alias makes jsPDF store the bitmap once and reference it on every
      // page — without it a multi-page quotation embeds a full copy per page.
      doc.addImage(logo, "PNG", MARGIN, 12, 12, 12, "autolink-logo", "FAST");
    } catch {
      // a broken/unsupported logo must not abort the whole document
    }
  }

  doc.setFont("helvetica", "bold").setFontSize(24);
  setColor(doc, INK);
  doc.text("AutoLink", MARGIN + (logo ? 15 : 0), 21);
  const wordmarkW = doc.getTextWidth("AutoLink");
  setColor(doc, BLUE);
  doc.text(".", MARGIN + (logo ? 15 : 0) + wordmarkW, 21);

  doc.setFont("helvetica", "normal").setFontSize(9);
  setColor(doc, MUTED);
  doc.text("AUTOLINK INTEGRATED TECHNOLOGIES", MARGIN, 28);

  // Highlighted title block, mirroring the template's yellow-marked heading.
  // Sized to the text so a longer title ("Order Invoice") isn't clipped.
  doc.setFont("helvetica", "bold").setFontSize(15);
  const titleW = doc.getTextWidth(title) + 8;
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(PAGE_W - MARGIN - titleW, 13, titleW, 9, "F");
  setColor(doc, INK);
  doc.text(title, PAGE_W - MARGIN - 4, 19.8, { align: "right" });

  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]).setLineWidth(0.9);
  doc.line(MARGIN, 31.5, PAGE_W - MARGIN, 31.5);
  doc.setLineWidth(0.2);
}

function drawParties(doc: jsPDF, d: PdfDocument): number {
  let y = 39;

  doc.setFont("helvetica", "normal").setFontSize(9.5);
  setColor(doc, INK);
  doc.text("To", MARGIN, y);
  y += 5;

  // Address can wrap; the Ref/Date block on the right is fixed, so keep the
  // left column clear of it.
  const left = [
    d.recipient.jobTitle,
    d.recipient.company.toUpperCase(),
    ...doc.splitTextToSize(d.recipient.address, CONTENT_W - 62),
    d.recipient.contact,
  ];
  left.forEach((lineText: string, i: number) => {
    doc.text(lineText, MARGIN, y + i * 4.6);
  });

  doc.text(`${d.refLabel}: ${d.refNumber}`, PAGE_W - MARGIN, 44, { align: "right" });
  doc.text(`Date: ${formatDate(d.date)}`, PAGE_W - MARGIN, 48.6, { align: "right" });

  y += left.length * 4.6 + 6;

  doc.setFont("helvetica", "bold");
  doc.text("Subject:", MARGIN, y);
  const subjectX = MARGIN + doc.getTextWidth("Subject: ");
  const subjectLines = doc.splitTextToSize(d.subject, CONTENT_W - (subjectX - MARGIN));
  doc.text(subjectLines, subjectX, y);
  // Underlined, as in the template.
  subjectLines.forEach((s: string, i: number) => {
    const w = doc.getTextWidth(s);
    doc.line(subjectX, y + i * 4.6 + 1.2, subjectX + w, y + i * 4.6 + 1.2);
  });
  y += subjectLines.length * 4.6 + 6;

  doc.setFont("helvetica", "normal");
  doc.text("Dear Sir,", MARGIN, y);
  y += 6;

  const intro = doc.splitTextToSize(d.intro, CONTENT_W);
  doc.text(intro, MARGIN, y);
  return y + intro.length * 4.6 + 4;
}

function formatDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}.${m}.${y}`;
}

// Two-row header with merged cells: S/N, Item Name, Picture and Specifications
// span both rows; Quantity splits into Qty|Unit and Price in BDT into Unit|Total.
function drawTableHead(doc: jsPDF, y: number): number {
  const r1 = 7;
  const r2 = 6;
  const total = r1 + r2;

  doc.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
  doc.rect(MARGIN, y, CONTENT_W, total, "F");
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setFont("helvetica", "bold").setFontSize(8.5);
  setColor(doc, INK);

  const spanBoth = ["S/N", "Item Name", "Picture", "Specifications"];
  spanBoth.forEach((label, i) => {
    doc.rect(COL_X[i], y, COLS[i], total);
    doc.text(label, COL_X[i] + COLS[i] / 2, y + total / 2 + 1.2, { align: "center" });
  });

  // Quantity (cols 4-5) and Price in BDT (cols 6-7)
  const groups: [string, number, number][] = [
    ["Quantity", 4, 5],
    ["Price in BDT", 6, 7],
  ];
  groups.forEach(([label, a, b]) => {
    const x = COL_X[a];
    const w = COLS[a] + COLS[b];
    doc.rect(x, y, w, r1);
    doc.text(label, x + w / 2, y + r1 / 2 + 1.2, { align: "center" });
  });

  const subs: [string, number][] = [
    ["Qty", 4],
    ["Unit", 5],
    ["Unit", 6],
    ["Total", 7],
  ];
  subs.forEach(([label, i]) => {
    doc.rect(COL_X[i], y + r1, COLS[i], r2);
    doc.text(label, COL_X[i] + COLS[i] / 2, y + r1 + r2 / 2 + 1.2, { align: "center" });
  });

  return y + total;
}

function drawRow(doc: jsPDF, y: number, line: PdfLine, index: number, image: string | null): number {
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  setColor(doc, INK);

  const nameLines = doc.splitTextToSize(line.name, COLS[1] - 3);
  const specText = line.specifications || line.partNumber;
  const specLines = doc.splitTextToSize(specText, COLS[3] - 3);
  const textRows = Math.max(nameLines.length, specLines.length);
  // Picture column needs vertical room even when the text is a single line.
  const h = Math.max(MIN_ROW_H, textRows * 4 + 6);

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  COLS.forEach((w, i) => doc.rect(COL_X[i], y, w, h));

  const midY = y + h / 2 + 1;
  doc.text(String(index + 1), COL_X[0] + COLS[0] / 2, midY, { align: "center" });
  doc.text(nameLines, COL_X[1] + 1.5, y + 5);

  if (image) {
    try {
      const size = Math.min(COLS[2] - 5, h - 5);
      const format = image.startsWith("data:image/png") ? "PNG" : "JPEG";
      // Alias by product ID so the same photo on repeat lines is stored once.
      doc.addImage(
        image,
        format,
        COL_X[2] + (COLS[2] - size) / 2,
        y + (h - size) / 2,
        size,
        size,
        line.productId,
        "FAST"
      );
    } catch {
      // unreadable product image — leave the cell blank rather than failing
    }
  }

  doc.text(specLines, COL_X[3] + 1.5, y + 5);
  doc.text(String(line.quantity), COL_X[4] + COLS[4] / 2, midY, { align: "center" });
  doc.text(line.unit, COL_X[5] + COLS[5] / 2, midY, { align: "center" });
  doc.text(money(line.unitPrice), COL_X[6] + COLS[6] - 2, midY, { align: "right" });
  doc.text(money(line.total), COL_X[7] + COLS[7] - 2, midY, { align: "right" });

  // Product ID sits under the item name — the auto-generated per-line reference.
  doc.setFontSize(6.5);
  setColor(doc, MUTED);
  doc.text(line.productId, COL_X[1] + 1.5, y + h - 2.5);
  setColor(doc, INK);

  return y + h;
}

function drawTotalRow(doc: jsPDF, y: number, d: PdfDocument): number {
  const h = 8;
  const labelW = COLS[0] + COLS[1] + COLS[2] + COLS[3];

  doc.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
  doc.rect(MARGIN, y, CONTENT_W, h, "F");
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setFont("helvetica", "bold").setFontSize(9);
  setColor(doc, INK);

  doc.rect(MARGIN, y, labelW, h);
  doc.text("Grand total", MARGIN + 2, y + h / 2 + 1.2);

  const qty = d.lines.reduce((s, l) => s + l.quantity, 0);
  doc.rect(COL_X[4], y, COLS[4], h);
  doc.text(String(qty), COL_X[4] + COLS[4] / 2, y + h / 2 + 1.2, { align: "center" });

  doc.rect(COL_X[5], y, COLS[5] + COLS[6], h);
  doc.rect(COL_X[7], y, COLS[7], h);
  doc.text(money(d.grandTotal), COL_X[7] + COLS[7] - 2, y + h / 2 + 1.2, { align: "right" });
  y += h;

  // Invoice-only breakdown (subtotal / shipping / paid total) in the same
  // right-aligned columns, so it reads as part of the table.
  if (d.summaryRows.length) {
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    for (const row of d.summaryRows) {
      const rh = 6;
      doc.rect(COL_X[5], y, COLS[5] + COLS[6], rh);
      doc.rect(COL_X[7], y, COLS[7], rh);
      doc.text(row.label, COL_X[5] + COLS[5] + COLS[6] - 2, y + rh / 2 + 1, { align: "right" });
      doc.text(row.value, COL_X[7] + COLS[7] - 2, y + rh / 2 + 1, { align: "right" });
      y += rh;
    }
  }

  return y;
}

function drawTerms(doc: jsPDF, y: number, c: PdfDocument): number {
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  setColor(doc, INK);
  doc.text(`Inword: ${amountInWords(c.grandTotal)}`, MARGIN, y + 5);
  y += 11;

  doc.setFont("helvetica", "bold").setFontSize(9.5);
  doc.text("TERMS & CONDITIONS", MARGIN, y);
  doc.line(MARGIN, y + 1, MARGIN + doc.getTextWidth("TERMS & CONDITIONS"), y + 1);
  y += 7;

  const rows: [string, string][] = [
    ["Payment", c.terms.payment],
    ["Delivery", c.terms.delivery],
    ["Offer Validity", c.terms.offerValidity],
    ["VAT/AIT", c.terms.vatAit],
    ["Stock", c.terms.stock],
    ["Installation Charge", c.terms.installationCharge],
  ];
  doc.setFontSize(9);
  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(`: ${value}`, MARGIN + 40, y);
    y += 5.6;
  });

  doc.setFont("helvetica", "bold");
  doc.text("Warranty:", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text(c.terms.warranty, MARGIN + 40, y);
  y += 5.6;

  if (c.trackingId) {
    doc.setFont("helvetica", "bold").setFontSize(8.5);
    doc.text("Tracking No:", MARGIN, y);
    doc.setFont("courier", "bold");
    doc.text(c.trackingId, MARGIN + 40, y);
    y += 8;
  }
  return y;
}

function drawSignOff(doc: jsPDF, y: number) {
  doc.setFont("helvetica", "normal").setFontSize(9);
  setColor(doc, INK);
  doc.text(
    "We trust that our offer will meet your requirements and look forward to the opportunity to serve you.",
    MARGIN,
    y
  );
  doc.text("Thinking you", MARGIN, y + 10);
  doc.setFont("helvetica", "bold");
  doc.text("Md Nurul Islam", MARGIN, y + 20);
  doc.setFont("helvetica", "normal");
  doc.text("+8801713116019", MARGIN, y + 25);
}

function drawFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(8);
    setColor(doc, MUTED);
    doc.text(`${p} of ${pages}`, PAGE_W - MARGIN, 272, { align: "right" });

    doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]).setLineWidth(0.7);
    doc.line(MARGIN, 275, PAGE_W - MARGIN, 275);
    doc.setLineWidth(0.2);

    doc.setFontSize(8);
    doc.text(
      "Corporate Office: House: 104, Road: 15, Sector: 11, Uttara, Dhaka-1230, Bangladesh",
      PAGE_W / 2,
      280,
      { align: "center" }
    );
    doc.text("Phone: +8801711585291, Email: info@autolink.com", PAGE_W / 2, 284.5, {
      align: "center",
    });
  }
}

// Images are drawn at ~12-15mm, but jsPDF embeds whatever bitmap it is given
// at full resolution — a catalogue photo would add megabytes per line to a
// document that gets emailed. Downscale to a print-adequate box first.
const MAX_IMAGE_PX = 220;

async function downscale(dataUrl: string): Promise<string> {
  if (typeof document === "undefined") return dataUrl; // no canvas (SSR/tests)
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_PX / Math.max(img.width, img.height));
      if (scale === 1) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      // Flatten onto white: JPEG has no alpha, and transparent PNGs would
      // otherwise come out with black backgrounds in the PDF.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Product thumbnails are fetched as data URLs; a failure just leaves the
// Picture cell blank rather than blocking the download.
async function loadImage(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    return dataUrl ? await downscale(dataUrl) : null;
  } catch {
    return null;
  }
}

export async function buildPdf(d: PdfDocument): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Route every string through ascii() at the one place they all funnel
  // through, rather than at 40-odd call sites where a future addition would
  // inevitably miss one.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rawText = doc.text.bind(doc) as any;
  doc.text = ((t: string | string[], ...rest: any[]) =>
    rawText(Array.isArray(t) ? t.map(ascii) : ascii(String(t)), ...rest)) as typeof doc.text;

  const rawSplit = doc.splitTextToSize.bind(doc) as any;
  doc.splitTextToSize = ((t: string, ...rest: any[]) =>
    rawSplit(ascii(String(t)), ...rest)) as typeof doc.splitTextToSize;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const logo = await loadImage("/logo-mark.png");
  const images = await Promise.all(d.lines.map((l) => (l.image ? loadImage(l.image) : null)));

  drawHeader(doc, logo, d.title);
  let y = drawParties(doc, d);
  y = drawTableHead(doc, y);

  d.lines.forEach((line, i) => {
    // Break before a row that would run into the footer. A row is at least
    // MIN_ROW_H tall, and the grand-total row must stay with the table.
    if (y + MIN_ROW_H + TOTAL_ROW_H > BODY_BOTTOM) {
      doc.addPage();
      drawHeader(doc, logo, d.title);
      y = drawTableHead(doc, PAGE_TOP);
    }
    y = drawRow(doc, y, line, i, images[i]);
  });

  y = drawTotalRow(doc, y, d);

  // Terms + sign-off are a single block: splitting them across pages would
  // leave a signature stranded on its own page.
  if (y + TERMS_BLOCK_H > BODY_BOTTOM) {
    doc.addPage();
    drawHeader(doc, logo, d.title);
    y = PAGE_TOP;
  }
  y = drawTerms(doc, y, d);
  drawSignOff(doc, y);
  drawFooter(doc);

  return doc;
}

// --- Adapters: real data -> the neutral document shape -------------------

function quotationToPdf(quotation: Quotation, c: OrderConfirmation): PdfDocument {
  const d = quotation.details;
  return {
    title: "Price Quotation",
    refLabel: "Ref",
    refNumber: c.refNumber,
    date: c.issuedDate,
    recipient: {
      jobTitle: d.jobTitle || "Managing Director",
      company: d.companyName,
      address: d.country,
      contact: `Contact: ${d.phone}, Email: ${d.email}`,
    },
    subject: c.subject,
    intro:
      "With reference to your valued inquiry, we are pleased to submit our competitive quotation for your kind consideration, as detailed below.",
    lines: c.lines,
    grandTotal: c.grandTotal,
    summaryRows: [],
    terms: c.terms,
    trackingId: c.trackingId,
    fileName: `Order-Confirmation-${c.refNumber.replace(/[/\\]/g, "-")}.pdf`,
  };
}

function orderToPdf(order: Order): PdfDocument {
  const a = order.address;
  return {
    title: "Order Invoice",
    refLabel: "Invoice",
    refNumber: order.orderNumber,
    date: order.placedAt.slice(0, 10),
    recipient: {
      // Orders capture only a delivery recipient, not a job title — so the
      // name goes in the company slot and the honorific line stays generic,
      // rather than printing the same name twice.
      jobTitle: "Managing Director",
      company: a.name,
      address: [a.line, a.city, a.country].filter(Boolean).join(", "),
      contact: `Contact: ${a.phone}`,
    },
    subject: `Invoice for order ${order.orderNumber}, delivered by ${order.deliveryOptionName}.`,
    intro:
      "Thank you for your order. The parts below are confirmed against your accepted quotation and are being prepared for despatch.",
    // Orders store one price per line and no unit, so the Unit column falls
    // back to "Pcs" — the invoice reuses the quotation's table verbatim.
    lines: order.items.map((i) => ({
      productId: "",
      name: i.name,
      partNumber: i.partNumber,
      image: i.image,
      specifications: i.partNumber,
      quantity: i.quantity,
      unit: "Pcs",
      unitPrice: i.price,
      total: i.price * i.quantity,
    })),
    grandTotal: order.subtotal,
    summaryRows: [
      { label: "Shipping", value: money(order.shippingCost) },
      { label: "Total payable", value: money(order.grandTotal) },
    ],
    terms: {
      ...DEFAULT_TERMS,
      delivery: `${order.deliveryOptionName} (${order.deliveryEta})`,
      offerValidity: `Preferred delivery date: ${order.preferredDate}`,
    },
    trackingId: order.trackingId,
    fileName: `Invoice-${order.orderNumber}.pdf`,
  };
}

export async function buildQuotationPdf(quotation: Quotation): Promise<jsPDF> {
  const c = quotation.confirmation;
  if (!c) throw new Error("Quotation has no issued order confirmation.");
  return buildPdf(quotationToPdf(quotation, c));
}

export async function downloadQuotationPdf(quotation: Quotation): Promise<void> {
  const c = quotation.confirmation;
  if (!c) throw new Error("Quotation has no issued order confirmation.");
  const spec = quotationToPdf(quotation, c);
  const doc = await buildPdf(spec);
  doc.save(spec.fileName);
}

export async function buildInvoicePdf(order: Order): Promise<jsPDF> {
  return buildPdf(orderToPdf(order));
}

export async function downloadInvoicePdf(order: Order): Promise<void> {
  const spec = orderToPdf(order);
  const doc = await buildPdf(spec);
  doc.save(spec.fileName);
}

// Opens the print dialog on a rendered PDF rather than an HTML surrogate, so
// what prints is byte-identical to what downloads.
export async function printInvoicePdf(order: Order): Promise<void> {
  const doc = await buildPdf(orderToPdf(order));
  doc.autoPrint();
  const url = doc.output("bloburl");
  const w = window.open(url, "_blank");
  if (!w) throw new Error("Popup blocked");
}
