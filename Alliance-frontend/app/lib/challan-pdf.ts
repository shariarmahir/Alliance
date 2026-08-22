import { jsPDF } from "jspdf";
import {
  PAGE_W,
  MARGIN,
  CONTENT_W,
  INK,
  LINE,
  HEAD_BG,
  setColor,
  ascii,
  drawHeader,
  drawFooter,
  formatDate,
  loadImage,
} from "./quotation-pdf";
import { amountInWords } from "./order-confirmation";
import type { Quotation } from "./types";

// The delivery Challan — the note that travels with the goods. Modelled on
// the company's existing Word template, which differs from the quotation in
// ways that matter: no prices anywhere (a challan is not a financial
// document), a three-column table, and the title in a centred outlined box
// rather than the quotation's gold corner block.
//
// Shares the letterhead and footer with quotation-pdf.ts so the two documents
// cannot drift apart visually; everything below the rule is its own layout.

export type ChallanLine = {
  /** Bold heading line, e.g. "Industrial PC for ETP System". */
  name: string;
  /** One bullet per line under the heading. */
  bullets: string[];
  quantity: number;
};

export type ChallanDocument = {
  refNumber: string;
  date: string; // yyyy-mm-dd
  recipient: { company: string; address: string };
  lines: ChallanLine[];
  signatoryName: string;
  signatoryPhone: string;
  fileName: string;
};

// S/N, Specifications, Qty — must sum to CONTENT_W or the header and body
// borders will not line up.
const COLS = [14, 130, 30];
const COL_X: number[] = [];
for (let i = 0, x = MARGIN; i < COLS.length; x += COLS[i], i++) COL_X.push(x);

const BODY_BOTTOM = 258; // leave room for the sign-off block above the footer
const PAGE_TOP = 38;

function drawParties(doc: jsPDF, d: ChallanDocument): number {
  doc.setFont("helvetica", "normal").setFontSize(10);
  setColor(doc, INK);

  doc.text("To", MARGIN, 42);
  // The Ref/Date column is fixed on the right, so the address wraps within
  // what is left rather than running underneath it.
  const address = doc.splitTextToSize(d.recipient.address, CONTENT_W - 70);
  doc.text(d.recipient.company, MARGIN, 48);
  doc.text(address, MARGIN, 54);

  doc.text(`Ref: ${d.refNumber}`, PAGE_W - MARGIN, 42, { align: "right" });
  doc.text(`Date: ${formatDate(d.date)}`, PAGE_W - MARGIN, 48, { align: "right" });

  return 54 + address.length * 5.5;
}

// Centred outlined box, as in the template. Rounded corners and a hairline
// border — deliberately not the quotation's filled gold block.
function drawTitleBox(doc: jsPDF, y: number): number {
  const w = 60;
  const h = 13;
  const x = (PAGE_W - w) / 2;

  doc.setDrawColor(INK[0], INK[1], INK[2]).setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, "S");
  doc.setLineWidth(0.2);

  doc.setFont("helvetica", "normal").setFontSize(16);
  setColor(doc, INK);
  doc.text("Challan", PAGE_W / 2, y + 8.8, { align: "center" });

  return y + h;
}

function drawTableHead(doc: jsPDF, y: number): number {
  const h = 9;
  doc.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
  doc.rect(MARGIN, y, CONTENT_W, h, "F");

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.rect(MARGIN, y, CONTENT_W, h);
  COL_X.slice(1).forEach((x) => doc.line(x, y, x, y + h));

  doc.setFont("helvetica", "bold").setFontSize(10);
  setColor(doc, INK);
  doc.text("S/N", COL_X[0] + COLS[0] / 2, y + 6, { align: "center" });
  doc.text("Specifications", COL_X[1] + COLS[1] / 2, y + 6, { align: "center" });
  doc.text("Qty", COL_X[2] + COLS[2] / 2, y + 6, { align: "center" });

  return y + h;
}

/** Height a row needs, so a page break can be decided before drawing it. */
function measureRow(doc: jsPDF, line: ChallanLine): { h: number; wrapped: string[][] } {
  const textW = COLS[1] - 12; // indent for the bullet glyph
  doc.setFont("helvetica", "bold").setFontSize(10.5);
  const heading = doc.splitTextToSize(line.name, COLS[1] - 6);

  doc.setFont("helvetica", "normal").setFontSize(10);
  const wrapped = line.bullets.map((b) => doc.splitTextToSize(b, textW) as string[]);

  const bulletLines = wrapped.reduce((n, w) => n + w.length, 0);
  // heading + gap + bullets + padding top/bottom
  const h = heading.length * 5.2 + (bulletLines ? 3 + bulletLines * 5.2 : 0) + 12;
  return { h: Math.max(h, 20), wrapped: [heading, ...wrapped] };
}

