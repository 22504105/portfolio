import { Container } from "@/components/ui/Container";
import { Photo } from "@/components/ui/Photo";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { contact } from "@/data/contact";
import { images } from "@/data/images";
import { residences } from "@/data/residences";
import { ContactForm } from "./ContactForm";

const residenceChoices = residences.map(({ id, name }) => ({ value: id, label: name }));

export function Contact() {
  return (
    <Section id="contact" labelledBy="contact-title">
      <Container>
        {/* In source order the form precedes the photograph, which is how mobile reads. */}
        <div className="grid-editorial gap-y-14 lg:grid-rows-[auto_1fr] lg:gap-y-20">
          <div className="col-span-4 md:col-span-6 lg:col-span-5">
            <Reveal>
              <p className="type-eyebrow text-ink-muted">{contact.eyebrow}</p>
              <h2 id="contact-title" className="type-h2 mt-6">
                {contact.headline}
              </h2>
            </Reveal>
            <p className="type-lead mt-8">{contact.intro}</p>
            <p className="type-body mt-4 max-w-md text-ink-secondary">{contact.details}</p>
          </div>

          <ContactForm
            residences={residenceChoices}
            className="col-span-4 md:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1 lg:pt-10"
          />

          <Photo
            image={images.bosphorus}
            sizes="(min-width: 90rem) 26rem, (min-width: 64rem) 29vw, (min-width: 48rem) 45vw, 70vw"
            className="col-span-3 col-start-2 aspect-4/5 md:col-span-4 md:col-start-5 lg:col-start-1 lg:row-start-2 lg:self-end"
          />
        </div>
      </Container>
    </Section>
  );
}
