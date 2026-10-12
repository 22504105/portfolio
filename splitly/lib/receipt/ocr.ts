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
 * each. Words are put into rows by where they are on the page, not by the
 * recogniser's own idea of lines: on a receipt it often takes the names for
 * one column and the prices for another, and a price cut off from its name
 * is worthless.
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
    words.push({ text, left, middle: top + height / 2, height, confidence: Number.isFinite(confidence) ? confidence : 0 });
  }
  if (words.length === 0) return [];

  const heights = words.map((word) => word.height).sort((a, b) => a - b);
  // Words whose middles are within half a typical letter height of each other are on one row.
  const reach = Math.max(4, heights[Math.floor(heights.length / 2)] * 0.5);
  words.sort((a, b) => a.middle - b.middle);

  const rows: Word[][] = [];
  for (const word of words) {
    const row = rows[rows.length - 1];
    const level = row ? row.reduce((sum, other) => sum + other.middle, 0) / row.length : -Infinity;
    if (row && Math.abs(word.middle - level) <= reach) row.push(word);
    else rows.push([word]);
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
 * Reads the picture in the given language. `onProgress` is told how far along
 * it is, from 0 to 1. The worker is always shut down afterwards: on a phone,
 * the memory matters more than the seconds a second scan would save.
 */
export async function recognise(image: Blob, language: OcrLanguage, onProgress: (fraction: number) => void = () => {}): Promise<OcrLine[]> {
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
        if (message.status === "recognizing text") onProgress(0.3 + message.progress * 0.7);
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
    const { data } = await worker.recognize(image, {}, { tsv: true, text: false });
    const lines = linesFromTsv(data.tsv ?? "");
    if (lines.length === 0) throw new OcrError("empty");
    return lines;
  } catch (error) {
    throw error instanceof OcrError ? error : new OcrError("engine");
  } finally {
    await worker.terminate().catch(() => {});
  }
}
