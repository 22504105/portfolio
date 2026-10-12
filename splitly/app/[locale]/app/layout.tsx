import type { Metadata } from "next";
import { TelegramGate } from "@/components/app/TelegramGate";
import { AppFrame } from "@/components/shell/AppFrame";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { robots: { index: false } };

// A person's own groups, behind their Telegram account. Nothing is shown
// until Telegram's sign-in has been checked by the server; the pages
// themselves hold no data, and every read is authorised again on the server.
export default async function AccountLayout({ children, params }: LayoutProps<"/[locale]/app">) {
  const { locale, dictionary } = await pageLocale(params);
  // The bot's public @name, for "open in Telegram" and invitation links. Not a secret.
  const bot = /^[A-Za-z0-9_]{5,32}$/.test(process.env.TELEGRAM_BOT_USERNAME ?? "") ? (process.env.TELEGRAM_BOT_USERNAME as string) : null;
  return (
    <TelegramGate locale={locale} dictionary={dictionary} bot={bot}>
      <AppFrame locale={locale} dictionary={dictionary} base={`/${locale}/app`}>
        {children}
      </AppFrame>
    </TelegramGate>
  );
}
