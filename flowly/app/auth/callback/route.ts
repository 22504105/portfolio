import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Where the links in Supabase's emails land (password reset, and sign-up
// confirmation if a project has it switched on). The one-time code in the
// link is traded for a session; a bad or used code gets a plain message.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const supabase = await createSupabaseServerClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // Only a path inside the application is followed; anything else goes to the workspace.
    if (!error) return NextResponse.redirect(new URL(safeNext(searchParams.get("next")), origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
