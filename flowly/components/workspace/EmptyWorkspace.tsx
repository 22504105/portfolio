import { Upload } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import type { Messages } from "@/lib/i18n";

/** What a data page shows before anything has been imported: what will be here, and the one thing to do next. */
export function EmptyWorkspace({ title, messages }: { title: string; messages: Messages }) {
  const t = messages.empty;
  return (
    <>
      <h1 className="type-page">{title}</h1>
      <div className="card mt-7 flex max-w-2xl flex-col items-start p-7 lg:p-9">
        <span className="bg-brand-tint text-brand-hover flex size-11 items-center justify-center rounded-full">
          <Upload aria-hidden="true" className="size-5" />
        </span>
        <h2 className="type-card mt-5 text-[1.0625rem]">{t.title}</h2>
        <p className="text-ink-muted mt-2 max-w-prose">{t.body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/app/imports">{t.cta}</LinkButton>
          <LinkButton href="/demo" variant="outline">
            {t.demo}
          </LinkButton>
        </div>
      </div>
    </>
  );
}
