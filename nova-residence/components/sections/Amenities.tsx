import { Container } from "@/components/ui/Container";
import { Photo } from "@/components/ui/Photo";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { amenities, amenitiesSection } from "@/data/amenities";
import { STAGGER } from "@/lib/motion";

type Placement = {
  item: string;
  frame: string;
  sizes: string;
  caption?: string;
  /** The one large photograph of the section is unveiled; the rest are still. */
  reveal?: boolean;
};

// Where each photographed amenity sits in the mosaic. Frames are unequal on
// purpose; the caption is the same everywhere, so they still read as one system.
const PLACEMENT: Record<string, Placement> = {
  pool: {
    item: "col-span-full grid-editorial items-end gap-y-5",
    frame:
      "col-span-4 aspect-5/4 max-md:bleed-left max-md:bleed-right md:col-span-8 md:aspect-3/2 lg:col-start-5 lg:row-start-1",
    sizes: "(min-width: 90rem) 54rem, (min-width: 64rem) 62vw, 100vw",
    caption: "col-span-4 md:col-span-5 lg:col-span-4 lg:col-start-1 lg:row-start-1",
    reveal: true,
  },
  fitness: {
    item: "col-span-3 md:col-span-4 lg:col-span-5",
    frame: "aspect-4/3 max-md:bleed-left",
    sizes: "(min-width: 90rem) 34rem, (min-width: 64rem) 38vw, (min-width: 48rem) 45vw, 75vw",
  },
  concierge: {
    item: "col-span-3 col-start-2 md:col-span-4 md:col-start-auto md:mt-24 lg:col-span-6 lg:col-start-7",
    frame: "aspect-3/2 max-md:bleed-right lg:aspect-2/1",
    sizes: "(min-width: 90rem) 41rem, (min-width: 64rem) 46vw, (min-width: 48rem) 45vw, 75vw",
  },
  lounge: {
    item: "col-span-4 md:col-span-5 lg:col-span-7",
    frame: "aspect-3/2",
    sizes: "(min-width: 90rem) 47rem, (min-width: 64rem) 53vw, (min-width: 48rem) 58vw, 90vw",
  },
  gardens: {
    item: "col-span-3 md:mt-16 lg:col-span-5",
    frame: "aspect-4/5 md:aspect-3/4 lg:aspect-4/5",
    sizes: "(min-width: 90rem) 33rem, (min-width: 64rem) 37vw, (min-width: 48rem) 34vw, 70vw",
  },
};

const FALLBACK: Placement = {
  item: "col-span-4 lg:col-span-6",
  frame: "aspect-3/2",
  sizes: "(min-width: 64rem) 46vw, 90vw",
};

export function Amenities() {
  return (
    <Section id="amenities" labelledBy="amenities-title">
      <Container>
        <div className="grid-editorial">
          <div className="col-span-4 md:col-span-6 lg:col-span-6 lg:col-start-5">
            <Reveal>
              <p className="type-eyebrow text-ink-muted">{amenitiesSection.eyebrow}</p>
              <h2 id="amenities-title" className="type-h2 mt-6">
                {amenitiesSection.headline}
              </h2>
            </Reveal>
            <Reveal as="p" delay={STAGGER * 2} className="type-lead mt-8 text-ink-secondary">
              {amenitiesSection.intro}
            </Reveal>
          </div>
        </div>

        <ul className="grid-editorial mt-14 gap-y-16 md:mt-20 lg:gap-y-28">
          {amenities.map((amenity) => {
            // No photograph by design: a line across the grid under its own rule,
            // the name on the left and the description on the right.
            if (!amenity.image) {
              return (
                <li
                  key={amenity.id}
                  className="grid-editorial col-span-full gap-y-3 border-t border-line pt-6 md:pt-8"
                >
                  <h3 className="type-h3 col-span-4 md:col-span-3 lg:col-span-4">{amenity.name}</h3>
                  <p className="type-body col-span-4 text-ink-secondary md:col-span-5 lg:col-start-8">
                    {amenity.description}
                  </p>
                </li>
              );
            }

            const place = PLACEMENT[amenity.id] ?? FALLBACK;
            return (
              <li key={amenity.id} className={place.item}>
                {place.reveal ? (
                  <Reveal variant="image" className={place.frame}>
                    <Photo image={amenity.image} sizes={place.sizes} className="h-full" />
                  </Reveal>
                ) : (
                  <Photo image={amenity.image} sizes={place.sizes} className={place.frame} />
                )}
                <div className={place.caption ?? "mt-5"}>
                  <h3 className="type-h3">{amenity.name}</h3>
                  <p className="type-body mt-3 text-ink-secondary">{amenity.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
