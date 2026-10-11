"use client";

import { usePathname } from "next/navigation";
import type { Messages } from "@/lib/i18n";
import { isSection } from "@/lib/routes";

/** Where you are: the workspace, then the section. */
export function Breadcrumb({ workspaceName, labels }: { workspaceName: string; labels: Messages["nav"] }) {
  const section = usePathname().split("/")[2] ?? "";

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-[0.9375rem]">
        <li className="text-ink-muted truncate max-sm:hidden">{workspaceName}</li>
        <li aria-hidden="true" className="text-ink-muted max-sm:hidden">
          /
        </li>
        <li aria-current="page" className="text-ink truncate font-medium">
          {isSection(section) ? labels[section] : ""}
        </li>
      </ol>
    </nav>
  );
}
