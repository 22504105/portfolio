import type { NextRequest } from "next/server";
import { exportCsv, isExportKind } from "@/lib/export/workspace";
import { demoWorkspace } from "@/lib/workspace";

// CSV downloads of the demo: the same rows the pages show, for the same
// period, filters, search and sort. Reading only; the demo has nothing to write.
export async function GET(request: NextRequest, { params }: RouteContext<"/demo/export/[kind]">) {
  const { kind } = await params;
  if (!isExportKind(kind)) return new Response("Not found", { status: 404 });
  return exportCsv(demoWorkspace(), kind, Object.fromEntries(request.nextUrl.searchParams.entries()));
}
