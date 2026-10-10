import { z } from "zod";

// Contact details for a booking. The same schema checks the form in the
// browser and, from Phase 03, the request on the server.

export type Contact = { name: string; email: string; phone: string };

export type ContactField = keyof Contact;

/** Why a field was refused; the interface turns these into messages. */
export type ContactIssue = "required" | "tooLong" | "invalid";

export type ContactErrors = Partial<Record<ContactField, ContactIssue>>;

export const EMPTY_CONTACT: Contact = { name: "", email: "", phone: "" };

const PHONE_CHARACTERS = /^[\d\s+\-().]+$/;
const digits = (value: string) => value.replace(/\D/g, "");

const schema = z.object({
  name: z.string().trim().min(1, "required").min(2, "invalid").max(80, "tooLong"),
  email: z.string().trim().min(1, "required").max(254, "tooLong").pipe(z.email("invalid")),
  // Permissive on purpose: numbers are written in many ways. E.164 allows 15 digits.
  phone: z
    .string()
    .trim()
    .min(1, "required")
    .refine((value) => PHONE_CHARACTERS.test(value) && digits(value).length >= 7 && digits(value).length <= 15, "invalid"),
});

/** The first problem with each field, if any. */
export function validateContact(contact: Contact): ContactErrors {
  const result = schema.safeParse(contact);
  if (result.success) return {};

  const errors: ContactErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as ContactField;
    errors[field] ??= issue.message as ContactIssue;
  }
  return errors;
}

/** Contact details as they are stored: trimmed, email in lower case. */
export function normalizeContact(contact: Contact): Contact {
  return {
    name: contact.name.trim().replace(/\s+/g, " "),
    email: contact.email.trim().toLowerCase(),
    phone: contact.phone.trim().replace(/\s+/g, " "),
  };
}
