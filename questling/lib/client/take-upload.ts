// Keeping a student's take (live student): ask the server for an upload link, put the recording
// straight into storage, then ask the server to check and keep it (docs/media-storage.md). Each step
// can fail on its own; the result names the step's reason so the screen can say what happened.

export type TakeResult = { ok: true } | { ok: false; reason: string };

type Post = (path: string, body: unknown) => Promise<Response | null>;

export async function sendTake(
  post: Post,
  put: typeof fetch,
  args: { exercise: string; line: string; blob: Blob; mime: string },
): Promise<TakeResult> {
  const { exercise, line, blob, mime } = args;
  const ask = await post("media/upload", { kind: "voice", mime, size: blob.size, exercise, line });
  if (!ask) return { ok: false, reason: "network" };
  const ticket = (await ask.json().catch(() => ({}))) as { id?: string; url?: string; contentType?: string; error?: string };
  if (!ask.ok || !ticket.id || !ticket.url) return { ok: false, reason: ticket.error ?? "server" };
  const sent = await put(ticket.url, { method: "PUT", body: blob, headers: { "Content-Type": ticket.contentType ?? mime } }).catch(
    () => null,
  );
  if (!sent?.ok) return { ok: false, reason: "upload" };
  const done = await post("media/complete", { id: ticket.id, exercise, line });
  if (!done) return { ok: false, reason: "network" };
  if (!done.ok) return { ok: false, reason: ((await done.json().catch(() => ({}))) as { error?: string }).error ?? "server" };
  return { ok: true };
}

/** The reasons the screen explains in words; anything else is shown as "something went wrong". */
export const TAKE_REASONS = [
  "network",
  "upload",
  "quota",
  "storage_full",
  "daily_limit",
  "too_large",
  "duration",
  "codec",
  "type",
  "damaged",
  "too_many_pending",
] as const;
export type TakeReason = (typeof TAKE_REASONS)[number] | "other";

export const takeReason = (reason: string): TakeReason =>
  (TAKE_REASONS as readonly string[]).includes(reason) ? (reason as TakeReason) : "other";
