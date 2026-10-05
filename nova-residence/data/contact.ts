// Options and copy for the viewing request form. The residence options come
// from data/residences.ts.

export const contactMethods = ["WhatsApp", "Phone", "Email"] as const;

export type ContactMethod = (typeof contactMethods)[number];

export const contact = {
  headline: "Experience NOVA privately.",
  intro: "Schedule a private presentation with our sales team.",
  submitLabel: "Request Private Viewing",
  success: {
    title: "Thank you.",
    message: "Our team will contact you shortly.",
  },
} as const;
