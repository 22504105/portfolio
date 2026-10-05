import { Container } from "@/components/ui/Container";
import { Parallax } from "@/components/ui/Parallax";
import { Photo } from "@/components/ui/Photo";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { intro } from "@/data/intro";
import { stats } from "@/data/site";
import { cn } from "@/lib/cn";
import { STAGGER } from "@/lib/motion";

// Unequal on purpose: the figures read as one measured line, not three boxes.
// On the 8-column grid the narrowest figure takes the narrow cell, so "24/7" fits.
const STAT_SPAN = [
  "md:col-span-2 lg:col-span-5",
  "md:col-span-3 lg:col-span-4",
  "md:col-span-3 lg:col-span-3",
];

export function Introduction() {
  return (
    <Section id="intro" labelledBy="intro-title" space="none" className="pt-section-md pb-section-sm">
      <Container>
        <div className="grid-editorial">
          <Reveal className="col-span-4 md:col-span-6 lg:col-span-7">
            <p className="type-eyebrow text-ink-muted">{intro.eyebrow}</p>
            <h2 id="intro-title" className="type-h2 mt-6">
              {intro.headline}
            </h2>
          </Reveal>
        </div>

        <div className="grid-editorial mt-12 gap-y-12 md:mt-16 lg:mt-24">
          <Reveal variant="image" className="col-span-4 max-md:bleed-right lg:col-span-5">
            <Parallax className="aspect-4/5">
              <Photo
                image={intro.image}
                sizes="(min-width: 90rem) 34rem, (min-width: 64rem) 38vw, (min-width: 48rem) 45vw, 95vw"
                className="h-full"
              />
            </Parallax>
          </Reveal>
          <div className="col-span-4 md:pt-28 lg:col-span-5 lg:col-start-7 lg:pt-24">
            <Reveal as="p" delay={STAGGER * 2} className="type-lead">
              {intro.lead}
            </Reveal>
            <div className="mt-8 space-y-5 text-ink-secondary">
              {intro.body.map((paragraph) => (
                <p key={paragraph} className="type-body">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>

        <Reveal as="dl" variant="fade" className="grid-editorial mt-section-sm border-t border-line">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                "col-span-4 flex flex-row-reverse items-baseline justify-between gap-6 py-6",
                "max-md:border-b max-md:border-line",
                "md:flex-col-reverse md:items-start md:justify-end md:gap-5 md:pt-8 md:pb-0",
                index > 0 && "md:border-l md:border-line md:pl-6 xl:pl-8",
                STAT_SPAN[index],
              )}
            >
              <dt className="type-eyebrow text-ink-muted">{stat.label}</dt>
              <dd className="type-stat">{stat.value}</dd>
            </div>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}
