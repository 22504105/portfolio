import Image from "next/image";
import type { SiteImage } from "@/data/types";
import { cn } from "@/lib/cn";

type PhotoProps = {
  image: SiteImage;
  /** Rendered width per breakpoint, as for next/image. */
  sizes: string;
  /** Sets the frame: give it an aspect ratio or a height. */
  className?: string;
  /** Use "span" inside a button or link, where a div is not allowed. */
  as?: "div" | "span";
};

// A photograph from the registry, cropped to its frame around the subject.
// Inside an element with the `group/photo` class it enlarges slightly while
// that element is hovered — for photographs that open something.
export function Photo({ image, sizes, className, as: Frame = "div" }: PhotoProps) {
  return (
    <Frame className={cn("relative block overflow-hidden bg-surface", className)}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        placeholder="blur"
        className="object-cover transition-transform duration-(--duration-slow) ease-quiet motion-safe:group-hover/photo:scale-103"
        style={{ objectPosition: image.position }}
      />
    </Frame>
  );
}
