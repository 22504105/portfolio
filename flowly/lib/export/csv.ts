// Writing CSV that is safe to open in a spreadsheet.

/**
 * A spreadsheet treats a cell that starts with = + - @ (or a tab or carriage
 * return) as a formula. Text that came from someone's file must never run as
 * one, so such cells get a leading apostrophe, which spreadsheets show as
 * plain text. Numbers written by Flowly itself are passed as numbers and are
 * left alone, so a negative amount stays a number.
 */
export function neutralise(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value) : neutralise(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows as CSV text: RFC 4180 quoting, CRLF line ends, and a byte-order mark so Excel reads UTF-8. */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** A CSV response that the browser saves under a file name. */
export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
