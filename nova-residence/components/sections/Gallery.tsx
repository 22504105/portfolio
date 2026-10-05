import { Container } from "@/components/ui/Container";
import { Photo } from "@/components/ui/Photo";
import { Section } from "@/components/ui/Section";
import { gallery, gallerySection } from "@/data/gallery";
import type { GalleryItem } from "@/data/types";
import { cn } from "@/lib/cn";

type Frame = {
  /** Grid placement of the item at each breakpoint. */
  cell: string;
  /** Aspect ratio of the photograph, close to the source so the subject stays in frame. */
  aspect: string;
  sizes: string;
  /** Runs to both viewport edges on mobile. */
  bleed?: boolean;
};

// Composed by hand, one frame per photograph in data order. Desktop pairs
// unequal frames row by row; mobile alternates an edge-to-edge frame with a
// staggered pair.
const FRAMES: Frame[] = [
  {
    cell: "col-span-4 md:col-span-3 lg:col-span-5",
    aspect: "aspect-4/5",
    sizes: "(min-width: 90rem) 33rem, (min-width: 64rem) 37vw, (min-width: 48rem) 34vw, 100vw",
    bleed: true,
  },
  {
    cell: "col-span-2 md:col-span-5 md:mt-28 lg:col-span-7 lg:col-start-6 lg:mt-48",
    aspect: "aspect-4/5 md:aspect-3/2",
    sizes: "(min-width: 90rem) 47rem, (min-width: 64rem) 53vw, (min-width: 48rem) 57vw, 45vw",
  },
  {
    cell: "col-span-2 mt-12 md:col-span-5 md:mt-0 lg:col-start-2",
    aspect: "aspect-4/5 md:aspect-4/3",
    sizes: "(min-width: 90rem) 33rem, (min-width: 64rem) 37vw, (min-width: 48rem) 57vw, 45vw",
  },
  {
    cell: "col-span-4 md:col-span-3 md:mt-24 lg:col-span-4 lg:col-start-8 lg:mt-40",
    aspect: "aspect-square md:aspect-5/6",
    sizes: "(min-width: 90rem) 26rem, (min-width: 64rem) 29vw, (min-width: 48rem) 34vw, 100vw",
    bleed: true,
  },
  {
    cell: "col-span-2 md:col-span-3 lg:col-span-4 lg:mt-32",
    aspect: "aspect-4/5 md:aspect-square",
    sizes: "(min-width: 90rem) 26rem, (min-width: 64rem) 29vw, (min-width: 48rem) 34vw, 45vw",
  },
  {
    cell: "col-span-2 mt-12 md:col-span-5 md:mt-20 lg:col-span-8 lg:mt-0",
    aspect: "aspect-4/5 md:aspect-2/1",
    sizes: "(min-width: 90rem) 54rem, (min-width: 64rem) 60vw, (min-width: 48rem) 57vw, 45vw",
  },
  {
    cell: "col-span-4 lg:col-span-7",
    aspect: "aspect-4/3",
    sizes: "(min-width: 90rem) 47rem, (min-width: 64rem) 53vw, (min-width: 48rem) 45vw, 100vw",
    bleed: true,
  },
  {
    cell: "col-span-3 col-start-2 md:col-span-4 md:col-start-auto md:mt-32 lg:col-span-5 lg:mt-56",
    aspect: "aspect-3/2",
    sizes: "(min-width: 90rem) 33rem, (min-width: 64rem) 37vw, (min-width: 48rem) 45vw, 70vw",
  },
];

const twoDigits = (value: number) => String(value).padStart(2, "0");

function GalleryFrame({ item, index, frame }: { item: GalleryItem; index: number; frame: Frame }) {
  return (
    <li className={cn(frame.cell, frame.bleed && "max-md:bleed-left max-md:bleed-right")}>
      {/* Phase 03 opens the lightbox from these buttons, by data-gallery-index. */}
      <button
        type="button"
        data-gallery-index={index}
        aria-haspopup="dialog"
        aria-label={`${gallerySection.openLabel}: ${item.caption}`}
        className={cn(
          "block w-full cursor-pointer text-left",
          // At the viewport edge the offset ring would be cut off, so it is drawn inside.
          frame.bleed && "max-md:-outline-offset-2",
        )}
      >
        <Photo as="span" image={item.image} sizes={frame.sizes} className={frame.aspect} />
        <span className={cn("type-eyebrow mt-4 flex gap-3", frame.bleed && "max-md:px-gutter")}>
          <span className="text-ink-muted tabular-nums">{twoDigits(index + 1)}</span>
          <span>{item.caption}</span>
        </span>
      </button>
    </li>
  );
}

export function Gallery() {
  return (
    <Section id="gallery" labelledBy="gallery-title" tone="inverse">
      <Container>
        <div className="grid-editorial items-end">
          <div className="col-span-3 md:col-span-6 lg:col-span-7 lg:col-start-2">
            <p className="type-eyebrow text-ink-muted">{gallerySection.eyebrow}</p>
            <h2 id="gallery-title" className="type-h2 mt-6">
              {gallerySection.headline}
            </h2>
          </div>
          <p
            aria-hidden="true"
            className="type-eyebrow col-span-1 pb-2 text-right text-ink-muted tabular-nums md:col-span-2 lg:col-span-4"
          >
            {twoDigits(1)} — {twoDigits(gallery.length)}
          </p>
        </div>

        <ul className="grid-editorial mt-12 items-start gap-y-14 md:mt-16 md:gap-y-20 lg:mt-24 lg:gap-y-28">
          {gallery.map((item, index) => (
            <GalleryFrame
              key={item.id}
              item={item}
              index={index}
              frame={FRAMES[index % FRAMES.length]}
            />
          ))}
        </ul>
      </Container>
    </Section>
  );
}
