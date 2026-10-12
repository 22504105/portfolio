import { NextResponse, type NextRequest } from "next/server";
import { isLocale, pickLocale } from "@/lib/i18n";

// Every page lives under a language: /en/… or /ru/…. An address without one
// is sent to the visitor's own language, taken from what their browser asks
// for. Nothing else happens here: no session is read and no access is decided.

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();

  const locale = pickLocale(request.headers.get("accept-language"));
  return NextResponse.redirect(new URL(`/${locale}${pathname === "/" ? "" : pathname}${search}`, request.url));
}

export const config = {
  // Pages only: not the API, not Next.js internals, not files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
