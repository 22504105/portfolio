import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getServerEnv } from "@/lib/env";
import type { RenderedEmail } from "./render";

export type OutgoingEmail = RenderedEmail & {
  to: string;
  /** The same key for every attempt at the same email: the provider drops repeats. */
  idempotencyKey: string;
};

/** Sends one email and returns the provider's id for it. Throws if it could not be sent. */
export type EmailTransport = (email: OutgoingEmail) => Promise<string>;

// --- Development mail sink ---------------------------------------------------
// Without a provider key, emails are written to .tmp/mail as JSON instead of
// being sent, and /dev/mail shows them. They contain working links, which is
// why the sink exists only outside production.

const SINK = join(process.cwd(), ".tmp", "mail");

export type SunkEmail = OutgoingEmail & { id: string; at: string };

const sinkTransport: EmailTransport = async (email) => {
  mkdirSync(SINK, { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record: SunkEmail = { ...email, id, at: new Date().toISOString() };
  writeFileSync(join(SINK, `${id}.json`), JSON.stringify(record, null, 2));
  return `sink:${id}`;
};

/** The emails in the development sink, newest first. */
export function readSink(): SunkEmail[] {
  try {
    return readdirSync(SINK)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 50)
      .map((file) => JSON.parse(readFileSync(join(SINK, file), "utf8")) as SunkEmail);
  } catch {
    return [];
  }
}

// --- Resend -------------------------------------------------------------------

const resendTransport =
  (apiKey: string, from: string): EmailTransport =>
  async ({ to, subject, text, html, idempotencyKey }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from, to, subject, text, html }),
      signal: AbortSignal.timeout(15_000),
    });
    // The body may echo the request; the status is enough to act on and to log.
    if (!response.ok) throw new Error(`Email provider answered ${response.status}`);
    const { id } = (await response.json()) as { id?: string };
    return id ?? "sent";
  };

/** The transport for this environment: the provider if a key is set, the sink in development. */
export function defaultTransport(): EmailTransport {
  const { RESEND_API_KEY, EMAIL_FROM } = getServerEnv();
  if (RESEND_API_KEY) return resendTransport(RESEND_API_KEY, EMAIL_FROM);
  // EMAIL_SINK=1 turns the sink on for a production build run on a developer's
  // machine, to test that build end to end. Never set it on a deployment: the
  // sink writes emails, working links included, to the local disk.
  if (process.env.NODE_ENV !== "production" || process.env.EMAIL_SINK === "1") return sinkTransport;
  // Fails the job, which leaves it visible and retryable once a key is set.
  return async () => {
    throw new Error("No email provider is configured");
  };
}
