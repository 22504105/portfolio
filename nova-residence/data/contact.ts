// Options and copy for the viewing request form. The residence options come
// from data/residences.ts.

export const contactMethods = ["WhatsApp", "Phone", "Email"] as const;

export type ContactMethod = (typeof contactMethods)[number];

export const contact = {
  eyebrow: "Private Viewings",
  headline: "Experience NOVA privately.",
  intro: "Schedule a private presentation with our sales team.",
  details: "Viewings are by appointment, seven days a week, at the sales gallery in Beşiktaş.",
  fields: {
    name: "Name",
    email: "Email",
    phone: "Phone",
    residence: "Residence interest",
    method: "Preferred contact method",
  },
  submitLabel: "Request Private Viewing",
  // NOVA is fictional: the form says so next to the button.
  disclosure: "Concept project — this form does not send your details anywhere.",
  success: {
    title: "Thank you.",
    message: "Our team will contact you shortly.",
  },
} as const;
