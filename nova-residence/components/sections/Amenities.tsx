import { Container } from "@/components/ui/Container";
import { Photo } from "@/components/ui/Photo";
import { Section } from "@/components/ui/Section";
import { amenities, amenitiesSection } from "@/data/amenities";
import { cn } from "@/lib/cn";

type Placement = {
  item: string;
  frame?: string;
  sizes?: string;
  caption?: string;
};

// Where each amenity sits in the mosaic. Frames are unequal on purpose; the
// caption is the same everywhere, so the six still read as one system.
const PLACEMENT: Record<string, Placement> = {
  pool: {
    item: "col-span-full grid-editorial items-end gap-y-5",
    frame:
      "col-span-4 aspect-5/4 max-md:bleed-left max-md:bleed-right md:col-span-8 md:aspect-3/2 lg:col-start-5 lg:row-start-1",
    sizes: "(min-width: 90rem) 54rem, (min-width: 64rem) 62vw, 100vw",
    caption: "col-span-4 md:col-span-5 lg:col-span-4 lg:col-start-1 lg:row-start-1",
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
  // No photograph by design: set as a line of the mosaic under its own rule.
  parking: {
    item: "col-span-4 border-t border-line pt-6 md:col-span-5 lg:col-span-4 lg:mt-32",
  },
  lounge: {
    item: "col-span-2 md:col-span-5",
    frame: "aspect-square md:aspect-3/2",
    sizes: "(min-width: 90rem) 34rem, (min-width: 64rem) 38vw, (min-width: 48rem) 58vw, 45vw",
  },
  gardens: {
    item: "col-span-2 mt-12 md:col-span-3 md:mt-0 lg:mt-16",
    frame: "aspect-3/4",
    sizes: "(min-width: 90rem) 20rem, (min-width: 64rem) 22vw, (min-width: 48rem) 34vw, 45vw",
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
            <p className="type-eyebrow text-ink-muted">{amenitiesSection.eyebrow}</p>
            <h2 id="amenities-title" className="type-h2 mt-6">
              {amenitiesSection.headline}
            </h2>
            <p className="type-lead mt-8 text-ink-secondary">{amenitiesSection.intro}</p>
          </div>
        </div>

        <ul className="grid-editorial mt-14 gap-y-16 md:mt-20 lg:gap-y-28">
          {amenities.map((amenity) => {
            const place = PLACEMENT[amenity.id] ?? FALLBACK;
            return (
              <li key={amenity.id} className={place.item}>
                {amenity.image && place.frame && place.sizes && (
                  <Photo image={amenity.image} sizes={place.sizes} className={place.frame} />
                )}
                <div className={cn(place.caption, amenity.image && !place.caption && "mt-5")}>
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
