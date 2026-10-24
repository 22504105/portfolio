import { createHmac } from "node:crypto";

// Sign-in data signed the way Telegram signs it, with a bot token used only by the tests.

export const TOKEN = "1234567890:TEST-ONLY-token-for-signing-fixtures-0";

export function sign(fields: Record<string, string>, token = TOKEN): string {
  const params = new URLSearchParams(fields);
  const check = [...params]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}