function drawRow(doc: jsPDF, y: number, line: ChallanLine, index: number): number {
  const { h, wrapped } = measureRow(doc, line);
  const [heading, ...bullets] = wrapped;

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.rect(MARGIN, y, CONTENT_W, h);
  COL_X.slice(1).forEach((x) => doc.line(x, y, x, y + h));

  // S/N and Qty are vertically centred against the whole row; the
  // specifications column is top-aligned because it is a block of prose.
  doc.setFont("helvetica", "normal").setFontSize(10);
  setColor(doc, INK);
  doc.text(String(index + 1), COL_X[0] + COLS[0] / 2, y + h / 2 + 1.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.text(String(line.quantity), COL_X[2] + COLS[2] / 2, y + h / 2 + 1.5, { align: "center" });

  let ty = y + 7;
  doc.setFont("helvetica", "bold").setFontSize(10.5);
  doc.text(heading, COL_X[1] + 3, ty);
  ty += heading.length * 5.2 + 3;

  doc.setFont("helvetica", "normal").setFontSize(10);
  bullets.forEach((bulletLines) => {
    // The glyph sits on the first line only; continuation lines align to the
    // text, not back under the bullet.
    doc.text("•", COL_X[1] + 6, ty);
    doc.text(bulletLines, COL_X[1] + 11, ty);
    ty += bulletLines.length * 5.2;
  });

  return y + h;
}

function drawSignOff(doc: jsPDF, y: number, d: ChallanDocument) {
  doc.setFont("helvetica", "normal").setFontSize(10);
  setColor(doc, INK);
  doc.text("Thinking you", MARGIN, y);

  // Space left blank for a physical signature, as in the template.
  doc.setFont("helvetica", "bold");
  doc.text(d.signatoryName, MARGIN, y + 26);
  doc.setFont("helvetica", "normal");
  doc.text(d.signatoryPhone, MARGIN, y + 31.5);
}

export async function buildChallanPdf(d: ChallanDocument): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Same ASCII-folding shim as the quotation builder: jsPDF's Helvetica is
  // WinAnsi-encoded, so a pasted em dash or curly quote would silently vanish
  // from the printed document.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rawText = doc.text.bind(doc) as any;
  doc.text = ((t: string | string[], ...rest: any[]) =>
    rawText(Array.isArray(t) ? t.map(ascii) : ascii(String(t)), ...rest)) as typeof doc.text;
  const rawSplit = doc.splitTextToSize.bind(doc) as any;
  doc.splitTextToSize = ((t: string, ...rest: any[]) =>
    rawSplit(ascii(String(t)), ...rest)) as typeof doc.splitTextToSize;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const logo = await loadImage("/logo-mark.png");

  drawHeader(doc, logo, null);
  let y = drawParties(doc, d);
  y = drawTitleBox(doc, y + 10);
  y = drawTableHead(doc, y + 10);

  d.lines.forEach((line, i) => {
    const { h } = measureRow(doc, line);
    if (y + h > BODY_BOTTOM) {
      doc.addPage();
      drawHeader(doc, logo, null);
      y = drawTableHead(doc, PAGE_TOP);
    }
    y = drawRow(doc, y, line, i);
  });

  // Keep the sign-off with the table rather than stranding a signature alone
  // on a page of its own.
  if (y + 45 > BODY_BOTTOM) {
    doc.addPage();
    drawHeader(doc, logo, null);
    y = PAGE_TOP;
  }
  drawSignOff(doc, y + 22, d);
  drawFooter(doc);

  return doc;
}

// --- Adapter: a confirmed quotation -> a challan -------------------------

/**
 * The challan lists what is being delivered, so it is built from the priced
 * confirmation's lines — but with the prices dropped. Each line's
 * specifications field becomes the bullet list under its name.
 */
export function quotationToChallan(quotation: Quotation): ChallanDocument {
  const c = quotation.confirmation;
  if (!c) throw new Error("Quotation has no issued order confirmation.");
  const d = quotation.details;

  // The challan carries its own reference series (C prefix) rather than
  // reusing the quotation's: they are separate documents in the company's
  // filing, and the same order can be delivered in more than one consignment.
  const refNumber = c.refNumber.replace(/\/Q-?/i, "/C");

  return {
    refNumber,
    date: new Date().toISOString().slice(0, 10),
    recipient: {
      company: d.companyName || d.fullName,
      address: [d.country].filter(Boolean).join(", "),
    },
    lines: c.lines.map((line) => ({
      name: line.name,
      // Specifications are free text typed per line; split on newlines and
      // commas so a single-line entry still reads as a bullet list.
      bullets: (line.specifications || "")
        .split(/\r?\n|,(?=\s)/)
        .map((s) => s.trim())
        .filter(Boolean),
      quantity: line.quantity,
    })),
    signatoryName: "Md. Nurul Islam",
    signatoryPhone: "+8801713116019",
    fileName: `Challan-${refNumber.replace(/[/\\]/g, "-")}.pdf`,
  };
}

export async function downloadChallanPdf(quotation: Quotation): Promise<void> {
  const spec = quotationToChallan(quotation);
  const doc = await buildChallanPdf(spec);
  doc.save(spec.fileName);
}

