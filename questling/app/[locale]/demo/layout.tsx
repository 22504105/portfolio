import { notFound } from "next/navigation";
import { DemoProvider } from "@/components/student/demo-provider";
import { getDictionary, isLocale } from "@/lib/i18n";

// Everything under /demo runs on a made-up student kept in this browser (DemoProvider),
// writes nothing to the server, and says so on screen. Visual QA hides the badge and its strip
// (data-demo-badge, --demo-bar: 0) so the screens can be compared with the approved designs.
export default async function DemoLayout({ children, params }: LayoutProps<"/[locale]/demo">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <DemoProvider locale={locale}>{children}</DemoProvider>
      {/* The badge's own strip (globals.css, --demo-bar), so it never covers a screen title. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[59] h-(--demo-bar) bg-[#0b0b0f]" />
      <div
        data-demo-badge
        role="note"
        className="border-secondary/40 bg-secondary-container/90 font-label-sm text-secondary-fixed pointer-events-none fixed top-[calc(env(safe-area-inset-top,0px)+4px)] left-1/2 z-[60] -translate-x-1/2 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase"
      >
        {getDictionary(locale).demo.badge}
      </div>
    </>
  );
}
