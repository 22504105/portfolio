import { Hammer } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { fill, type Messages } from "@/lib/i18n";
import { sectionHref, type Section, type WorkspaceRoot } from "@/lib/routes";

// A section that is not written yet. It says so plainly, and is replaced by
// its real page in the phase that builds it.
export function BuildingPage({ root, section, messages }: { root: WorkspaceRoot; section: Section; messages: Messages }) {
  const name = messages.nav[section];
  return (
    <>
      <h1 className="type-page">{name}</h1>
      <div className="card mt-7 flex max-w-2xl flex-col items-start p-7 lg:p-9">
        <span className="bg-brand-tint text-brand-hover flex size-11 items-center justify-center rounded-full">
          <Hammer aria-hidden="true" className="size-5" />
        </span>
        <h2 className="type-card mt-5 text-[1.0625rem]">{fill(messages.building.title, { section: name })}</h2>
        <p className="text-ink-muted mt-2 max-w-prose">{messages.building.body}</p>
        <LinkButton href={sectionHref(root, "overview")} variant="outline" className="mt-6">
          {messages.building.back}
        </LinkButton>
      </div>
    </>
  );
}
