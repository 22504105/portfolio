import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Group } from "@/lib/domain/types";
import { checkReportAsk, makeBackup, makeReport, type MadeFile, type ReportAsk } from "@/lib/export/make";
import { fileName } from "@/lib/export/report";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import type { Db } from "./db";
import * as service from "./service";

// A file to take away, made on the server for a real account: a group's
// report, or the backup of everything the person has. Only what the service
// lets this person read goes into it: a group they are not in is "not found"
// here exactly as it is everywhere else.

export type FileAsk = { kind: "report"; groupId: string; locale: Locale; report: ReportAsk } | { kind: "backup" };

/** A request for a file as it arrives (in a request's body, and again inside a ticket), checked; null if it is not one. */
export function readFileAsk(raw: unknown): FileAsk | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { kind, groupId, locale, report } = raw as Record<string, unknown>;
  if (kind === "backup") return { kind };
  if (kind !== "report" || typeof groupId !== "string" || !/^[0-9a-f-]{36}$/.test(groupId) || !isLocale(locale)) return null;
  const checked = checkReportAsk(report);
  return checked ? { kind, groupId, locale, report: checked } : null;
}

/** What the file will be called, for whoever saves it. Reading the group checks that this person may. */
export async function fileNameOf(db: Db, userId: string, ask: FileAsk): Promise<string> {
  if (ask.kind === "backup") return `splitly-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return fileName((await service.getGroup(db, userId, ask.groupId)).name, ask.report.format);
}

async function fonts() {
  const font = async (name: string) => {
    const file = await readFile(join(process.cwd(), "public", "fonts", `${name}.ttf`));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  };
  return { regular: await font("Inter-Regular"), bold: await font("Inter-SemiBold") };
}

async function make(db: Db, userId: string, ask: FileAsk): Promise<MadeFile> {
  if (ask.kind === "report") {
    return makeReport(await service.getGroup(db, userId, ask.groupId), ask.report, getDictionary(ask.locale), ask.locale, fonts);
  }
  const groups: Group[] = [];
  for (const summary of await service.listGroups(db, userId)) groups.push(await service.getGroup(db, userId, summary.id));
  return makeBackup(groups, new Date().toISOString());
}

export async function fileResponse(db: Db, userId: string, ask: FileAsk): Promise<Response> {
  const file = await make(db, userId, ask);
  // A name in plain letters for old programs, and the real one (it may be Cyrillic) for the rest.
  const plain = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return new Response(file.content as BodyInit, {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Telegram's web clients fetch the file from the page they run on, and say so; they are allowed to.
      "Access-Control-Allow-Origin": "https://web.telegram.org",
    },
  });
}
