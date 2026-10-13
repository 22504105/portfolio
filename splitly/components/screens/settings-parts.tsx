import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// The pieces the profile is made of, as Stitch draws it: a small heading with
// its picture above each card, and inside the card one row per setting.

export function SectionTitle({ icon: Icon, id, children }: { icon: LucideIcon; id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="type-heading mt-7 flex items-center gap-2">
      <Icon aria-hidden="true" className="text-ink-muted size-5 shrink-0" />
      {children}
    </h2>
  );
}

type SettingRowProps = {
  icon: LucideIcon;
  title: string;
  /** For a control that takes its name from the title. */
  titleId?: string;
  hint?: string;
  /** The control, beside the words where there is room and under them where there is not. */
  children?: ReactNode;
};

export function SettingRow({ icon: Icon, title, titleId, hint, children }: SettingRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3 p-4">
      <span aria-hidden="true" className="bg-surface-2 text-ink flex size-11 shrink-0 items-center justify-center rounded-[12px]">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <h3 id={titleId} className="font-semibold">
          {title}
        </h3>
        {hint && <p className="text-ink-muted text-[0.8125rem] leading-5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
