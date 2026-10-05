import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { headerCta } from "@/data/navigation";
import { site } from "@/data/site";
import { HeaderShell } from "./HeaderShell";
import { MobileNav } from "./MobileNav";
import { PrimaryNav } from "./PrimaryNav";

// At the top of the page it sits over the sky of the hero photograph, which is
// light enough to carry ink without a scrim. The button is solid because the
// roofline reaches it.
export function Header() {
  return (
    <HeaderShell>
      <Container className="flex h-full items-center justify-between gap-8">
        {/*
          At the top of the page the hero wordmark is right below, so the mark is
          hidden there — keeping its space, out of the tab order and unannounced.
        */}
        <Link
          href="#top"
          className="type-brand invisible py-3 group-data-scrolled/header:visible"
          aria-label={`${site.name}, back to top`}
        >
          {site.shortName}
        </Link>

        <PrimaryNav />

        <div className="hidden lg:block">
          <Button href={headerCta.href}>{headerCta.label}</Button>
        </div>

        <MobileNav />
      </Container>
    </HeaderShell>
  );
}
