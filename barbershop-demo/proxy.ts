import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const withLocale = createMiddleware(routing);

/** Whether the request carries a Supabase session at all. Most visitors have none. */
const hasSession = (request: NextRequest) => request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));

export default async function proxy(request: NextRequest) {
  const response = withLocale(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !hasSession(request)) return response;

  // A signed-in visitor: let Supabase renew the session if it is about to
  // expire, and carry the renewed cookies on the response. Server components
  // cannot write cookies, so this is the one place it can happen on a page view.
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
