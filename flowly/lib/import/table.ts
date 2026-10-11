import Papa from "papaparse";
import { LIMITS, type Cell, type Table } from "./types";
import { cellText } from "./values";

// From the bytes of a file to a Table, without trusting the file. Everything
// here works on bytes and text, so it runs the same in a browser and in a test.

export class ImportFileError extends Error {
  constructor(
    public code: "too_large" | "wrong_type" | "empty" | "too_many_rows" | "too_many_columns" | "unreadable" | "no_header",
    message: string,
  ) {
    super(message);
  }
}

export type FileKind = "csv" | "xlsx";

/** What kind of file this is, by its name and by what is actually in it. Both must agree. */
export function fileKind(name: string, bytes: Uint8Array): FileKind {
  if (bytes.byteLength > LIMITS.fileBytes) throw new ImportFileError("too_large", "The file is larger than 5 MB.");
  if (bytes.byteLength === 0) throw new ImportFileError("empty", "The file is empty.");

  const extension = name.toLowerCase().split(".").pop();
  const zipped = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

  if (extension === "xlsx") {
    if (!zipped) throw new ImportFileError("wrong_type", "This file is named .xlsx but is not an Excel workbook.");
    return "xlsx";
  }
  if (extension === "csv" || extension === "txt" || extension === "tsv") {
    if (zipped) throw new ImportFileError("wrong_type", "This file is named as text but is a zip archive or a workbook.");
    // Text has no zero bytes, unless it is UTF-16, which announces itself.
    const utf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);
    if (!utf16 && bytes.subarray(0, 4096).includes(0)) throw new ImportFileError("wrong_type", "This file is not text.");
    return "csv";
  }
  throw new ImportFileError("wrong_type", "Only .csv and .xlsx files can be imported. Macro-enabled and older Excel formats are not read.");
}

/**
 * How large a zip archive says it will be once unpacked, read from its table
 * of contents without unpacking anything. A workbook is a zip; a few
 * kilobytes can be made to unpack to gigabytes, so this is checked first.
 */
export function unpackedSize(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The table of contents is found from a record at the very end of the file.
  let end = -1;
  for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new ImportFileError("unreadable", "The workbook is damaged.");

  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  let total = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50)
      throw new ImportFileError("unreadable", "The workbook is damaged.");
    total += view.getUint32(offset + 24, true);
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  return total;
}

/** The text of a file. UTF-8 and UTF-16 are read as such; anything else as Western European, with a note. */
export function decodeText(bytes: Uint8Array): { text: string; note: string | null } {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(bytes), note: null };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(bytes), note: null };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), note: null };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(bytes),
      note: "The file is not UTF-8. It was read as Western European (Windows-1252); check that accented letters look right.",
    };
  }
}

/** The rows of a CSV file. The delimiter (comma, semicolon, tab, pipe) is detected. Nothing in a cell is evaluated. */
export function parseCsv(text: string): { rows: string[][]; delimiter: string } {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy", delimitersToGuess: [",", ";", "\t", "|"] });
  const fatal = result.errors.find((error) => error.type === "Quotes" && error.code === "MissingQuotes");
  if (fatal) throw new ImportFileError("unreadable", `A quoted value is never closed (around line ${(fatal.row ?? 0) + 1}).`);
  return { rows: result.data, delimiter: result.meta.delimiter };
}

const DELIMITER_NAMES: Record<string, string> = { ",": "comma", ";": "semicolon", "\t": "tab", "|": "pipe" };
export const delimiterName = (delimiter: string) => DELIMITER_NAMES[delimiter] ?? delimiter;

/**
 * Rows as a Table: the first row with at least two filled cells among the
 * first ten is the header, everything after it is data. Enforces the row and
 * column limits.
 */
export function toTable(rows: Cell[][], notes: string[] = []): Table {
  const headerIndex = rows.slice(0, 10).findIndex((row) => row.filter((cell) => cellText(cell) !== "").length >= 2);
  if (headerIndex === -1) {
    if (rows.every((row) => row.every((cell) => cellText(cell) === ""))) throw new ImportFileError("empty", "The file has no data.");
    throw new ImportFileError("no_header", "No header row was found. The first row should name at least two columns.");
  }

  const width = Math.max(...rows.slice(headerIndex).map((row) => row.length));
  if (width > LIMITS.columns) throw new ImportFileError("too_many_columns", `The file has more than ${LIMITS.columns} columns.`);

  const seen = new Map<string, number>();
  const headers = Array.from({ length: width }, (_, index) => {
    const name = cellText(rows[headerIndex][index]).slice(0, 80) || `Column ${index + 1}`;
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    // Two columns with one name are told apart, so a mapping never means "one of them".
    return count === 1 ? name : `${name} (${count})`;
  });

  const data: Cell[][] = [];
  let firstRowNumber = headerIndex + 2;
  rows.slice(headerIndex + 1).forEach((row, index) => {
    if (row.every((cell) => cellText(cell) === "")) {
      // Blank lines before the first data row shift where the data starts; later ones are just skipped.
      if (data.length === 0) firstRowNumber = headerIndex + index + 3;
      return;
    }
    data.push(row);
  });

  if (data.length === 0) throw new ImportFileError("empty", "The file has a header row and no data under it.");
  if (data.length > LIMITS.rows)
    throw new ImportFileError(
      "too_many_rows",
      `The file has ${data.length.toLocaleString("en-US")} rows; the limit is ${LIMITS.rows.toLocaleString("en-US")}.`,
    );
  if (headerIndex > 0) notes.push(`The header was found on line ${headerIndex + 1}; the lines above it were skipped.`);
  return { headers, rows: data, firstRowNumber, notes };
}
