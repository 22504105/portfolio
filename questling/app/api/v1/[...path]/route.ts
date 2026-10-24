import { handle } from "@/lib/server/api";

// The student API. Everything is decided in lib/server/api.ts.

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Context) {
  return handle(request, (await params).path);
}

export async function POST(request: Request, { params }: Context) {
  return handle(request, (await params).path);
}
