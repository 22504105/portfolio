import type { BookingView } from "@/lib/booking/store";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";
import { EMAIL_COPY, type EmailType } from "./copy";

export type RenderedEmail = { subject: string; text: string; html: string };

type RenderInput = {
  type: EmailType;
  booking: BookingView;
  shop: { addressLine1: string; city: string; postcode: string; holdMinutes: number; changeCutoffHours: number };
  /** Where the button leads. Emails without an action do not need one. */
  link?: string;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));

/** One email about one booking, in the language saved with the booking. */
export function renderEmail({ type, booking, shop, link }: RenderInput): RenderedEmail {
  const locale = booking.locale;
  const copy = EMAIL_COPY[locale];
  const email = copy.emails[type];

  const date = formatDateTime(booking.startsAt, locale, { weekday: "long", day: "numeric", month: "long" });
  const time = formatDateTime(booking.startsAt, locale, { hour: "2-digit", minute: "2-digit" });
  const values = {
    name: booking.customer.name,
    reference: booking.reference,
    date: `${date}, ${time}`,
    minutes: shop.holdMinutes,
    hours: shop.changeCutoffHours,
  };

  const rows: [string, string][] = [
    [copy.labels.when, `${date}, ${time} (${copy.londonTime})`],
    [copy.labels.barber, booking.barber.name],
    [copy.labels.services, booking.services.map((service) => service.name[locale]).join(", ")],
    [copy.labels.duration, formatDuration(booking.totalDurationMinutes, locale)],
    [copy.labels.total, formatMoney(booking.totalPriceCents, locale)],
    [copy.labels.address, `${shop.addressLine1}, ${shop.city} ${shop.postcode}`],
    [copy.labels.reference, booking.reference],
  ];

  const subject = fill(email.subject, values);
  const intro = fill(email.intro, values);
  const note = email.note ? fill(email.note, values) : undefined;
  const action = email.action && link ? { label: email.action, link } : undefined;

  const text = [
    email.heading,
    "",
    intro,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    ...(action ? [`${action.label}:`, action.link, ""] : []),
    ...(note ? [note, ""] : []),
    copy.payInShop,
    "",
    copy.concept,
  ].join("\n");

  const cell = "padding:10px 0;border-bottom:1px solid #d9d4c8;font-size:15px;line-height:1.5;vertical-align:top;";
  const html = `<!doctype html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#f2eee5;color:#0c0c0b;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
<p style="margin:0 0 32px;font-size:20px;font-weight:700;letter-spacing:1px;">CUT&amp;CO</p>
<h1 style="margin:0 0 16px;font-size:30px;line-height:1.1;text-transform:uppercase;">${escapeHtml(email.heading)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;">${escapeHtml(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid #d9d4c8;margin:0 0 28px;">
${rows.map(([label, value]) => `<tr><td style="${cell}color:#5a564e;width:38%;">${escapeHtml(label)}</td><td style="${cell}">${escapeHtml(value)}</td></tr>`).join("\n")}
</table>
${
  action
    ? `<p style="margin:0 0 20px;"><a href="${escapeHtml(action.link)}" style="display:inline-block;background:#e5532b;color:#0c0c0b;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:16px 28px;">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#5a564e;">${escapeHtml(copy.linkFallback)}<br><a href="${escapeHtml(action.link)}" style="color:#5a564e;word-break:break-all;">${escapeHtml(action.link)}</a></p>`
    : ""
}
${note ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.5;">${escapeHtml(note)}</p>` : ""}
<p style="margin:0 0 32px;font-size:14px;line-height:1.5;">${escapeHtml(copy.payInShop)}</p>
<p style="margin:0;padding-top:16px;border-top:1px solid #d9d4c8;font-size:12px;line-height:1.5;color:#5a564e;">${escapeHtml(copy.concept)}</p>
</div>
</body>
</html>`;

  return { subject, text, html };
}
