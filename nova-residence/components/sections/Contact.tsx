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
        {/*
          In source order the photograph sits between the copy and the form, which
          is how mobile reads. From lg it takes the height the form leaves under
          the copy, so the two columns end on one line.
        */}
        <div className="grid-editorial gap-y-14 lg:grid-rows-[auto_1fr] lg:gap-y-20">
          <div className="col-span-4 md:col-span-5">
            <Reveal>
              <p className="type-eyebrow text-ink-muted">{contact.eyebrow}</p>
              <h2 id="contact-title" className="type-h2 mt-6">
                {contact.headline}
              </h2>
            </Reveal>
            <p className="type-lead mt-8">{contact.intro}</p>
            <p className="type-body mt-4 max-w-md text-ink-secondary">{contact.details}</p>
          </div>

          <Photo
            image={images.bosphorus}
            sizes="(min-width: 90rem) 26rem, (min-width: 64rem) 29vw, (min-width: 48rem) 38vw, 100vw"
            className="col-span-4 aspect-3/2 max-md:bleed-left max-md:bleed-right md:col-span-3 md:aspect-4/5 md:self-end md:max-lg:bleed-right lg:col-span-4 lg:col-start-1 lg:row-start-2 lg:aspect-auto lg:min-h-80 lg:self-stretch"
          />

          <ContactForm
            residences={residenceChoices}
            className="col-span-4 md:col-span-8 lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1 lg:pt-10"
          />
        </div>
      </Container>
    </Section>
  );
}
