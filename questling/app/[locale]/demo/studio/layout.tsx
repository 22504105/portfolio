import { notFound } from "next/navigation";
import { DemoStudioProvider } from "@/components/studio/studio-providers";
import { isLocale } from "@/lib/i18n";

// The demo Teacher Studio: made-up classes in this browser (lib/studio/demo.ts), labelled "Демо" by the demo layout.
export default async function DemoStudioLayout({ children, params }: LayoutProps<"/[locale]/demo/studio">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <DemoStudioProvider locale={locale}>{children}</DemoStudioProvider>;
}
