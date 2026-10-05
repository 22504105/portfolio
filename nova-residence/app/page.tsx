// Phase 01 review page: shows the design system on real content.
// It is replaced by the landing page in Phase 02.

import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { TextLink } from "@/components/ui/TextLink";
import { images } from "@/data/images";
import { residences } from "@/data/residences";
import { cta, site, stats } from "@/data/site";
import type { SiteImage } from "@/data/types";
import { formatArea, formatPrice } from "@/lib/format";
import { STAGGER } from "@/lib/motion";

const TYPE_ROLES = [
  { name: "type-h1", className: "type-h1", sample: site.tagline },
  { name: "type-h2", className: "type-h2", sample: "Architecture shaped by light." },
  { name: "type-h3", className: "type-h3", sample: "Istanbul at your doorstep." },
  { name: "type-lead", className: "type-lead", sample: site.description },
  {
    name: "type-body",
    className: "type-body",
    sample:
      "Kitchen, dining and living follow one another along the window wall, each with its own outlook over the water.",
  },
  { name: "type-small", className: "type-small", sample: "Approximate travel times by car." },
  { name: "type-eyebrow", className: "type-eyebrow", sample: "Residences" },
];

const SWATCHES = [
  { name: "bg", className: "bg-bg" },
  { name: "surface", className: "bg-surface" },
  { name: "line", className: "bg-line" },
  { name: "line-strong", className: "bg-line-strong" },
  { name: "ink-muted", className: "bg-ink-muted" },
  { name: "ink-secondary", className: "bg-ink-secondary" },
  { name: "ink", className: "bg-ink" },
];

function Controls() {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
      <Button href={cta.viewing.href}>{cta.viewing.label}</Button>
      <Button variant="outline" href={cta.residences.href}>
        {cta.residences.label}
      </Button>
      <Button disabled>Unavailable</Button>
      <TextLink arrow>View Residence</TextLink>
    </div>
  );
}

function Swatches() {
  return (
    <ul className="grid grid-cols-4 gap-x-4 gap-y-6 md:grid-cols-7">
      {SWATCHES.map((swatch) => (
        <li key={swatch.name}>
          <div className={`aspect-square border border-line ${swatch.className}`} />
          <p className="type-small mt-2 text-ink-muted">{swatch.name}</p>
        </li>
      ))}
    </ul>
  );
}

export default function FoundationPage() {
  return (
    <main>
      <Section space="sm">
        <Container>
          <p className="type-eyebrow text-ink-muted">
            Phase 01 — Foundation · {site.disclosure.short}
          </p>
          <h1 className="type-display mt-10">
            Nova
            <br />
            Residence
          </h1>
          <p className="type-lead mt-10 max-w-xl text-ink-secondary">
            {site.tagline} {site.description}
          </p>
        </Container>
      </Section>

      <Section space="sm">
        <Container>
          <h2 className="type-eyebrow text-ink-muted">Type roles</h2>
          <dl className="mt-10 border-t border-line">
            {TYPE_ROLES.map((role) => (
              <div
                key={role.name}
                className="grid-editorial items-baseline border-b border-line py-6"
              >
                <dt className="type-small col-span-4 text-ink-muted md:col-span-2">
                  {role.name}
                </dt>
                <dd className={`col-span-4 md:col-span-6 lg:col-span-10 ${role.className}`}>
                  {role.sample}
                </dd>
              </div>
            ))}
          </dl>

          <ul className="mt-16 grid gap-10 sm:grid-cols-3">
            {stats.map((stat, index) => (
              <li key={stat.label}>
                <Reveal delay={index * STAGGER}>
                  <p className="type-stat">{stat.value}</p>
                  <p className="type-eyebrow mt-4 text-ink-muted">{stat.label}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section space="sm">
        <Container className="space-y-10">
          <h2 className="type-eyebrow text-ink-muted">Tone: base</h2>
          <Swatches />
          <Controls />
        </Container>
      </Section>

      <Section tone="surface" space="sm">
        <Container className="space-y-10">
          <h2 className="type-eyebrow text-ink-muted">Tone: surface</h2>
          <Controls />
        </Container>
      </Section>

      <Section tone="inverse" space="sm">
        <Container className="space-y-10">
          <h2 className="type-eyebrow text-ink-muted">Tone: inverse</h2>
          <Swatches />
          <Controls />
        </Container>
      </Section>

      <section data-tone="image" className="relative isolate text-ink">
        <Image
          src={images.exteriorDusk.src}
          alt={images.exteriorDusk.alt}
          fill
          sizes="100vw"
          placeholder="blur"
          className="-z-10 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-bg/60" />
        <Container className="space-y-10 py-section-md">
          <h2 className="type-eyebrow">Tone: image</h2>
          <p className="type-h2 max-w-2xl">Experience NOVA privately.</p>
          <Controls />
        </Container>
      </section>

      <Section space="sm">
        <Container>
          <h2 className="type-eyebrow text-ink-muted">Residences data</h2>
          <ul className="mt-10 border-t border-line">
            {residences.map((residence) => (
              <li
                key={residence.id}
                className="grid-editorial items-baseline border-b border-line py-6"
              >
                <h3 className="type-h3 col-span-4 md:col-span-3">{residence.name}</h3>
                <p className="type-body col-span-4 text-ink-secondary md:col-span-5 lg:col-span-5">
                  {residence.summary}
                </p>
                <p className="type-small col-span-2 text-ink-muted md:col-span-4 lg:col-span-2">
                  {formatArea(residence.area)}
                </p>
                <p className="type-small col-span-2 text-ink-muted md:col-span-4 lg:col-span-2">
                  From {formatPrice(residence.priceFrom)}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section space="sm">
        <Container>
          <h2 className="type-eyebrow text-ink-muted">Photography</h2>
          <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {Object.entries<SiteImage>(images).map(([name, image]) => (
              <li key={name}>
                <div className="relative aspect-[4/5] bg-surface">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(min-width: 64rem) 25vw, (min-width: 48rem) 33vw, 50vw"
                    placeholder="blur"
                    className="object-cover"
                    style={{ objectPosition: image.position }}
                  />
                </div>
                <p className="type-small mt-2 text-ink-muted">{name}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </main>
  );
}
