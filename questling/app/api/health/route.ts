// For uptime checks and the end-to-end test server: answers when the app is up.
export function GET() {
  return Response.json({ ok: true });
}
