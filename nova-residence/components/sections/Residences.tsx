import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Photo } from "@/components/ui/Photo";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { TextLink } from "@/components/ui/TextLink";
import { residences, residencesSection } from "@/data/residences";
import { formatArea, formatPrice } from "@/lib/format";
import { STAGGER } from "@/lib/motion";
import { ResidenceCard, ResidenceDetails } from "./ResidenceDetails";
import { RESIDENCE_TITLE_ID, ResidencePanel } from "./ResidencePanel";

const SIZES_THIRD = "(min-width: 90rem) 27rem, (min-width: 64rem) 30vw, (min-width: 48rem) 50vw, 95vw";

// Each residence starts lower than the one before, echoing the terraced
// building: three steps from `lg`, and at `md` a stepped pair with the third
// residence as a landscape frame below, running to the right edge. On mobile
// the frames alternate between the two screen edges.
const STEP = [
  {
    item: "col-span-4",
    frame: "aspect-3/2 max-lg:bleed-left md:aspect-4/3 lg:aspect-square",
    sizes: SIZES_THIRD,
  },
  {
    item: "col-span-4 md:mt-20",
    frame: "aspect-3/2 max-lg:bleed-right md:aspect-4/3 lg:aspect-square",
    sizes: SIZES_THIRD,
  },
  {
    item: "col-span-4 md:col-span-6 md:col-start-3 lg:col-span-4 lg:col-start-auto lg:mt-40",
    frame: "aspect-3/2 md:max-lg:bleed-right lg:aspect-square",
    sizes: "(min-width: 90rem) 27rem, (min-width: 64rem) 30vw, (min-width: 48rem) 80vw, 95vw",
  },
];

const step = (index: number) => STEP[index % STEP.length];

const panels: Record<string, ReactNode> = Object.fromEntries(
  residences.map((residence) => [residence.id, <ResidencePanel key={residence.id} residence={residence} />]),
);

export function Residences() {
  return (
    <Section id="residences" labelledBy="residences-title">
      <Container>
        <div className="grid-editorial items-end gap-y-8">
          <Reveal className="col-span-4 md:col-span-5 lg:col-span-6">
            <p className="type-eyebrow text-ink-muted">{residencesSection.eyebrow}</p>
            <h2 id="residences-title" className="type-h2 mt-6">
              {residencesSection.headline}
            </h2>
          </Reveal>
          <Reveal
            as="p"
            delay={STAGGER * 2}
            className="type-lead col-span-4 text-ink-secondary md:col-span-6 lg:col-span-5 lg:col-start-8"
          >
            {residencesSection.intro}
          </Reveal>
        </div>

        <ResidenceDetails
          panels={panels}
          titleId={RESIDENCE_TITLE_ID}
          label={residencesSection.eyebrow}
        >
          <div className="grid-editorial mt-14 gap-y-16 md:mt-20">
            {residences.map((residence, index) => (
              // The cards enter one after another along the staircase.
              <Reveal key={residence.id} delay={STAGGER * 2 * index} className={step(index).item}>
                <ResidenceCard residenceId={residence.id} className="group/photo cursor-pointer">
                  <Photo
                    image={residence.image}
                    sizes={step(index).sizes}
                    className={step(index).frame}
                  />
                  <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-4">
                    <h3 className="type-h3">{residence.name}</h3>
                    <p className="type-body text-ink-secondary">{formatArea(residence.area)}</p>
                  </div>
                  <p className="type-body mt-4 text-ink-secondary">{residence.summary}</p>
                  <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-4">
                    <p className="type-body">
                      {residencesSection.priceLabel} {formatPrice(residence.priceFrom)}
                    </p>
                    <TextLink
                      arrow
                      aria-haspopup="dialog"
                      aria-label={`${residencesSection.viewLabel}: ${residence.name}`}
                    >
                      {residencesSection.viewLabel}
                    </TextLink>
                  </div>
                </ResidenceCard>
              </Reveal>
            ))}
          </div>
        </ResidenceDetails>
      </Container>
    </Section>
  );
}
