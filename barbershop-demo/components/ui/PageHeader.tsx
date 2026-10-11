import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  lead?: string;
  /** Sits beside the title on wide screens: a link or a short note. */
  aside?: ReactNode;
};

/** The top of every inner page: one large title and a line under it. */
export function PageHeader({ eyebrow, title, lead, aside }: PageHeaderProps) {
  return (
    <Container className="pb-12 pt-14 md:pb-20 md:pt-24">
      <p className="type-eyebrow text-muted">{eyebrow}</p>
      <h1 className="type-h1 mt-5 max-w-[16ch]">{title}</h1>
      {(lead || aside) && (
        <div className="mt-8 grid gap-8 md:mt-10 md:grid-cols-12 md:items-end">
          {lead && <p className="type-lead text-muted md:col-span-7 lg:col-span-6">{lead}</p>}
          {aside && <div className="md:col-span-4 md:col-start-9 md:justify-self-end">{aside}</div>}
        </div>
      )}
    </Container>
  );
}
