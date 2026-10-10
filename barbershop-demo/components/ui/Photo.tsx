import Image from "next/image";
import { useTranslations } from "next-intl";
import { getImage, type ImageKey } from "@/data/images";

type PhotoProps = {
  image: ImageKey;
  /** Rendered width per breakpoint, as for next/image. */
  sizes: string;
  /** Sets the frame: give it an aspect ratio or a height. */
  className?: string;
  /** For the photograph at the top of a page. */
  priority?: boolean;
  /** Decorative photographs are hidden from assistive technology. */
  decorative?: boolean;
};

// A photograph from the set, cropped to its frame. The alternative text comes
// from the message catalog, so it is in the language of the page.
export function Photo({ image, sizes, className = "", priority = false, decorative = false }: PhotoProps) {
  const t = useTranslations("images");
  const alt = decorative ? "" : t(image);
  const file = getImage(image);

  if (!file) {
    // The photograph has not been supplied yet (docs/image-brief.md). The frame
    // keeps its place and says what belongs in it.
    return (
      <div
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative || undefined}
        className={`photo-pending relative overflow-hidden bg-coal ${className}`}
      >
        <span aria-hidden="true" className="type-eyebrow absolute bottom-3 left-3 right-3 text-bone/55">
          {t("pending")} · {t(image)}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-coal ${className}`}>
      <Image
        src={file.src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        blurDataURL={file.blur}
        className="object-cover"
      />
    </div>
  );
}
