import type { PDFFont, PDFPage } from "pdf-lib";
import type { Table } from "./report";

// The tables as a PDF: A4 on its side, one table after another, a heading
// row repeated on every page. The file is made on the device; the library
// and the two font files are fetched only when a PDF is actually asked for.
// The font is Inter (public/fonts, SIL Open Font License), which carries
// Latin, Turkish and Cyrillic letters. The fonts go into the file whole: cut down to the letters used, this font
// lost most of its letters on the page (seen by opening the file, which is the only test of that).

export type PdfText = { title: string; lines: readonly string[]; page: (n: number, of: number) => string; empty: string };

const PAGE = { width: 841.89, height: 595.28, margin: 36 };
const SIZE = { title: 16, text: 8.5, small: 8 };
const LEADING = 11;
const PAD = 4;

/** Text cut into lines no wider than a column; a word longer than the column is cut where it must be. */
export function wrap(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let rest = word;
      while (measure(rest) > width) {
        // Too long even alone: fill the current line, then cut the word.
        let cut = rest.length - 1;
        while (cut > 1 && measure((line ? `${line} ` : "") + rest.slice(0, cut)) > width) cut--;
        if (line && cut <= 1) {
          lines.push(line);
          line = "";
          continue;
        }
        lines.push((line ? `${line} ` : "") + rest.slice(0, cut));
        line = "";
        rest = rest.slice(cut);
      }
      const joined = line ? `${line} ${rest}` : rest;
      if (measure(joined) <= width) line = joined;
      else {
        lines.push(line);
        line = rest;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * How wide each column is. A short column (a date, an amount, a currency) gets exactly the room its longest cell
 * needs, so it never breaks; the long ones share what is left of the page by how much text they hold.
 */
export function columnWidths(table: Table, total: number, measure: (text: string) => number): number[] {
  const wanted = table.heading.map(
    (heading, x) => Math.max(measure(heading), ...table.rows.map((row) => measure(row[x] ?? ""))) + PAD * 2 + 2,
  );
  const short = wanted.map((width) => width <= 90);
  const kept = wanted.reduce((sum, width, x) => sum + (short[x] ? width : 0), 0);
  const long = wanted.reduce((sum, width, x) => sum + (short[x] ? 0 : Math.min(width, 260)), 0);
  // Nothing long to stretch, or the short ones alone overflow the page: share everything out in proportion.
  if (long === 0 || kept >= total * 0.8) {
    const sum = wanted.reduce((a, b) => a + b, 0);
    return wanted.map((width) => (width / sum) * total);
  }
  return wanted.map((width, x) => (short[x] ? width : (Math.min(width, 260) / long) * (total - kept)));
}

export async function toPdf(
  tables: readonly Table[],
  text: PdfText,
  fonts: { regular: ArrayBuffer; bold: ArrayBuffer },
): Promise<Uint8Array> {
  const [{ PDFDocument, rgb }, fontkit] = await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit")]);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit.default);
  const regular = await document.embedFont(fonts.regular, { subset: false });
  const bold = await document.embedFont(fonts.bold, { subset: false });
  document.setTitle(text.title);
  document.setCreator("Splitly");

  const ink = rgb(0.137, 0.157, 0.149);
  const muted = rgb(0.373, 0.408, 0.384);
  const line = rgb(0.898, 0.914, 0.89);
  const band = rgb(0.89, 0.953, 0.91);
  const inner = PAGE.width - PAGE.margin * 2;

  let page: PDFPage = document.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  const fresh = () => {
    page = document.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
  };
  const write = (value: string, x: number, font: PDFFont, size: number, color = ink) => page.drawText(value, { x, y, font, size, color });

  // Only what the font can draw goes in: a letter it lacks would stop the whole file being made.
  const known = new Set(regular.getCharacterSet());
  const clean = (value: string) => [...value].map((char) => (known.has(char.codePointAt(0)!) ? char : char === " " ? " " : "?")).join("");

  y -= SIZE.title;
  write(clean(text.title), PAGE.margin, bold, SIZE.title);
  y -= 6;
  for (const row of text.lines) {
    y -= LEADING;
    write(clean(row), PAGE.margin, regular, SIZE.text, muted);
  }

  for (const table of tables) {
    const widths = columnWidths(table, inner, (value) => bold.widthOfTextAtSize(clean(value), SIZE.text));
    const starts = widths.map((_, index) => PAGE.margin + widths.slice(0, index).reduce((a, b) => a + b, 0));
    const row = (cells: readonly string[], font: PDFFont, filled: boolean) => {
      const wrapped = cells.map((cell, x) => wrap(clean(cell), widths[x] - PAD * 2, (value) => font.widthOfTextAtSize(value, SIZE.text)));
      const height = Math.max(...wrapped.map((lines) => lines.length)) * LEADING + PAD * 2;
      if (y - height < PAGE.margin + 16) {
        fresh();
        if (!filled) row(table.heading, bold, true);
      }
      if (filled) page.drawRectangle({ x: PAGE.margin, y: y - height, width: inner, height, color: band });
      wrapped.forEach((lines, x) =>
        lines.forEach((value, index) => {
          const width = font.widthOfTextAtSize(value, SIZE.text);
          page.drawText(value, {
            // Amounts stand to the right, so that their decimal points line up.
            x: table.numeric.includes(x) ? starts[x] + widths[x] - PAD - width : starts[x] + PAD,
            y: y - PAD - SIZE.text - index * LEADING,
            font,
            size: SIZE.text,
            color: ink,
          });
        }),
      );
      y -= height;
      page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.margin + inner, y }, thickness: 0.5, color: line });
    };

    if (y < PAGE.margin + 90) fresh();
    y -= 26;
    write(clean(table.title), PAGE.margin, bold, 11);
    y -= 8;
    row(table.heading, bold, true);
    if (table.rows.length === 0) {
      y -= LEADING + PAD;
      write(clean(text.empty), PAGE.margin + PAD, regular, SIZE.text, muted);
      y -= PAD;
    }
    for (const cells of table.rows) row(cells, regular, false);
  }

  const pages = document.getPages();
  pages.forEach((sheet, index) => {
    const label = clean(text.page(index + 1, pages.length));
    sheet.drawText(label, {
      x: PAGE.width - PAGE.margin - regular.widthOfTextAtSize(label, SIZE.small),
      y: PAGE.margin - 14,
      font: regular,
      size: SIZE.small,
      color: muted,
    });
  });
  return document.save();
}
