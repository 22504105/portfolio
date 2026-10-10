import { z } from "zod";

// Environment variables are read and checked on first use, not at import, so
// the site still builds and the public pages still render before the services
// behind them are configured.

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

const serverSchema = z.object({
  // Bypasses row level security. Server only; never give it a NEXT_PUBLIC_ name.
  SUPABASE_SECRET_KEY: z.string().min(20),
  // The public origin, used to build the links in emails.
  APP_URL: z.url(),
  // Without a key, emails are not sent: they are kept in the development mail sink.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).default("CUT&CO <bookings@cutco.example>"),
  // Shared secret the scheduler sends with every cron request.
  CRON_SECRET: z.string().min(32),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parse<T>(schema: z.ZodType<T>, values: Record<string, string | undefined>): T {
  const result = schema.safeParse(values);
  if (result.success) return result.data;
  // Names only: a value might be a secret.
  const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))].join(", ");
  throw new Error(`Missing or invalid environment variables: ${names}. See .env.example.`);
}

let publicEnv: PublicEnv | undefined;
let serverEnv: ServerEnv | undefined;

/** Variables that are safe in the browser. Each must be named in full for Next.js to inline it. */
export function getPublicEnv(): PublicEnv {
  publicEnv ??= parse(publicSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return publicEnv;
}

/** Server-only variables. Import this from server code only. */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") throw new Error("Server environment read in the browser.");
  serverEnv ??= parse(serverSchema, process.env);
  return serverEnv;
}
