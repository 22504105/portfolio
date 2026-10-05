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
  errors: {
    name: "Please enter your name.",
    emailMissing: "Please enter your email address.",
    emailInvalid: "This email address looks incomplete — for example, name@example.com.",
    phoneMissing: "Please enter a phone number.",
    phoneInvalid: "Please enter a phone number with at least seven digits.",
    residence: "Please choose the residence you are interested in.",
    method: "Please choose how we should contact you.",
    summary: "Please complete the marked fields above.",
  },
  submitLabel: "Request Private Viewing",
  submittingLabel: "Sending…",
  // NOVA is fictional: the form says so next to the button.
  disclosure: "Concept project — this form does not send your details anywhere.",
  success: {
    title: "Thank you.",
    message: "Our team will contact you shortly.",
  },
} as const;
