import { Container } from "@/components/ui/Container";
import { Parallax } from "@/components/ui/Parallax";
import { Photo } from "@/components/ui/Photo";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { architecture } from "@/data/architecture";
import { STAGGER } from "@/lib/motion";

export function Architecture() {
  return (
    <Section id="architecture" labelledBy="architecture-title" tone="inverse">
      <Container>
        <div className="grid-editorial">
          <Reveal className="col-span-4 md:col-span-7 lg:col-span-8">
            <p className="type-eyebrow text-ink-muted">{architecture.eyebrow}</p>
            <h2 id="architecture-title" className="type-h2 mt-6">
              {architecture.headline}
            </h2>
          </Reveal>
        </div>

        <div className="grid-editorial mt-12 items-end gap-y-10 lg:mt-20">
          <Reveal variant="image" className="col-span-4 bleed-left max-lg:bleed-right md:col-span-8">
            <Parallax className="aspect-6/5 lg:aspect-4/3">
              <Photo
                image={architecture.primaryImage}
                sizes="(min-width: 90rem) 60rem, (min-width: 64rem) 66vw, 100vw"
                className="h-full"
              />
            </Parallax>
          </Reveal>
          <Reveal as="p" delay={STAGGER * 2} className="type-lead col-span-4 md:col-span-6 lg:col-span-4">
            {architecture.lead}
          </Reveal>
        </div>

        <div className="grid-editorial mt-16 gap-y-16 lg:mt-32">
          <dl className="col-span-4 grid grid-cols-subgrid content-start self-start md:col-span-5 lg:col-span-6 lg:col-start-7 lg:row-start-1">
            {architecture.notes.map((note) => (
              <div
                key={note.title}
                className="col-span-full grid grid-cols-subgrid gap-y-3 border-t border-line py-6 lg:py-8"
              >
                <dt className="type-eyebrow col-span-full text-ink-muted lg:col-span-2 lg:pt-1.5">
                  {note.title}
                </dt>
                <dd className="type-body col-span-full lg:col-span-4">{note.text}</dd>
              </div>
            ))}
          </dl>
          {/* Beside the notes from md, starting lower so the pair does not settle into a tidy row. */}
          <Photo
            image={architecture.secondaryImage}
            sizes="(min-width: 90rem) 27rem, (min-width: 64rem) 30vw, (min-width: 48rem) 38vw, 70vw"
            className="col-span-3 col-start-2 aspect-4/5 md:col-start-6 md:mt-24 md:max-lg:bleed-right lg:col-span-4 lg:col-start-2 lg:row-start-1 lg:mt-40"
          />
        </div>
      </Container>
    </Section>
  );
}
