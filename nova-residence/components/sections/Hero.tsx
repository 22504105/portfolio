import { getImageProps } from "next/image";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { TextLink } from "@/components/ui/TextLink";
import { images } from "@/data/images";
import { cta, site } from "@/data/site";

// The wide frame serves landscape viewports and the tall one portrait, so the
// switch follows the shape of the screen rather than its width. The `wide:`
// variant in globals.css uses the same condition.
const WIDE_FRAME = "(min-aspect-ratio: 1/1)";

export function Hero() {
  const { heroDesktop, heroMobile } = images;
  const shared = { alt: heroMobile.alt, sizes: "100vw", loading: "eager", fetchPriority: "high" } as const;
  const wide = getImageProps({ ...shared, src: heroDesktop.src }).props;
  const tall = getImageProps({ ...shared, src: heroMobile.src }).props;

  return (
    <section aria-labelledby="hero-title" className="flex flex-col lg:wide:h-svh lg:wide:min-h-176">
      {/*
        No scrim: the wordmark is set in ink on the sky, which both frames
        keep clear. The tall frame needs its minimum height, and the wide frame
        a narrower wordmark, for the type to stay inside that sky.
      */}
      <div className="relative h-[86svh] min-h-184 wide:h-auto wide:min-h-0 wide:aspect-16/10 lg:wide:aspect-auto lg:wide:flex-1">
        <picture>
          <source media={WIDE_FRAME} srcSet={wide.srcSet} sizes={wide.sizes} />
          <img
            {...tall}
            alt={heroMobile.alt}
            className="absolute inset-0 size-full object-cover object-(--tall-position) wide:object-(--wide-position)"
            style={
              {
                ...tall.style,
                "--tall-position": heroMobile.position,
                "--wide-position": heroDesktop.position,
              } as CSSProperties
            }
          />
        </picture>

        <Container className="relative pt-18 lg:pt-28">
          <div className="grid-editorial">
            <div className="@container col-span-4 md:col-span-5 lg:col-span-6 wide:max-w-[40vw]">
              <p className="type-display">
                Nova
                <br />
                Residence
              </p>
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-10 lg:py-12">
        <div className="grid-editorial items-end gap-y-8">
          <h1 id="hero-title" className="type-h1 col-span-4 md:col-span-8 lg:col-span-7">
            {site.tagline}
          </h1>
          <div className="col-span-4 md:col-span-6 lg:col-span-4 lg:col-start-9">
            <p className="type-lead text-ink-secondary">{site.description}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-6">
              <Button href={cta.residences.href}>{cta.residences.label}</Button>
              <TextLink href={cta.viewing.href} arrow>
                {cta.viewing.label}
              </TextLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
