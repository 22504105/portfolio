/**
 * Where to go after signing in. Only a path inside the application is
 * accepted: a "next" that points anywhere else (another site, a
 * protocol-relative address, a backslash trick) is replaced by the workspace.
 */
export function safeNext(value: unknown, fallback = "/app/overview"): string {
  if (typeof value !== "string") return fallback;
  const allowed = value === "/update-password" || value === "/app" || value.startsWith("/app/");
  return allowed && !value.includes("//") && !value.includes("\\") && !/[\u0000-\u001f]/.test(value) ? value : fallback;
}
