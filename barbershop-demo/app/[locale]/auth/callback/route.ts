import type { EmailOtpType } from "@supabase/supabase-js";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { accountsAvailable, linkCustomer, safeNext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Where the links in Supabase's own emails land: the address confirmation
// after sign-up and the password reset. It turns the one-time code in the
// address into a session and moves on to a clean address.
export async function GET(request: NextRequest, { params }: RouteContext<"/[locale]/auth/callback">) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const query = request.nextUrl.searchParams;
  const go = (path: string) => {
    const response = NextResponse.redirect(new URL(`/${locale}${path}`, request.url), 303);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  if (!accountsAvailable()) return go("/login");
  const supabase = await createSupabaseServerClient();

  // Two shapes of link: a code to exchange (the default emails) or a token
  // hash with its type (custom email templates).
  const code = query.get("code");
  const tokenHash = query.get("token_hash");
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: (query.get("type") ?? "email") as EmailOtpType })
      : null;

  if (!result || result.error || !result.data.user) return go("/login?link=invalid");

  // The address is confirmed now: bookings made with it as a guest join the account.
  await linkCustomer(result.data.user.id);
  return go(safeNext(query.get("next"), "/account"));
}
