import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { openSession } from "@/lib/booking/session";
import { allowed, openManageToken } from "@/lib/booking/store";
import { looksLikeToken, throttleKey } from "@/lib/booking/tokens";

// Where the "view or change my booking" link in an email lands. It trades the
// token in the address for a short session cookie and moves on to a clean
// address, so the token does not stay in the address bar, the history or a
// Referer header. Opening the link changes nothing by itself.
export async function GET(request: NextRequest, { params }: RouteContext<"/[locale]/booking/manage/open">) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const target = new URL(`/${locale}/booking/manage`, request.url);

  const token = request.nextUrl.searchParams.get("token");
  const address = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

  const bookingId =
    looksLikeToken(token) && (await allowed(throttleKey("manage:ip", address), 30, 600)) ? await openManageToken(token) : null;

  // One answer for every kind of bad link: unknown, expired or malformed.
  if (!bookingId) target.searchParams.set("link", "invalid");
  else await openSession(bookingId);

  const response = NextResponse.redirect(target, 303);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
