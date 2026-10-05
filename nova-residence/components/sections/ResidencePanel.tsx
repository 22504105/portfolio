import Image from "next/image";
import { residencesSection } from "@/data/residences";
import type { Residence } from "@/data/types";
import { formatArea, formatPrice } from "@/lib/format";
import { FloorPlan } from "./FloorPlan";
import { ViewingButton } from "./ResidenceDetails";

/** Names the residence dialog. Only one panel is ever in the document. */
export const RESIDENCE_TITLE_ID = "residence-title";

const { detail } = residencesSection;

// The content of the residence details: rendered on the server and handed to
// the drawer, so the client never needs the residence data itself.
export function ResidencePanel({ residence }: { residence: Residence }) {
  const facts = [
    { label: detail.bedrooms, value: residence.bedrooms },
    { label: detail.bathrooms, value: residence.bathrooms },
    { label: detail.area, value: formatArea(residence.area) },
    { label: detail.price, value: formatPrice(residence.priceFrom) },
  ];

  return (
    <div className="px-gutter pt-10 pb-12 lg:px-12 lg:pt-14 lg:pb-16">
      <h2 id={RESIDENCE_TITLE_ID} className="type-h2">
        {residence.name}
      </h2>
      <p className="type-lead mt-4 max-w-xl text-ink-secondary">{residence.summary}</p>

      {/* Shown whole, at its own proportions: the cards crop the same photograph. */}
      <div className="mt-10 max-lg:bleed-left max-lg:bleed-right">
        <Image
          src={residence.image.src}
          alt={residence.image.alt}
          sizes="(min-width: 64rem) 62vw, 100vw"
          placeholder="blur"
          className="h-auto w-full"
        />
      </div>

      <dl className="mt-10 grid grid-cols-2 gap-x-6 border-y border-line md:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col-reverse justify-end gap-2 py-5">
            <dt className="type-eyebrow text-ink-muted">{fact.label}</dt>
            <dd className="type-h3 whitespace-nowrap">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 grid gap-x-12 gap-y-14 lg:grid-cols-2">
        <div>
          <p className="type-body text-ink-secondary">{residence.description}</p>
          <h3 className="type-eyebrow mt-10 text-ink-muted">{detail.highlights}</h3>
          <ul className="mt-4 border-t border-line">
            {residence.highlights.map((highlight) => (
              <li key={highlight} className="type-body border-b border-line py-3">
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <figure>
          <figcaption className="type-eyebrow text-ink-muted">{detail.floorPlan}</figcaption>
          <FloorPlan
            plan={residence.floorPlan}
            interiorLabel={detail.planInterior}
            className="mt-6 max-w-md"
          />
          <p className="type-small mt-5 text-ink-muted">{detail.planNote}</p>
        </figure>
      </div>

      <div className="mt-14 border-t border-line pt-8">
        <ViewingButton>{detail.cta}</ViewingButton>
      </div>
    </div>
  );
}
