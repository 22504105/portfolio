import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Photo } from "@/components/ui/Photo";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { TextLink } from "@/components/ui/TextLink";
import { residences, residencesSection } from "@/data/residences";
import { cn } from "@/lib/cn";
import { formatArea, formatPrice } from "@/lib/format";
import { STAGGER } from "@/lib/motion";
import { ResidenceCard, ResidenceDetails } from "./ResidenceDetails";
import { RESIDENCE_TITLE_ID, ResidencePanel } from "./ResidencePanel";

// Each residence starts lower than the one before, echoing the terraced
// building. On mobile the frames alternate between the two screen edges.
const STEP = [
  { item: "", frame: "max-lg:bleed-left" },
  { item: "lg:mt-20", frame: "max-lg:bleed-right" },
  { item: "lg:mt-40", frame: "" },
];

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
          {/* Three equal columns with the editorial gutters: four grid columns each at lg. */}
          <div className="mt-14 grid grid-cols-1 gap-y-16 md:mt-20 lg:grid-cols-3 lg:gap-x-6 xl:gap-x-8">
            {residences.map((residence, index) => (
              // The cards enter one after another along the staircase.
              <Reveal key={residence.id} delay={STAGGER * 2 * index} className={STEP[index]?.item}>
                <ResidenceCard residenceId={residence.id} className="group/photo cursor-pointer">
                  <Photo
                    image={residence.image}
                    sizes="(min-width: 90rem) 27rem, (min-width: 64rem) 30vw, 95vw"
                    className={cn("aspect-3/2 lg:aspect-square", STEP[index]?.frame)}
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
