import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { readSink } from "@/lib/email/transport";
import { pageLocale } from "@/lib/page";

// DEVELOPMENT ONLY. Shows the emails the application would have sent, so the
// links in them can be followed without a mail provider. It does not exist in
// production: the page answers "not found" and the sink is never written.
// A developer's tool, so its few words are in English only.

export const metadata: Metadata = { title: "Development mail", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const firstLink = (text: string) => text.match(/https?:\/\/\S+/)?.[0];

export default async function DevMailPage({ params }: PageProps<"/[locale]/dev/mail">) {
  if (process.env.NODE_ENV === "production") notFound();
  await pageLocale(params);
  const emails = readSink();

  return (
    <Container className="py-section">
      <p className="type-eyebrow mb-5 text-signal">Development only</p>
      <h1 className="type-h1">Mail sink</h1>
      <p className="type-lead mt-6 max-w-2xl text-muted">
        Emails are written here instead of being sent while no mail provider is configured. Newest first. Reload after
        booking.
      </p>

      {emails.length === 0 ? (
        <p className="type-body mt-12">Nothing yet.</p>
      ) : (
        <ul className="mt-12 border-t border-line">
          {emails.map((email) => {
            const link = firstLink(email.text);
            return (
              <li key={email.id} className="border-b border-line py-8">
                <p className="type-eyebrow text-muted">
                  {new Date(email.at).toLocaleString("en-GB", { timeZone: "Europe/London" })} · to {email.to}
                </p>
                <h2 className="type-h3 mt-3 normal-case">{email.subject}</h2>
                {link && (
                  <p className="mt-4">
                    {/* A plain anchor: the link is absolute and already carries its language. */}
                    <a href={link} className="type-label inline-flex min-h-11 items-center border-b border-signal text-signal">
                      Open the link in this email
                    </a>
                  </p>
                )}
                <pre className="type-small mt-4 overflow-x-auto whitespace-pre-wrap break-words text-muted">{email.text}</pre>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
