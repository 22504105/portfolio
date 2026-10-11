import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs before the pages that depend on who is signed in. It lets Supabase
// renew a session that is about to expire and carries the renewed cookies on
// the response: server components cannot write cookies, so this is the one
// place it can happen on a page view. It decides nothing about access; each
// page checks that itself.

export default async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Most visitors have no session; they cost nothing here.
  if (!url || !key || !request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))) return response;

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
  // The demo, the landing page and static files never need a session.
  matcher: ["/app/:path*", "/login", "/signup", "/reset-password", "/update-password", "/auth/:path*"],
};
