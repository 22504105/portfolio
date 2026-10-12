import { handle } from "@/lib/server/api";

// Every address under /api/v1 goes to one handler, which does its own routing
// (lib/server/api.ts). Always run on request: these answers are never cached.
export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/v1/[...path]">;

const run = async (request: Request, context: Context) => handle(request, (await context.params).path);

export { run as GET, run as POST, run as PUT, run as PATCH, run as DELETE };
