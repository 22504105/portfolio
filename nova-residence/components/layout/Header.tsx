import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { headerCta, navigation } from "@/data/navigation";
import { site } from "@/data/site";
import { MobileNav } from "./MobileNav";

const NAV_LINK =
  "type-label relative block py-3 after:absolute after:inset-x-0 after:bottom-1 after:h-px " +
  "after:origin-left after:scale-x-0 after:bg-ink after:transition-transform " +
  "after:duration-(--duration-base) after:ease-quiet hover:after:scale-x-100";

// Sits over the sky of the hero photograph, which is light enough to carry
// ink without a scrim. The button is solid because the roofline reaches it.
export function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-(--z-header) text-ink">
      <Container className="flex h-header items-center justify-between gap-8">
        <Link href="#top" className="type-brand py-3" aria-label={`${site.name}, back to top`}>
          {site.shortName}
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-8 xl:gap-10">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={NAV_LINK}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden lg:block">
          <Button href={headerCta.href}>
            {headerCta.label}
          </Button>
        </div>

        <MobileNav />
      </Container>
    </header>
  );
}
