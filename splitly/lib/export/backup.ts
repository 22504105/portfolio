import type { Group } from "@/lib/domain/types";

// A person's own copy of what Splitly holds for them: every group they are
// in, with its people, expenses, payments and exchange rates, as one JSON
// file made on their device. It is for keeping; Splitly does not read such a
// file back in.
//
// Left out on purpose: addresses of Telegram photos (they are Telegram's and
// stop working), and invitation links (they are secrets).

export const BACKUP_FORMAT = "splitly-backup";
export const BACKUP_VERSION = 1;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  /** Amounts are whole minor units of the stated currency: 1250 TRY is 12.50. */
  amounts: "minor-units";
  groups: {
    id: string;
    name: string;
    baseCurrency: string;
    archivedAt: string | null;
    members: { id: string; name: string; role: string; guest: boolean; self: boolean; removedAt: string | null }[];
    expenses: Group["expenses"];
    settlements: Group["settlements"];
    rates: Group["rates"];
  }[];
};

export function backupOf(groups: readonly Group[], exportedAt: string): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    amounts: "minor-units",
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      baseCurrency: group.baseCurrency,
      archivedAt: group.archivedAt,
      members: group.members.map(({ id, name, role, guest, self, removedAt }) => ({ id, name, role, guest, self, removedAt })),
      expenses: group.expenses,
      settlements: group.settlements,
      rates: group.rates,
    })),
  };
}

/** Hands a file made on the device to the browser to save. */
export function saveFile(content: string | Uint8Array, name: string, type: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content as BlobPart], { type }));
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}
