import type { CSSProperties } from "react";
import { Container } from "@/components/ui/Container";
import { TextLink } from "@/components/ui/TextLink";
import { navigation } from "@/data/navigation";
import { cta, site, socialLinks } from "@/data/site";
import type { NavItem } from "@/data/types";

// At this size "NOVA RESIDENCE" fills the container on one line.
const WORDMARK_SIZE = { "--display-size": "11.6cqi" } as CSSProperties;

function LinkList({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      <h2 className="type-eyebrow text-ink-muted">{title}</h2>
      <ul className="mt-6 space-y-4">
        {items.map((item) => (
          <li key={item.label}>
            <TextLink href={item.href}>{item.label}</TextLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer data-tone="inverse" className="bg-bg text-ink">
      <Container className="pt-section-sm pb-10">
        <div className="grid-editorial gap-y-14">
          <div className="col-span-4 md:col-span-8 lg:col-span-5">
            <p className="type-h3 max-w-sm">{site.tagline}</p>
            <TextLink href={cta.viewing.href} arrow className="mt-8">
              {cta.viewing.label}
            </TextLink>
          </div>
          <nav aria-label="Footer" className="col-span-2 md:col-span-3 lg:col-span-2 lg:col-start-8">
            <LinkList title="Explore" items={navigation} />
          </nav>
          <div className="col-span-2 md:col-span-3 lg:col-span-2 lg:col-start-11">
            <LinkList title="Follow" items={socialLinks} />
          </div>
        </div>

        <div className="@container mt-section-sm">
          <p className="type-display whitespace-nowrap" style={WORDMARK_SIZE}>
            {site.name}
          </p>
        </div>

        <div className="type-small mt-10 flex flex-wrap justify-between gap-x-10 gap-y-3 border-t border-line pt-6 text-ink-muted">
          <p>{site.location}</p>
          <p>{site.copyright}</p>
          <p className="text-ink">{site.disclosure.long}</p>
        </div>
      </Container>
    </footer>
  );
}
