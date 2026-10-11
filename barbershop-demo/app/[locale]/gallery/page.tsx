import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { BookingCallout } from "@/components/site/BookingCallout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Photo } from "@/components/ui/Photo";
import type { ImageKey } from "@/data/images";
import { pageLocale, pageMetadata } from "@/lib/page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/gallery">) =>
  pageMetadata(params, "gallery", "/gallery");

const WIDE = "aspect-3/2";
const TALL = "aspect-4/5";

// The layout is set by hand, like a magazine spread: each photograph has its
// own width, shape and vertical offset, so the rows do not line up as a grid.
// On a phone they simply follow one another.
const SPREAD: { image: ImageKey; shape: string; place: string; sizes: string }[] = [
  { image: "shopfront", shape: WIDE, place: "md:col-span-8", sizes: "(min-width: 48rem) 66vw, 100vw" },
  { image: "chair", shape: TALL, place: "md:col-span-4 md:mt-24", sizes: "(min-width: 48rem) 33vw, 100vw" },
  { image: "skinFade", shape: TALL, place: "md:col-span-5", sizes: "(min-width: 48rem) 42vw, 100vw" },
  { image: "hotTowel", shape: WIDE, place: "md:col-span-7 md:mt-32", sizes: "(min-width: 48rem) 58vw, 100vw" },
  { image: "tools", shape: WIDE, place: "md:col-span-6 md:col-start-2", sizes: "(min-width: 48rem) 50vw, 100vw" },
  { image: "finish", shape: TALL, place: "md:col-span-4 md:col-start-9 md:-mt-16", sizes: "(min-width: 48rem) 33vw, 100vw" },
  { image: "beardTrim", shape: WIDE, place: "md:col-span-7", sizes: "(min-width: 48rem) 58vw, 100vw" },
  { image: "wash", shape: WIDE, place: "md:col-span-5 md:mt-20", sizes: "(min-width: 48rem) 42vw, 100vw" },
];

export default async function GalleryPage({ params }: PageProps<"/[locale]/gallery">) {
  await pageLocale(params);
  const t = await getTranslations();

  return (
    <>
      <PageHeader eyebrow={t("gallery.eyebrow")} title={t("gallery.title")} lead={t("gallery.lead")} />

      <Container className="pb-section">
        <ul className="grid gap-x-6 gap-y-10 md:grid-cols-12 md:gap-y-16">
          {SPREAD.map(({ image, shape, place, sizes }, index) => (
            <li key={image} className={place}>
              <figure>
                {/* The caption below says what the photograph shows. */}
                <Photo image={image} sizes={sizes} decorative className={shape} />
                <figcaption className="type-small mt-3 flex gap-4 text-muted">
                  <span aria-hidden="true" className="tabular-nums text-signal">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {t(`images.${image}`)}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Container>

      <BookingCallout />
    </>
  );
}