/** Base64 (no data: URI prefix) + file name, for the email attachment. */
export async function challanPdfToBase64(
  quotation: Quotation
): Promise<{ base64: string; fileName: string }> {
  const spec = quotationToChallan(quotation);
  const doc = await buildChallanPdf(spec);
  const dataUri = doc.output("datauristring");
  return { base64: dataUri.slice(dataUri.indexOf(",") + 1), fileName: spec.fileName };
}

// --- Money receipt -------------------------------------------------------

export type ReceiptDocument = {
  refNumber: string;
  date: string; // yyyy-mm-dd — when payment was recorded, not today
  recipient: { company: string; address: string };
  amount: number;
  amountInWords: string;
  againstRef: string;
  signatoryName: string;
  signatoryPhone: string;
  fileName: string;
};

/**
 * Acknowledges payment received. Shares the challan's letterhead, centred
 * title box and sign-off; the body is a short block of facts rather than a
 * table, because a receipt records one thing — that this amount was paid.
 */
export async function buildReceiptPdf(d: ReceiptDocument): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rawText = doc.text.bind(doc) as any;
  doc.text = ((t: string | string[], ...rest: any[]) =>
    rawText(Array.isArray(t) ? t.map(ascii) : ascii(String(t)), ...rest)) as typeof doc.text;
  const rawSplit = doc.splitTextToSize.bind(doc) as any;
  doc.splitTextToSize = ((t: string, ...rest: any[]) =>
    rawSplit(ascii(String(t)), ...rest)) as typeof doc.splitTextToSize;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const logo = await loadImage("/logo-mark.png");
  drawHeader(doc, logo, null);

  doc.setFont("helvetica", "normal").setFontSize(10);
  setColor(doc, INK);
  doc.text("To", MARGIN, 42);
  const address = doc.splitTextToSize(d.recipient.address, CONTENT_W - 70);
  doc.text(d.recipient.company, MARGIN, 48);
  doc.text(address, MARGIN, 54);
  doc.text(`Ref: ${d.refNumber}`, PAGE_W - MARGIN, 42, { align: "right" });
  doc.text(`Date: ${formatDate(d.date)}`, PAGE_W - MARGIN, 48, { align: "right" });

  let y = 54 + address.length * 5.5 + 10;

  // Centred outlined title, matching the challan.
  const boxW = 70;
  const boxH = 13;
  doc.setDrawColor(INK[0], INK[1], INK[2]).setLineWidth(0.4);
  doc.roundedRect((PAGE_W - boxW) / 2, y, boxW, boxH, 2.5, 2.5, "S");
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "normal").setFontSize(16);
  doc.text("Money Receipt", PAGE_W / 2, y + 8.8, { align: "center" });
  y += boxH + 14;

  // The amount is the point of the document, so it is boxed and set large
  // rather than being one row among several.
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
  doc.rect(MARGIN, y, CONTENT_W, 16, "FD");
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text("Amount received", MARGIN + 5, y + 6.5);
  doc.setFont("helvetica", "bold").setFontSize(15);
  doc.text(
    `BDT ${d.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    PAGE_W - MARGIN - 5,
    y + 11,
    { align: "right" }
  );
  y += 16 + 8;

  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text("In words:", MARGIN, y);
  const words = doc.splitTextToSize(d.amountInWords, CONTENT_W - 25);
  doc.setFont("helvetica", "bold");
  doc.text(words, MARGIN + 25, y);
  y += words.length * 5.2 + 8;

  doc.setFont("helvetica", "normal");
  doc.text("Received against:", MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.text(d.againstRef, MARGIN + 35, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.text("Payment date:", MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.text(formatDate(d.date), MARGIN + 35, y);
  y += 16;

  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text("Received with thanks.", MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.text(d.signatoryName, MARGIN, y + 30);
  doc.setFont("helvetica", "normal");
  doc.text(d.signatoryPhone, MARGIN, y + 35.5);

  drawFooter(doc);
  return doc;
}

export function quotationToReceipt(quotation: Quotation): ReceiptDocument {
  const c = quotation.confirmation;
  if (!c) throw new Error("Quotation has no issued order confirmation.");
  const d = quotation.details;

  // Receipts carry their own reference series (R), as challans and invoices do.
  const refNumber = c.refNumber.replace(/\/Q-?/i, "/R");
  // The recorded payment date, not today: a receipt reprinted a week later
  // must still say when the money actually came in.
  const paidOn = c.paymentReceivedAt
    ? new Date(c.paymentReceivedAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return {
    refNumber,
    date: paidOn,
    recipient: {
      company: d.companyName || d.fullName,
      address: [d.country].filter(Boolean).join(", "),
    },
    amount: c.grandTotal,
    amountInWords: amountInWords(c.grandTotal),
    againstRef: c.refNumber,
    signatoryName: "Md. Nurul Islam",
    signatoryPhone: "+8801713116019",
    fileName: `Receipt-${refNumber.replace(/[/\\]/g, "-")}.pdf`,
  };
}

export async function downloadReceiptPdf(quotation: Quotation): Promise<void> {
  const spec = quotationToReceipt(quotation);
  const doc = await buildReceiptPdf(spec);
  doc.save(spec.fileName);
}
