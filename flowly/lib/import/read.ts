import { decodeText, delimiterName, fileKind, ImportFileError, parseCsv, toTable, unpackedSize, type FileKind } from "./table";
import { LIMITS, type Cell, type Table } from "./types";

// Reading a file the user chose. It happens in their browser: the file is
// never uploaded. Only the orders they confirm at the end are sent.

export type ReadResult = { kind: FileKind; name: string; table: Table };

/** Blank rows inside a sheet are kept by position so line numbers in messages match the sheet. */
function sheetRows(data: unknown[][]): Cell[][] {
  return data.map((row) => row.map((cell) => (cell === undefined ? null : (cell as Cell))));
}

export async function readImportFile(file: File): Promise<ReadResult> {
  if (file.size > LIMITS.fileBytes) throw new ImportFileError("too_large", "The file is larger than 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = fileKind(file.name, bytes);

  if (kind === "csv") {
    const { text, note } = decodeText(bytes);
    const { rows, delimiter } = parseCsv(text);
    const notes = [`Read as text separated by ${delimiterName(delimiter)}.`];
    if (note) notes.push(note);
    return { kind, name: file.name, table: toTable(rows, notes) };
  }

  if (unpackedSize(bytes) > LIMITS.unpackedBytes) {
    throw new ImportFileError("too_large", "This workbook unpacks to far more than its size on disk and was not opened.");
  }
  // Loaded only when a workbook is actually chosen. The reader returns the
  // values of cells; formulas are not evaluated and macros are never run.
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  let sheets: { sheet: string; data: unknown[][] }[];
  try {
    sheets = (await readXlsxFile(bytes.buffer as ArrayBuffer)) as { sheet: string; data: unknown[][] }[];
  } catch {
    throw new ImportFileError("unreadable", "The workbook could not be read. Save it again as .xlsx, or export it as CSV.");
  }

  const filled = sheets.filter((sheet) => sheet.data.some((row) => row.some((cell) => cell !== null && cell !== "")));
  if (filled.length === 0) throw new ImportFileError("empty", "The workbook has no data.");
  const notes = [`Read the sheet "${filled[0].sheet}".`];
  if (filled.length > 1) notes.push(`The workbook has ${filled.length} sheets with data; only the first is imported.`);
  return { kind, name: file.name, table: toTable(sheetRows(filled[0].data), notes) };
}
