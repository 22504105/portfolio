import type { NextRequest } from "next/server";
import { appWorkspace } from "@/lib/data/workspace";
import { exportCsv, isExportKind } from "@/lib/export/workspace";
import { currentUser } from "@/lib/supabase/server";

// CSV downloads of a signed-in workspace. The rows come from the database as
// the signed-in user, so a download can only ever hold their own data.
export async function GET(request: NextRequest, { params }: RouteContext<"/app/export/[kind]">) {
  const { kind } = await params;
  if (!isExportKind(kind)) return new Response("Not found", { status: 404 });
  if (!(await currentUser())) return new Response("Sign in to download.", { status: 401 });
  const context = await appWorkspace();
  if (!context) return new Response("Not found", { status: 404 });
  return exportCsv(context, kind, Object.fromEntries(request.nextUrl.searchParams.entries()));
}
