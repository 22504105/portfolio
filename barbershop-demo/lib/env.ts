import { z } from "zod";

// Environment variables are read and checked on first use, not at import, so
// the site still builds and the public pages still render before the services
// behind them are configured.

const serverSchema = z.object({
  // PostgreSQL connection string. On Supabase: the transaction pooler.
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
  // Optional PEM certificate authority for the database connection.
  DATABASE_CA_CERT: z.string().min(1).optional(),
  // The public origin, without a trailing slash. Used to build the links in emails.
  APP_URL: z.url().transform((value) => value.replace(/\/+$/, "")),
  // Signs the short-lived session a customer gets from a booking email.
  SESSION_SECRET: z.string().min(32),
  // Without a key, emails are not sent: in development they are written to a local mail sink.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).default("CUT&CO <bookings@cutco.example>"),
  // Shared secret the scheduler sends with every cron request.
  CRON_SECRET: z.string().min(32).optional(),
});

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

function parse<T>(schema: z.ZodType<T>, values: Record<string, string | undefined>): T {
  // An empty value in an .env file means "not set".
  const present = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
  const result = schema.safeParse(present);
  if (result.success) return result.data;
  // Names only: a value might be a secret.
  const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))].join(", ");
  throw new Error(`Missing or invalid environment variables: ${names}. See .env.example.`);
}

let serverEnv: ServerEnv | undefined;
let publicEnv: PublicEnv | undefined;

/** Server-only variables. Import this from server code only. */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") throw new Error("Server environment read in the browser.");
  serverEnv ??= parse(serverSchema, process.env);
  return serverEnv;
}

/**
 * Whether a database is configured. Without one the public site still works,
 * from the built-in catalog, and booking shows the preview instead of the real flow.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Supabase Auth variables, safe in the browser. Each must be named in full for Next.js to inline it. */
export function getPublicEnv(): PublicEnv {
  publicEnv ??= parse(publicSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return publicEnv;
}
