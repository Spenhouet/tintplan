import type { jsPDF } from 'jspdf';
import { family, type Family } from './pens/color';
import type { OwnedPen } from './pens';

export interface ChartText {
  title: string;
  subtitle: string;
  hint: string;
  family: (f: Family) => string;
  footer: (page: number, pages: number) => string;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const COLS = 8;
const GAP = 2.5;
const BOX_H = 10;
const LABEL_H = 8.6;
const ROW_GAP = 2.4;

/**
 * A printable swatch chart of the user's pens: an empty box per pen to color in with the real
 * pen, with code, name, brand and range below, in the picker's color order with family headings.
 * A small dot shows the screen color for reference.
 */
export async function swatchChart(pens: OwnedPen[], text: ChartText): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cellW = (PAGE_W - 2 * MARGIN - (COLS - 1) * GAP) / COLS;
  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 30);
  doc.text(text.title, MARGIN, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 110);
  doc.text(`${text.subtitle} · ${text.hint}`, MARGIN, y + 10);
  y += 15;

  // Pens arrive color-sorted; cut them into family sections
  const sections: { family: Family; pens: OwnedPen[] }[] = [];
  for (const pen of pens) {
    const f = family(pen.hex);
    if (sections.at(-1)?.family === f) sections.at(-1)!.pens.push(pen);
    else sections.push({ family: f, pens: [pen] });
  }

  const rowH = BOX_H + LABEL_H + ROW_GAP;
  for (const section of sections) {
    // Keep a heading together with its first row
    if (y + 6 + rowH > PAGE_H - MARGIN - 4) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 70);
    doc.text(text.family(section.family).toUpperCase(), MARGIN, y + 3.5);
    y += 6;

    section.pens.forEach((pen, i) => {
      const col = i % COLS;
      if (col === 0 && i > 0) y += rowH;
      if (col === 0 && y + rowH > PAGE_H - MARGIN - 4) {
        doc.addPage();
        y = MARGIN;
      }
      cell(doc, pen, MARGIN + col * (cellW + GAP), y, cellW);
    });
    y += rowH + 1;
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 150);
    doc.text(text.footer(p, pages), PAGE_W / 2, PAGE_H - 7, { align: 'center' });
  }
  return new Uint8Array(doc.output('arraybuffer'));
}

function cell(doc: jsPDF, pen: OwnedPen, x: number, y: number, w: number) {
  // The empty box to color in
  doc.setDrawColor(150, 150, 160);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, BOX_H, 1.2, 1.2, 'S');

  // Screen color reference and code
  const v = parseInt(pen.hex.slice(1), 16);
  doc.setFillColor((v >> 16) & 255, (v >> 8) & 255, v & 255);
  doc.setDrawColor(190, 190, 200);
  doc.setLineWidth(0.15);
  doc.circle(x + 1, y + BOX_H + 2.4, 0.9, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(20, 20, 30);
  doc.text(fit(doc, pen.c, w - 2.6), x + 2.6, y + BOX_H + 3.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.4);
  doc.setTextColor(70, 70, 80);
  doc.text(fit(doc, pen.n, w), x, y + BOX_H + 5.6);
  doc.setFontSize(4.8);
  doc.setTextColor(130, 130, 140);
  doc.text(fit(doc, `${pen.brand} ${pen.range}`, w), x, y + BOX_H + 7.8);
}

/** Shorten text with an ellipsis to fit `w` mm at the current font size. */
function fit(doc: jsPDF, s: string, w: number): string {
  if (doc.getTextWidth(s) <= w) return s;
  let t = s;
  while (t.length > 1 && doc.getTextWidth(t + '…') > w) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
