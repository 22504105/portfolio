import { Container } from "@/components/ui/Container";
import { Photo } from "@/components/ui/Photo";
import { Section } from "@/components/ui/Section";
import { architecture } from "@/data/architecture";

export function Architecture() {
  return (
    <Section id="architecture" labelledBy="architecture-title" tone="inverse">
      <Container>
        <div className="grid-editorial">
          <div className="col-span-4 md:col-span-7 lg:col-span-8">
            <p className="type-eyebrow text-ink-muted">{architecture.eyebrow}</p>
            <h2 id="architecture-title" className="type-h2 mt-6">
              {architecture.headline}
            </h2>
          </div>
        </div>

        <div className="grid-editorial mt-12 items-end gap-y-10 lg:mt-20">
          <Photo
            image={architecture.primaryImage}
            sizes="(min-width: 90rem) 60rem, (min-width: 64rem) 66vw, 100vw"
            className="col-span-4 aspect-6/5 bleed-left max-lg:bleed-right md:col-span-8 lg:aspect-4/3"
          />
          <p className="type-lead col-span-4 md:col-span-6 lg:col-span-4">{architecture.lead}</p>
        </div>

        <div className="grid-editorial mt-16 gap-y-16 lg:mt-32">
          <dl className="col-span-4 grid grid-cols-subgrid content-start self-start md:col-span-8 lg:col-span-6 lg:col-start-7 lg:row-start-1">
            {architecture.notes.map((note) => (
              <div
                key={note.title}
                className="col-span-full grid grid-cols-subgrid gap-y-3 border-t border-line py-6 lg:py-8"
              >
                <dt className="type-eyebrow col-span-4 text-ink-muted md:col-span-2 md:pt-1.5">
                  {note.title}
                </dt>
                <dd className="type-body col-span-4 md:col-span-6 lg:col-span-4">{note.text}</dd>
              </div>
            ))}
          </dl>
          {/* Starts lower than the notes so the pair does not settle into a tidy row. */}
          <Photo
            image={architecture.secondaryImage}
            sizes="(min-width: 90rem) 27rem, (min-width: 64rem) 30vw, (min-width: 48rem) 45vw, 70vw"
            className="col-span-3 col-start-2 aspect-4/5 md:col-span-4 md:col-start-5 lg:col-start-2 lg:row-start-1 lg:mt-40"
          />
        </div>
      </Container>
    </Section>
  );
}
