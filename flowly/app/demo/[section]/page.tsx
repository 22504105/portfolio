import { Hammer } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/link-button";
import { fill, getMessages } from "@/lib/i18n";
import { isSection, SECTIONS } from "@/lib/routes";

// The sections that are not written yet. Each says so plainly; each is
// replaced by its real page in the phase that builds it. Overview has its own.

export const dynamicParams = false;

export function generateStaticParams() {
  return SECTIONS.filter((section) => section !== "overview").map((section) => ({ section }));
}

export async function generateMetadata({ params }: PageProps<"/demo/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: isSection(section) ? getMessages().nav[section] : undefined };
}

export default async function DemoSectionPage({ params }: PageProps<"/demo/[section]">) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  const messages = getMessages();
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
        <LinkButton href="/demo/overview" variant="outline" className="mt-6">
          {messages.building.back}
        </LinkButton>
      </div>
    </>
  );
}
