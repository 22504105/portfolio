import type { OcrLine } from "./parse";

// Reading a photo of a receipt, on the device. The recogniser runs in a
// worker in this page, from files Splitly serves itself (see
// scripts/ocr-assets.mjs): the photo and its text go nowhere.

export const OCR_LANGUAGES = ["tur", "eng", "rus"] as const;
export type OcrLanguage = (typeof OCR_LANGUAGES)[number];

export type OcrFailure = "load" | "engine" | "empty";

export class OcrError extends Error {
  constructor(public reason: OcrFailure) {
    super(reason);
  }
}

/**
 * The recogniser's table of words, as rows of text with how sure it was of
 * each. Words are put into rows by where they are on the page: a price
 * belongs to the name at the same height, whatever the recogniser took for
 * lines and columns. A receipt is rarely photographed square on, so the
 * page's slant is found first and taken out: otherwise the price at the far
 * end of a slanting row lands on the row above or below.
 */
export function linesFromTsv(tsv: string): OcrLine[] {
  type Word = { text: string; left: number; middle: number; height: number; confidence: number };
  const words: Word[] = [];
  for (const row of tsv.split("\n")) {
    const cells = row.split("\t");
    // level, page, block, paragraph, line, word, left, top, width, height, confidence, text. Level 5 is a word.
    if (cells.length < 12 || cells[0] !== "5") continue;
    const text = cells.slice(11).join("\t").trim();
    const [left, top, height, confidence] = [Number(cells[6]), Number(cells[7]), Number(cells[9]), Number(cells[10])];
    if (!text || !Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(height)) continue;
    words.push({
      text,
      left,
      middle: top + height / 2,
      height,
      confidence: Number.isFinite(confidence) ? confidence : 0,
    });
  }
  if (words.length === 0) return [];

  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const letter = median(words.map((word) => word.height));
  // Specks and rules are not letters: they would pull a row up or down.
  const real = words.filter((word) => word.height >= letter * 0.5 && word.height <= letter * 2.5);

  // Words whose levels are within half a letter's height of each other are on one row.
  const reach = Math.max(4, letter * 0.5);
  const rowsAt = (slant: number): Word[][] => {
    const level = (word: Word) => word.middle - slant * word.left;
    const sorted = [...real].sort((x, y) => level(x) - level(y));
    const rows: Word[][] = [];
    for (const word of sorted) {
      const row = rows[rows.length - 1];
      const mean = row ? row.reduce((sum, other) => sum + level(other), 0) / row.length : -Infinity;
      if (row && Math.abs(level(word) - mean) <= reach) row.push(word);
      else rows.push([word]);
    }
    return rows;
  };

  // The slant is the one at which the words fall into the fewest rows: square on, every word of a printed row is at
  // one height; at any other angle rows smear into each other's neighbours and break up. Tried from about seven
  // degrees one way to seven the other (a photo held by hand), the straight page first so that it wins a tie.
  let rows = rowsAt(0);
  for (let step = 1; step <= 30 && real.length > 3; step++) {
    for (const slant of [step * 0.004, -step * 0.004]) {
      const tried = rowsAt(slant);
      if (tried.length < rows.length) rows = tried;
    }
  }
  return rows.map((row) => {
    row.sort((a, b) => a.left - b.left);
    return {
      text: row.map((word) => word.text).join(" "),
      confidence: Math.round(row.reduce((sum, word) => sum + word.confidence, 0) / row.length),
    };
  });
}

/**
 * Reads the pictures in the given language, one after another with one
 * worker, and gives back each one's rows. `onProgress` is told how far along
 * it is, from 0 to 1. The first picture must be read; if a later one fails
 * (a phone short of memory), what was read so far is returned. The worker is
 * always shut down afterwards: on a phone, the memory matters more than the
 * seconds a second scan would save.
 */
export async function recognise(
  images: readonly Blob[],
  language: OcrLanguage,
  onProgress: (fraction: number) => void = () => {},
): Promise<OcrLine[][]> {
  let reading = 0;
  const { createWorker } = await import("tesseract.js").catch(() => {
    throw new OcrError("load");
  });
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    worker = await createWorker(language, 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      gzip: true,
      // The worker is loaded as a file of this site, not built from a blob: the content policy allows only that.
      workerBlobURL: false,
      // Reading data is kept by the browser after the first scan, so the next one works with a poor connection.
      cacheMethod: "write",
      logger: (message: { status: string; progress: number }) => {
        if (message.status === "recognizing text") onProgress(0.3 + ((reading + message.progress) / images.length) * 0.7);
        else if (typeof message.progress === "number") onProgress(Math.min(0.3, message.progress * 0.3));
      },
      errorHandler: () => {},
    });
  } catch {
    // The worker, the engine or the language data did not arrive: offline, or blocked.
    throw new OcrError("load");
  }
  try {
    // One block of text read row by row. (The "single column" mode reads a receipt as two columns, names and then
    // prices, because of the gap between them: every price loses its name.)
    await worker.setParameters({ tessedit_pageseg_mode: "6" as never, preserve_interword_spaces: "1" });
    const readings: OcrLine[][] = [];
    for (const image of images) {
      try {
        const { data } = await worker.recognize(image, {}, { tsv: true, text: false });
        readings.push(linesFromTsv(data.tsv ?? ""));
      } catch (error) {
        if (readings.length === 0) throw error;
        break;
      }
      reading++;
    }
    if (readings.every((lines) => lines.length === 0)) throw new OcrError("empty");
    return readings;
  } catch (error) {
    throw error instanceof OcrError ? error : new OcrError("engine");
  } finally {
    await worker.terminate().catch(() => {});
  }
}
