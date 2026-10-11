import "server-only";
import { headers } from "next/headers";

/**
 * The address a request came from, for throttling. On Vercel the platform
 * sets these headers itself and overwrites whatever a client sent, so they
 * can be trusted there. Anywhere else the value is only as good as the proxy
 * in front, which is why throttling never relies on it alone: limits are also
 * kept per email address and per account.
 */
export function addressFrom(get: (name: string) => string | null): string {
  return (
    get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    get("x-real-ip")?.trim() ||
    get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

/** The address of the current request, in a server action or a server component. */
export async function clientAddress(): Promise<string> {
  const list = await headers();
  return addressFrom((name) => list.get(name));
}
