import { redirect } from "next/navigation";

// The site opens on the demo's welcome screen. Telegram opens the Mini App at /{locale}/app.
export default async function LocalePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  redirect(`/${locale}/demo/welcome`);
}
