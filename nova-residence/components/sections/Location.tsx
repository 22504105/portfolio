import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { district, locationSection, travelTimes } from "@/data/location";
import { STAGGER } from "@/lib/motion";
import { LocationMap } from "./LocationMap";

export function Location() {
  return (
    <Section id="location" labelledBy="location-title" tone="surface">
      <Container>
        <div className="grid-editorial items-end gap-y-8">
          <Reveal className="col-span-4 md:col-span-8 lg:col-span-7">
            <p className="type-eyebrow text-ink-muted">{locationSection.eyebrow}</p>
            <h2 id="location-title" className="type-h2 mt-6">
              {locationSection.headline}
            </h2>
          </Reveal>
          <Reveal
            as="p"
            delay={STAGGER * 2}
            className="type-lead col-span-4 text-ink-secondary md:col-span-6 lg:col-span-4 lg:col-start-9"
          >
            {district.description}
          </Reveal>
        </div>

        <div className="grid-editorial mt-12 gap-y-10 md:mt-16 lg:mt-20">
          <Reveal variant="fade" className="col-span-4 md:col-span-8">
            <LocationMap className="aspect-4/5 sm:aspect-4/3" />
          </Reveal>

          <div className="col-span-4 md:col-span-8 lg:col-span-4 lg:col-start-9">
            <dl className="border-b border-line-strong">
              {travelTimes.map((item) => (
                <div
                  key={item.id}
                  className="flex items-baseline justify-between gap-6 border-t border-line-strong py-5 xl:py-6"
                >
                  <dt lang={item.lang} className="type-h3">
                    {item.place}
                  </dt>
                  <dd className="whitespace-nowrap">
                    <span className="type-h3 tabular-nums">{item.minutes}</span>
                    <span className="type-eyebrow ml-2 text-ink-muted">{locationSection.minutesUnit}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="type-small mt-6 text-ink-muted">{locationSection.travelNote}</p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
